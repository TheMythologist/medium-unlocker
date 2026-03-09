import { requireNativeModule } from 'expo-modules-core';
import { Linking, Platform } from 'react-native';

const OpenInBrowserModule = requireNativeModule('OpenInBrowser');

function openInBrowser(url: string): Promise<void> {
  return OpenInBrowserModule.openInBrowser(url);
}

export function openExternal(url: string): void {
  if (Platform.OS === 'android') {
    openInBrowser(url).catch(() => Linking.openURL(url));
  } else {
    Linking.openURL(url);
  }
}

export function openLinkSettings(): Promise<void> {
  return OpenInBrowserModule.openLinkSettings();
}

export function isDefaultForLinks(): Promise<boolean> {
  return OpenInBrowserModule.isDefaultForLinks();
}
