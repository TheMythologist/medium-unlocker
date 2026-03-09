import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, useColorScheme } from 'react-native';
import Toast from 'react-native-toast-message';
import { vexo } from 'vexo-analytics';
import LinkSettingsPrompt from '@/components/LinkSettingsPrompt';
import { Colors } from '@/constants/colors';
import { SITE_URL } from '@/constants/config';
import { CurrentUrlContext, ReloadContext } from '@/hooks/useCurrentUrlContext';
import { openExternal } from '@/modules/open-in-browser';

vexo('9bea21c9-6936-4b3d-bee0-0948a4533526');

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [currentUrl, setCurrentUrl] = useState(SITE_URL);
  const reloadRef = useRef<(() => void) | null>(null);

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(currentUrl);
    Toast.show({
      type: 'success',
      text1: 'URL copied to clipboard',
    });
  };

  return (
    <CurrentUrlContext.Provider value={[currentUrl, setCurrentUrl]}>
      <ReloadContext.Provider value={reloadRef}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen
              name="(tabs)"
              options={{
                title: currentUrl,
                headerTitle: ({ children }) => (
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[styles.urlText, { color: theme.headerText }]}>
                    {children}
                  </Text>
                ),
                headerRight: () => (
                  <View style={styles.rightContainer}>
                    <TouchableOpacity onPress={() => reloadRef.current?.()}>
                      <Ionicons name="reload-outline" size={22} color={theme.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={copyToClipboard}>
                      <Ionicons name="copy-outline" size={22} color={theme.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openExternal(currentUrl)}>
                      <Ionicons name="open-outline" size={22} color={theme.accent} />
                    </TouchableOpacity>
                  </View>
                ),
              }}
            />
            <Stack.Screen name="+not-found" />
          </Stack>
        </ThemeProvider>
        <LinkSettingsPrompt />
        <Toast position="bottom" />
      </ReloadContext.Provider>
    </CurrentUrlContext.Provider>
  );
}

const styles = StyleSheet.create({
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  urlText: {
    flex: 1,
    fontSize: 14,
    marginRight: 8,
  },
});
