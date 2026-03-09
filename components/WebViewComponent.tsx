import { MaterialIcons } from '@expo/vector-icons';
import CookieManager, { type Cookies } from '@preeternal/react-native-cookie-manager';
import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { useContext, useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  PanResponder,
  Platform,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Progress from 'react-native-progress';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import type { WebViewProgressEvent } from 'react-native-webview/lib/WebViewTypes';
import { Colors } from '@/constants/colors';
import { SITE_URL } from '@/constants/config';
import { CurrentUrlContext } from '@/hooks/useCurrentUrlContext';
import { openExternal } from '@/modules/open-in-browser';

// Chrome SwipeRefreshLayout values (dp maps 1:1 in RN)
const CIRCLE_DIAMETER = 40;
const DEFAULT_CIRCLE_TARGET = 64; // trigger distance (dampened drag)
const DRAG_RATE = 0.5;
const MAX_DRAG = DEFAULT_CIRCLE_TARGET * 2; // 128dp max overshoot
const ANIMATE_TO_TRIGGER_DURATION = 200;
const ANIMATE_TO_START_DURATION = 200;
const SCALE_DOWN_DURATION = 150;
const MAX_PROGRESS_ROTATION = 0.8; // 0.8 turns = 288 degrees
// Chrome: resting top = mSpinnerOffsetEnd - abs(mOriginalOffsetTop) = 64 - 40 = 24dp
// Our translateY = pullDistance - CIRCLE_DIAMETER/2, so pullDistance = 24 + 20 = 44
const RESTING_PULL_DISTANCE = DEFAULT_CIRCLE_TARGET - CIRCLE_DIAMETER / 2;

const COOKIE_STORAGE_KEY = 'persistedCookies';
const cookieStorage = createAsyncStorage(COOKIE_STORAGE_KEY);

const INJECTED_JS = `
  (function() {
    function getScrollTop() {
      return window.pageYOffset || document.documentElement.scrollTop || 0;
    }
    function postScroll(scrollTop) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'scrollPosition',
        scrollTop: scrollTop
      }));
    }
    let lastTop = 0;
    window.addEventListener('scroll', function() {
      var scrollTop = getScrollTop();
      if ((lastTop <= 1) !== (scrollTop <= 1)) {
        postScroll(scrollTop);
      }
      lastTop = scrollTop;
    }, { passive: true });
    postScroll(getScrollTop());
    // Re-check after browser scroll restoration (back/forward navigation).
    // Scroll restore happens during layout, so wait 2 frames to be sure.
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        postScroll(getScrollTop());
      });
    });
  })();
  true;
`;

interface WebViewComponentProps {
  uri: string;
}

export default function WebViewComponent({ uri }: WebViewComponentProps) {
  const webViewRef = useRef<WebView>(null);
  const canGoBackRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [percentageLoaded, setPercentageLoaded] = useState(0);

  const [, setCurrentUrl] = useContext(CurrentUrlContext);
  const isDark = useColorScheme() === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const { height, width } = useWindowDimensions();

  const isAtTopRef = useRef(true);
  const wasAtTopOnTouchStartRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const pullDistance = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        wasAtTopOnTouchStartRef.current = isAtTopRef.current;
        return false;
      },
      onMoveShouldSetPanResponder: (_, gestureState) =>
        !isRefreshingRef.current &&
        wasAtTopOnTouchStartRef.current &&
        gestureState.dy > 5 &&
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          const dampened = Math.min(gestureState.dy * DRAG_RATE, MAX_DRAG);
          pullDistance.setValue(dampened);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const dampened = gestureState.dy * DRAG_RATE;
        if (dampened >= DEFAULT_CIRCLE_TARGET) {
          isRefreshingRef.current = true;
          Animated.timing(pullDistance, {
            toValue: RESTING_PULL_DISTANCE,
            duration: ANIMATE_TO_TRIGGER_DURATION,
            useNativeDriver: false,
          }).start(() => {
            const loop = Animated.loop(
              Animated.timing(spinAnim, {
                toValue: 1,
                duration: 700,
                useNativeDriver: false,
              }),
            );
            spinLoopRef.current = loop;
            loop.start();
            webViewRef.current?.reload();
          });
        } else {
          Animated.timing(pullDistance, {
            toValue: 0,
            duration: ANIMATE_TO_START_DURATION,
            useNativeDriver: false,
          }).start();
        }
      },
    }),
  ).current;

  const onWebViewMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'scrollPosition') {
        isAtTopRef.current = data.scrollTop <= 1;
      }
    } catch {
      // ignore non-JSON messages
    }
  };

  const INJECTED_JS_BEFORE_CONTENT = `
    try { localStorage.setItem('theme', '${isDark ? 'dark' : 'light'}'); } catch(e) {}
    true;
  `;

  const resetPullIndicator = () => {
    if (spinLoopRef.current) {
      spinLoopRef.current.stop();
      spinLoopRef.current = null;
    }
    spinAnim.setValue(0);
    isRefreshingRef.current = false;
    Animated.timing(pullDistance, {
      toValue: 0,
      duration: SCALE_DOWN_DURATION,
      useNativeDriver: false,
    }).start();
  };

  useEffect(() => {
    const restoreCookies = async () => {
      const savedCookies = await cookieStorage.getItem(COOKIE_STORAGE_KEY);
      if (savedCookies) {
        try {
          const parsedCookies: Cookies = JSON.parse(savedCookies);
          await Promise.all(
            Object.values(parsedCookies).map((cookie) => CookieManager.set(SITE_URL, cookie)),
          );
        } catch {
          await cookieStorage.removeItem(COOKIE_STORAGE_KEY);
        }
      }
      setIsLoading(false);
    };
    restoreCookies();
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const onAndroidBackPress = () => {
      if (canGoBackRef.current) {
        webViewRef.current?.goBack();
        return true;
      }
      return false;
    };

    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', onAndroidBackPress);
      return () => backHandler.remove();
    }
  }, []);

  const onNavigationStateChange = async (event: WebViewNavigation) => {
    setCurrentUrl(event.url);
    const cookies = await CookieManager.get(SITE_URL);
    await cookieStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(cookies));
  };

  const onLoadProgress = (event: WebViewProgressEvent) => {
    canGoBackRef.current = event.nativeEvent.canGoBack;
    setPercentageLoaded(event.nativeEvent.progress);
  };

  const onShouldStartLoadWithRequest = (request: { url: string }) => {
    if (request.url.startsWith(SITE_URL)) {
      return true;
    }
    openExternal(request.url);
    return false;
  };

  const onLoadStart = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = undefined;
    setIsLoading(true);
  };

  const onLoadEnd = () => {
    resetPullIndicator();
    const timeout = setTimeout(() => setIsLoading(false), 500);
    timeoutRef.current = timeout;
  };

  // Circle follows finger, offset so center aligns with pullDistance
  const indicatorTranslateY = Animated.subtract(pullDistance, CIRCLE_DIAMETER / 2);

  const indicatorScale = pullDistance.interpolate({
    inputRange: [0, DEFAULT_CIRCLE_TARGET * 0.5, DEFAULT_CIRCLE_TARGET],
    outputRange: [0, 0.75, 1],
    extrapolate: 'clamp',
  });

  // Arrow rotates 0.8 turns (288deg) during pull, matching Chrome's MAX_PROGRESS_ANGLE
  const arrowRotation = pullDistance.interpolate({
    inputRange: [0, DEFAULT_CIRCLE_TARGET],
    outputRange: ['0deg', `${MAX_PROGRESS_ROTATION * 360}deg`],
    extrapolate: 'clamp',
  });

  // Spinner rotation while refreshing
  const spinRotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.wrapper} {...panResponder.panHandlers}>
      <WebView
        ref={webViewRef}
        style={[styles.container, { height, width }]}
        source={{ uri: `${SITE_URL}${uri}` }}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        onNavigationStateChange={onNavigationStateChange}
        allowsBackForwardNavigationGestures
        onLoadStart={onLoadStart}
        onLoadEnd={onLoadEnd}
        onLoadProgress={onLoadProgress}
        onMessage={onWebViewMessage}
        injectedJavaScriptBeforeContentLoaded={INJECTED_JS_BEFORE_CONTENT}
        injectedJavaScript={INJECTED_JS}
        domStorageEnabled={true}
      />
      {/* Floating refresh indicator — overlays content like Chrome */}
      <Animated.View
        style={[
          styles.indicatorCircle,
          {
            backgroundColor: theme.refreshIndicatorBg,
            transform: [
              { translateY: indicatorTranslateY },
              { scale: indicatorScale },
              { rotate: spinRotation },
            ],
          },
        ]}>
        <Animated.View style={{ transform: [{ rotate: arrowRotation }] }}>
          <MaterialIcons name="refresh" size={24} color={Colors.shared.refreshIcon} />
        </Animated.View>
      </Animated.View>
      {isLoading && (
        <Progress.Bar
          style={styles.progressBar}
          progress={percentageLoaded}
          height={3}
          borderRadius={0}
          borderWidth={0}
          width={width}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  progressBar: {
    position: 'absolute',
    top: 10,
    left: 0,
  },
  indicatorCircle: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: CIRCLE_DIAMETER,
    height: CIRCLE_DIAMETER,
    borderRadius: CIRCLE_DIAMETER / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
