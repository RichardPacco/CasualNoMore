# CasualNoMore

A Steam achievement tracker for Android. No game is casual if there are achievements to hunt.

Browse your library, track your achievement progress, compare with friends and find the ones you haven't unlocked yet.

> This app is a personal project. It is not affiliated with Valve or Steam.

## Features

- Login with your Steam profile (SteamID64 or vanity URL)
- Browse your game library with filters (played, never played, completed, backlog, ...) and sorting
- Track per-game achievement progress with rarity (legendary < 5%)
- See recently played games
- Compare shared games and completion with friends
- Save up to 3 accounts for quick login
- Local database (SQLite) so data is cached offline
- UI in Portuguese and English

## How the app uses the Steam API

The app uses the [Steam Web API](https://partner.steamgames.com/doc/webapi) to fetch your profile, library and achievements.

**No API key is bundled or required to build the app.** The first time you open the app, the login screen asks you for your own Steam Web API key. It is stored only on your device (AsyncStorage) and used to call the Steam API on your behalf. You can remove it at any time from the login screen.

### Getting your Steam Web API key

1. Go to <https://steamcommunity.com/dev/apikey>
2. Sign in with your Steam account
3. Enter a domain (any value works, e.g. `localhost`) and click **Register for a Web API key**
4. Copy the generated key (32 hexadecimal characters) into the app's login screen

> Note: a Steam profile must be **public** for the app to read its games and achievements.

## Requirements

- [Node.js](https://nodejs.org/) LTS (20+)
- npm (comes with Node.js)
- For **local** Android builds: [Android Studio](https://developer.android.com/studio) with the Android SDK and JDK 17
- For **EAS (cloud) builds**: an [Expo account](https://expo.dev/) and the `eas-cli` package
- A Steam account with a Web API key (to use the app)

## Getting started (development)

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm start          # or: npx expo start
```

Then scan the QR code with the **Expo Go** app (Android) or press `a` to open on an Android emulator.

Other useful commands:

```bash
npm run lint              # ESLint
npm run web               # start for web
npm run android           # expo run:android (local dev build)
```

## Building the APK

There are two ways to produce an installable APK.

### Option 1 — EAS cloud build (recommended)

[EAS Build](https://docs.expo.dev/build/introduction/) builds the app on Expo's servers, no local Android toolchain needed.

```bash
# 1. Install EAS CLI (globally or locally)
npm install -g eas-cli

# 2. Log in to your Expo account
eas login

# 3. Build an internal-testing APK (profile "preview")
npm run build:preview
# equivalent to: eas build --platform android --profile preview
```

When the build finishes, you get a download link. The `.apk` is installable directly on Android devices.

Build profiles are defined in [`eas.json`](./eas.json):

| Profile | Distribution | Output | Use case |
| --- | --- | --- | --- |
| `dev` | internal | APK | development client |
| `preview` | internal | APK | installable test build |
| `production` | store | AAB | Google Play release |

> AAB (`production`) cannot be installed directly on devices — upload it to the Play Console.

### Option 2 — Local build (requires Android SDK)

```bash
# 1. Install dependencies
npm install

# 2. Generate the android/ native project
npx expo prebuild --platform android

# 3. Build a release APK
cd android
./gradlew assembleRelease
```

On Windows use `.\gradlew.bat assembleRelease` instead.

The APK is written to `android/app/build/outputs/apk/release/app-release.apk`.

## Project structure

```
app/                 # expo-router screens (login, tabs, ...)
src/
  api/               # Steam Web API client
  components/        # shared UI components
  config/            # API key store (AsyncStorage)
  context/           # Auth context (saved accounts, steamId)
  database/          # SQLite cache layer
  i18n/              # translations (pt / en) + language context
  screens/           # screen-level components (friends, achievements, ...)
  theme/             # central color palette
  utils/             # helpers (toast, formatters, ...)
assets/              # images and icons
app.config.js        # Expo app config (name, version, icons, ...)
eas.json             # EAS build profiles
```

## Tech stack

- [Expo SDK 53](https://expo.dev/) / React Native 0.79
- [expo-router](https://docs.expo.dev/router/introduction/) (file-based navigation)
- [NativeWind](https://www.nativewind.dev/) (Tailwind CSS for React Native)
- [react-native-paper](https://reactnativepaper.com/)
- SQLite via [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- AsyncStorage for accounts and API key persistence

## Troubleshooting

- **"Enter your Steam Web API key"** — no API key is saved. Add yours on the login screen (see above).
- **Empty game list** — your profile or games list is private. Set it to **public** on Steam, or pull down to refresh.
- **Friend list empty** — your friend list is set to *Friends Only*. Change it to **Public** in Steam privacy settings.
- **Build errors on EAS** — make sure you are on the latest `eas-cli` and that your `eas.json` `cli.version` constraint matches.

## License

Private project. All rights reserved.
