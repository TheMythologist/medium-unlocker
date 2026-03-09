import { MaterialIcons } from '@expo/vector-icons';
import CookieManager, { type Cookies } from '@preeternal/react-native-cookie-manager';
import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  PanResponder,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Progress from 'react-native-progress';
import Toast from 'react-native-toast-message';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import type { WebViewProgressEvent } from 'react-native-webview/lib/WebViewTypes';
import { Colors } from '@/constants/colors';
import { SITE_URL } from '@/constants/config';
import { CurrentUrlContext, ReloadContext } from '@/hooks/useCurrentUrlContext';
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

    document.addEventListener('contextmenu', function(e) {
      var el = e.target;
      while (el && el.tagName !== 'A') el = el.parentElement;
      if (el && el.href) {
        e.preventDefault();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'linkLongPress',
          url: el.href,
          text: el.textContent || ''
        }));
      }
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
  const [longPressedLink, setLongPressedLink] = useState<string | null>(null);
  const menuSlide = useRef(new Animated.Value(300)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const [, setCurrentUrl] = useContext(CurrentUrlContext);
  const reloadRef = useContext(ReloadContext);
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
            impactAsync(ImpactFeedbackStyle.Medium);
            const loop = Animated.loop(
              Animated.timing(spinAnim, {
                toValue: 1,
                duration: 700,
                useNativeDriver: false,
              }),
            );
            spinLoopRef.current = loop;
            loop.start();
            webViewRef.current?.injectJavaScript('window.location.reload(); true;');
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
      } else if (data.type === 'linkLongPress') {
        setLongPressedLink(data.url);
      }
    } catch {
      // ignore non-JSON messages
    }
  };

  useEffect(() => {
    if (longPressedLink) {
      menuSlide.setValue(300);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(menuSlide, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [longPressedLink, menuSlide, backdropOpacity]);

  const dismissLinkMenu = useCallback(() => {
    Animated.parallel([
      Animated.timing(menuSlide, {
        toValue: 300,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => setLongPressedLink(null));
  }, [backdropOpacity, menuSlide]);

  const copyLink = async () => {
    if (!longPressedLink) return;
    const Clipboard = await import('expo-clipboard');
    await Clipboard.setStringAsync(longPressedLink);
    dismissLinkMenu();
    Toast.show({
      type: 'success',
      text1: 'URL copied to clipboard',
    });
  };

  const shareLink = async () => {
    if (!longPressedLink) return;
    await Share.share({ url: longPressedLink, message: longPressedLink });
    dismissLinkMenu();
  };

  const openLink = () => {
    if (!longPressedLink) return;
    openExternal(longPressedLink);
    dismissLinkMenu();
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
    reloadRef.current = () =>
      webViewRef.current?.injectJavaScript('window.location.reload(); true;');
    return () => {
      reloadRef.current = null;
    };
  }, [reloadRef]);

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

  useEffect(() => {
    if (!longPressedLink || Platform.OS !== 'android') return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      dismissLinkMenu();
      return true;
    });
    return () => handler.remove();
  }, [dismissLinkMenu, longPressedLink]);

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
    <View
      style={[styles.wrapper, { backgroundColor: theme.background }]}
      {...panResponder.panHandlers}>
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
      {longPressedLink && (
        <View style={styles.menuContainer}>
          <Animated.View style={[styles.menuBackdrop, { opacity: backdropOpacity }]} />
          <Pressable style={styles.menuDismiss} onPress={dismissLinkMenu} />
          <Animated.View
            style={[
              styles.menuCard,
              { backgroundColor: theme.cardBackground, transform: [{ translateY: menuSlide }] },
            ]}>
            <Text numberOfLines={2} style={[styles.menuUrl, { color: theme.secondaryText }]}>
              {longPressedLink}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.menuItem,
                pressed && { backgroundColor: theme.btnPressOverlay },
              ]}
              onPress={copyLink}>
              <Text style={[styles.menuItemText, { color: theme.text }]}>Copy link</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.menuItem,
                pressed && { backgroundColor: theme.btnPressOverlay },
              ]}
              onPress={openLink}>
              <Text style={[styles.menuItemText, { color: theme.text }]}>Open in browser</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.menuItem,
                pressed && { backgroundColor: theme.btnPressOverlay },
              ]}
              onPress={shareLink}>
              <Text style={[styles.menuItemText, { color: theme.text }]}>Share</Text>
            </Pressable>
          </Animated.View>
        </View>
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
  menuContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  menuDismiss: {
    flex: 1,
  },
  menuCard: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  menuUrl: {
    fontSize: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  menuItemText: {
    fontSize: 16,
  },
});
