# Welcome to Medium Unlocker 👋

## Download

Go to the [`latest release`](https://github.com/TheMythologist/medium_unlocker/releases/latest)
and download the APK.

## How to use

Download and install the Medium Unlocker APK.

Next, go to Android settings and configure your device to open links using Medium Unlocker.

*Note*: Unfortunately we are unable to automate this process because we do not have control over the Medium domains.

This may be slightly different from phone to phone, but the flow should be roughly:

1. Go to Settings
2. Select Apps > Default apps
3. Select Opening links
4. Find Medium Unlocker > "Add link"
5. Enable all the links to be opened by Medium Unlocker
   - *Note*: If you are unable to add any links, ensure that you **do not** have the original Medium app installed.
   - If you do not wish to uninstall the original Medium application, disable Medium from opening supported links. You should be able to add the domains in Medium Unlocker now.

That's it! The next time you open a Medium article on any of these domains, it should automatically open it in Medium Unlocker!

## Under the hood

This app is basically a wrapper around [Freedium](https://freedium-mirror.cfd/), but with the added bonus of being able to immediate open Medium articles for free (as long as you have done the proper configurations) without navigating to freedium manually. It makes use of Android's `intentFilters` and [deep links](https://developer.android.com/training/app-links/deep-linking) to automate this.

## Developing

1. Install the dependencies via `npm install`
2. Start the app via `npx expo start`
