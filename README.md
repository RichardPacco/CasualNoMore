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

# 3. Link the project to YOUR Expo account (creates your own EAS project id)
eas init

# 4. Build an internal-testing APK (profile "preview")
npm run build:preview
# equivalent to: eas build --platform android --profile preview
```

> `eas init` is required — the repo intentionally does not ship a project id, so your builds are linked to your own Expo account, not anyone else's.

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

> The Android application id (`com.casualnomore.app`) is set in `app.config.js`. Change it there before publishing under your own identity.

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

Copyright © 2026 Richard Pacco. All rights reserved.

---

# CasualNoMore (Português)

Um rastreador de conquistas da Steam para Android. Nenhum jogo é casual se tem conquistas para caçar.

Navegue pela sua biblioteca, acompanhe seu progresso de conquistas, compare com amigos e encontre as que ainda não desbloqueou.

> Este app é um projeto pessoal. Não é afiliado à Valve ou à Steam.

## Funcionalidades

- Login com seu perfil Steam (SteamID64 ou vanity URL)
- Navegue pela sua biblioteca de jogos com filtros (jogados, nunca jogados, completados, backlog, ...) e ordenação
- Acompanhe o progresso de conquistas por jogo, com raridade (lendárias < 5%)
- Veja jogos jogados recentemente
- Compare jogos em comum e conclusão com amigos
- Salve até 3 contas para login rápido
- Banco de dados local (SQLite) para dados ficarem em cache offline
- Interface em português e inglês

## Como o app usa a API da Steam

O app usa a [Steam Web API](https://partner.steamgames.com/doc/webapi) para buscar seu perfil, biblioteca e conquistas.

**Nenhuma chave de API é embutida nem é necessária para compilar o app.** Na primeira vez que você abrir o app, a tela de login pede a sua própria chave da Steam Web API. Ela fica armazenada somente no seu dispositivo (AsyncStorage) e é usada para chamar a API da Steam em seu nome. Você pode removê-la a qualquer momento pela tela de login.

### Obtendo sua chave da Steam Web API

1. Acesse <https://steamcommunity.com/dev/apikey>
2. Entre com a sua conta Steam
3. Informe um domínio (qualquer valor funciona, ex.: `localhost`) e clique em **Registrar chave da Web API**
4. Copie a chave gerada (32 caracteres hexadecimais) e cole na tela de login do app

> Observação: o perfil Steam precisa estar **público** para o app conseguir ler jogos e conquistas.

## Requisitos

- [Node.js](https://nodejs.org/) LTS (20+)
- npm (já vem com o Node.js)
- Para builds **locais** Android: [Android Studio](https://developer.android.com/studio) com Android SDK e JDK 17
- Para builds **EAS (nuvem)**: uma [conta Expo](https://expo.dev/) e o pacote `eas-cli`
- Uma conta Steam com chave da Web API (para usar o app)

## Começando (desenvolvimento)

```bash
# 1. Instale as dependências
npm install

# 2. Inicie o servidor de desenvolvimento
npm start          # ou: npx expo start
```

Depois escaneie o QR code com o app **Expo Go** (Android) ou pressione `a` para abrir num emulador Android.

Outros comandos úteis:

```bash
npm run lint              # ESLint
npm run web               # iniciar para web
npm run android           # expo run:android (build de dev local)
```

## Compilando o APK

Existem duas formas de gerar um APK instalável.

### Opção 1 — Build EAS na nuvem (recomendada)

O [EAS Build](https://docs.expo.dev/build/introduction/) compila o app nos servidores da Expo, sem precisar de ferramentas Android locais.

```bash
# 1. Instale o EAS CLI (globalmente ou localmente)
npm install -g eas-cli

# 2. Entre na sua conta Expo
eas login

# 3. Vincule o projeto à SUA conta Expo (cria o seu próprio project id)
eas init

# 4. Gere um APK de teste interno (perfil "preview")
npm run build:preview
# equivalente a: eas build --platform android --profile preview
```

> O `eas init` é obrigatório — o repositório não inclui um project id de propósito, para que seus builds fiquem vinculados à sua própria conta Expo, e não à de outra pessoa.

Quando o build terminar, você recebe um link de download. O `.apk` pode ser instalado diretamente em aparelhos Android.

Os perfis de build estão definidos no [`eas.json`](./eas.json):

| Perfil | Distribuição | Saída | Uso |
| --- | --- | --- | --- |
| `dev` | interna | APK | client de desenvolvimento |
| `preview` | interna | APK | build de teste instalável |
| `production` | loja | AAB | release na Google Play |

> O AAB (`production`) não pode ser instalado diretamente — envie-o para o Play Console.

### Opção 2 — Build local (requer Android SDK)

```bash
# 1. Instale as dependências
npm install

# 2. Gere o projeto nativo android/
npx expo prebuild --platform android

# 3. Gere o APK de release
cd android
./gradlew assembleRelease
```

No Windows use `.\gradlew.bat assembleRelease` no lugar.

O APK será gravado em `android/app/build/outputs/apk/release/app-release.apk`.

> O application id do Android (`com.casualnomore.app`) está definido no `app.config.js`. Altere-o lá antes de publicar com a sua identidade.

## Estrutura do projeto

```
app/                 # telas do expo-router (login, tabs, ...)
src/
  api/               # client da Steam Web API
  components/        # componentes de UI compartilhados
  config/            # armazenamento da chave de API (AsyncStorage)
  context/           # contexto de Auth (contas salvas, steamId)
  database/          # camada de cache com SQLite
  i18n/              # traduções (pt / en) + contexto de idioma
  screens/           # componentes de tela (amigos, conquistas, ...)
  theme/             # paleta de cores central
  utils/             # utilitários (toast, formatação, ...)
assets/              # imagens e ícones
app.config.js        # config do app Expo (nome, versão, ícones, ...)
eas.json             # perfis de build EAS
```

## Stack de tecnologias

- [Expo SDK 53](https://expo.dev/) / React Native 0.79
- [expo-router](https://docs.expo.dev/router/introduction/) (navegação baseada em arquivos)
- [NativeWind](https://www.nativewind.dev/) (Tailwind CSS para React Native)
- [react-native-paper](https://reactnativepaper.com/)
- SQLite via [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- AsyncStorage para persistência de contas e chave de API

## Solução de problemas

- **"Informe sua chave de API Steam"** — nenhuma chave salva. Adicione a sua na tela de login (veja acima).
- **Lista de jogos vazia** — seu perfil ou lista de jogos está privado(a). Deixe como **público** na Steam, ou puxe para baixo para atualizar.
- **Lista de amigos vazia** — sua lista de amigos está em *Somente amigos*. Mude para **Público** nas configurações de privacidade da Steam.
- **Erros de build no EAS** — certifique-se de estar na versão mais recente do `eas-cli` e de que a restrição de `cli.version` no seu `eas.json` é compatível.

## Licença

Copyright © 2026 Richard Pacco. Todos os direitos reservados.
