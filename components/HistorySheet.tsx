import { Ionicons } from '@expo/vector-icons';
import { useContext, useEffect } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/colors';
import { HistoryContext, NavigateContext } from '@/hooks/useCurrentUrlContext';

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

interface HistorySheetProps {
  visible: boolean;
  onDismiss: () => void;
}

const SWIPE_THRESHOLD = 80;
const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function HistorySheet({ visible, onDismiss }: HistorySheetProps) {
  const isDark = useColorScheme() === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const { history, clearHistory } = useContext(HistoryContext);
  const navigateRef = useContext(NavigateContext);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const scrollOffset = useSharedValue(0);
  const startY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scrollOffset.value = 0;
      translateY.value = withTiming(0, { duration: 300 });
    }
  }, [visible, translateY, scrollOffset]);

  const dismiss = () => {
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 }, () => {
      runOnJS(onDismiss)();
    });
  };

  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((e) => {
      startY.value = e.allTouches[0].absoluteY;
    })
    .onTouchesMove((e, stateManager) => {
      const dy = e.allTouches[0].absoluteY - startY.value;
      if (dy > 10 && scrollOffset.value <= 0) {
        stateManager.activate();
      } else if (dy < -10 || scrollOffset.value > 0) {
        stateManager.fail();
      }
    })
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > SWIPE_THRESHOLD) {
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 }, () => {
          runOnJS(onDismiss)();
        });
      } else {
        translateY.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const onSelect = (url: string) => {
    dismiss();
    navigateRef.current?.(url);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      <GestureHandlerRootView style={styles.container}>
        <Pressable style={styles.backdrop} onPress={dismiss} />
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[styles.card, { backgroundColor: theme.cardBackground }, animatedStyle]}>
            <View style={styles.handleContainer}>
              <View style={[styles.handle, { backgroundColor: theme.secondaryText }]} />
            </View>
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>History</Text>
              {history.length > 0 && (
                <Pressable
                  onPress={() =>
                    Alert.alert('Clear history?', 'This will remove all reading history.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Clear', style: 'destructive', onPress: clearHistory },
                    ])
                  }>
                  <Text style={[styles.clearText, { color: theme.accent }]}>Clear</Text>
                </Pressable>
              )}
            </View>
            {history.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="time-outline" size={48} color={theme.secondaryText} />
                <Text style={[styles.emptyText, { color: theme.secondaryText }]}>
                  No history yet
                </Text>
              </View>
            ) : (
              <FlatList
                data={history}
                keyExtractor={(item) => item.url}
                onScroll={(e) => {
                  scrollOffset.value = e.nativeEvent.contentOffset.y;
                }}
                scrollEventThrottle={16}
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [
                      styles.entry,
                      pressed && { backgroundColor: theme.btnPressOverlay },
                    ]}
                    onPress={() => onSelect(item.url)}>
                    <View style={styles.entryContent}>
                      <Text numberOfLines={1} style={[styles.entryTitle, { color: theme.text }]}>
                        {item.title}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[styles.entryUrl, { color: theme.secondaryText }]}>
                        {item.url}
                      </Text>
                    </View>
                    <Text style={[styles.entryTime, { color: theme.secondaryText }]}>
                      {formatRelativeTime(item.timestamp)}
                    </Text>
                  </Pressable>
                )}
              />
            )}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 0.2,
  },
  card: {
    flex: 0.8,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
  },
  handleContainer: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  clearText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  entryContent: {
    flex: 1,
    marginRight: 12,
  },
  entryTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  entryUrl: {
    fontSize: 12,
    marginTop: 2,
  },
  entryTime: {
    fontSize: 12,
  },
});
