import { Ionicons } from '@expo/vector-icons';
import { useContext } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

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

export default function HistorySheet({ visible, onDismiss }: HistorySheetProps) {
  const isDark = useColorScheme() === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const { history, clearHistory } = useContext(HistoryContext);
  const navigateRef = useContext(NavigateContext);

  const onSelect = (url: string) => {
    onDismiss();
    navigateRef.current?.(url);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.container}>
        <Pressable style={styles.backdrop} onPress={onDismiss} />
        <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
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
              <Text style={[styles.emptyText, { color: theme.secondaryText }]}>No history yet</Text>
            </View>
          ) : (
            <FlatList
              data={history}
              keyExtractor={(item) => item.url}
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
        </View>
      </View>
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
    paddingTop: 16,
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
