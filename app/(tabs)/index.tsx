import { useLinkingURL } from 'expo-linking';
import { StyleSheet } from 'react-native';

import { ThemedView } from '@/components/ThemedView';
import WebViewComponent from '@/components/WebViewComponent';

export default function HomeScreen() {
  const rawUrl = useLinkingURL();
  const url = rawUrl?.match(/^https?:\/\//) ? rawUrl : '';

  return (
    <ThemedView style={styles.container}>
      <WebViewComponent uri={url} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    marginTop: -10,
  },
});
