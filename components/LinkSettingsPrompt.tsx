import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
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

import { Colors } from '@/constants/colors';
import { isDefaultForLinks, openLinkSettings } from '@/modules/open-in-browser';

const DISMISSED_KEY = 'linkPromptDismissed';
const storage = createAsyncStorage(DISMISSED_KEY);

export default function LinkSettingsPrompt() {
  const [visible, setVisible] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const dismissedRef = useRef(false);

  const check = async () => {
    if (dismissedRef.current) return;
    const wasDismissed = await storage.getItem(DISMISSED_KEY);
    if (wasDismissed === 'true') {
      dismissedRef.current = true;
      return;
    }
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

  const dismiss = () => {
    impactAsync(ImpactFeedbackStyle.Light);
    setVisible(false);
  };

  const dismissPermanently = async () => {
    impactAsync(ImpactFeedbackStyle.Light);
    dismissedRef.current = true;
    await storage.setItem(DISMISSED_KEY, 'true');
    setVisible(false);
  };

  const openSettings = () => {
    impactAsync(ImpactFeedbackStyle.Light);
    dismiss();
    openLinkSettings();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.title, { color: isDark ? theme.text : '#000' }]}>
            Open Medium links with this app
          </Text>
          <Text style={[styles.body, { color: theme.bodyText }]}>
            To automatically open Medium links in this app, enable supported links in the app
            settings.
          </Text>
          <View style={styles.buttons}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: pressed ? Colors.shared.accentPressed : theme.accent },
              ]}
              onPress={openSettings}>
              <Text style={styles.primaryText}>Open Settings</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && { backgroundColor: theme.btnPressOverlay },
              ]}
              onPress={dismiss}>
              <Text style={[styles.secondaryText, { color: theme.secondaryText }]}>Not now</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && { backgroundColor: theme.btnPressOverlay },
              ]}
              onPress={dismissPermanently}>
              <Text style={[styles.secondaryText, { color: theme.secondaryText }]}>
                Don't ask again
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
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
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  buttons: {
    gap: 4,
  },
  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
