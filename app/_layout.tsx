import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View, Text, TouchableOpacity, useColorScheme } from 'react-native';
import Toast from 'react-native-toast-message';
import { CurrentUrlContext } from '@/hooks/useCurrentUrlContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [currentUrl, setCurrentUrl] = useState('https://freedium-mirror.cfd/');

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(currentUrl);
    Toast.show({
      type: 'success',
      text1: 'URL copied to clipboard',
    });
  };

  const openInBrowser = () => {
    Linking.openURL(currentUrl);
  };

  return (
    <CurrentUrlContext.Provider value={[currentUrl, setCurrentUrl]}>
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
                  style={[styles.urlText, { color: colorScheme === 'dark' ? '#c6c7c6' : '#000' }]}>
                  {children}
                </Text>
              ),
              headerRight: () => (
                <View style={styles.rightContainer}>
                  <TouchableOpacity onPress={copyToClipboard}>
                    <Ionicons name="copy-outline" size={22} color="#007AFF" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={openInBrowser}>
                    <Ionicons name="open-outline" size={22} color="#007AFF" />
                  </TouchableOpacity>
                </View>
              ),
            }}
          />
          <Stack.Screen name="+not-found" />
        </Stack>
      </ThemeProvider>
      <Toast position="bottom" />
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
