import { useEffect, useState } from 'react';
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { isDefaultForLinks, openLinkSettings } from '@/modules/open-in-browser';

export default function LinkSettingsPrompt() {
  const [visible, setVisible] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const check = () => {
    isDefaultForLinks()
      .then((isDefault) => setVisible(!isDefault))
      .catch(() => {});
  };

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    check();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, []);

  const dismiss = () => setVisible(false);

  const openSettings = () => {
    dismiss();
    openLinkSettings();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
          <Text style={[styles.title, isDark && styles.textDark]}>
            Open Medium links with this app
          </Text>
          <Text style={[styles.body, isDark && styles.bodyDark]}>
            To automatically open Medium links in this app, enable supported links in the app
            settings.
          </Text>
          <View style={styles.buttons}>
            <Pressable style={styles.secondaryBtn} onPress={dismiss}>
              <Text style={styles.secondaryText}>Not now</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={openSettings}>
              <Text style={styles.primaryText}>Open Settings</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  cardLight: {
    backgroundColor: '#fff',
  },
  cardDark: {
    backgroundColor: '#2c2c2e',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    color: '#000',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#555',
    marginBottom: 20,
  },
  textDark: {
    color: '#fff',
  },
  bodyDark: {
    color: '#aaa',
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  primaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  primaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
