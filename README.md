# Medium Unlocker

[![Latest release](https://img.shields.io/github/v/release/TheMythologist/medium-unlocker)](https://github.com/TheMythologist/medium-unlocker/releases/latest)
[![CI status](https://github.com/TheMythologist/medium-unlocker/workflows/build/badge.svg)](https://github.com/TheMythologist/medium-unlocker/actions?query=branch%3Amain)
[![Downloads](https://img.shields.io/github/downloads/TheMythologist/medium-unlocker/total)](https://github.com/TheMythologist/medium-unlocker/releases)

Medium Unlocker is an Android app that lets you read Medium articles for free. It intercepts Medium links on your device and opens them through [Freedium](https://freedium-mirror.cfd/) — no manual URL pasting required.

## Installation

1. Download the APK from the [latest release](https://github.com/TheMythologist/medium_unlocker/releases/latest).
2. Install the APK on your Android device.
3. Configure your device to open Medium links with Medium Unlocker. The app will prompt you to open link settings on first launch — just tap **Open Settings** in the modal. You can also navigate there manually:

   > **Settings** > **Apps** > **Default apps** > **Opening links** > **Medium Unlocker** > **Add link** > Enable all domains

> [!NOTE]
> If you are unable to add any links, ensure the original Medium app is **not installed**. Alternatively, disable Medium's supported links and the domains should become available in Medium Unlocker.

Once configured, any Medium article link you tap will automatically open in Medium Unlocker.

## Features

- **Reading History** — Browse your last 100 visited articles via the header clock icon. Tap to revisit or clear your history.
- **Long-Press Context Menu** — Long-press any link to copy, open in browser, or share it.
- **Pull-to-Refresh** — Pull down to reload with haptic feedback and a smooth animation.
- **Header Actions** — Reload the page, copy the current URL, or open it in your default browser.
- **Dark/Light Mode** — Automatically adapts to your system theme.
- **Deep Link Support** — Handles 100+ Medium-related domains out of the box.
- **Persistent Cookies** — Session state is preserved between app restarts.

## How It Works

Medium Unlocker uses Android [deep links](https://developer.android.com/training/app-links/deep-linking) and `intentFilters` to register itself as a handler for Medium domains. When you tap a Medium link anywhere on your device, the app intercepts it and loads the article through Freedium, bypassing the paywall automatically.

## Development

```sh
npm install
npx expo start
```
