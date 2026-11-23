# CasualNoMore

An achievement tracker for Android, for **Steam** and **RetroAchievements**. No game is casual if there are achievements to hunt.

Browse your libraries, track your achievement progress, compare with friends and find the ones you haven't unlocked yet. Connect one platform or both.

> This app is a personal project. It is not affiliated with Valve, Steam or RetroAchievements.
> Retro achievement data: [RetroAchievements.org](https://retroachievements.org).

Current version: **4.3.0**

**Download:** get the latest APK from the [Releases page](https://github.com/RichardPacco/CasualNoMore/releases). Once installed, the app updates itself from **Profile → Check for updates**.

## Features

### Both platforms
- **Single login flow:** Steam first, then RetroAchievements. Connect either one or both, and skip the one you don't use. You can connect or disconnect each platform later from the Profile.
- Up to 3 saved accounts per platform for quick login.
- **Library** with one platform at a time (a Steam | RetroAchievements switch appears when both are connected):
  - three view modes: compact list, cards and a two-column grid
  - search, quick filter chips plus more filters (backlog, completed, with/without achievements, pinned...) and sorting
  - pinned games and a "recently played" section
- **Game screen** with Details and Achievements tabs: rarity colors, unlock dates, search, filters and sorting, and an achievement sheet with guide search (Google, ChatGPT).
- **Friends** with games in common and your progress next to theirs.
- **Profile** with your stats and settings.
- **In-app updates** (Android): Profile → Check for updates downloads the latest release and opens the installer.
- Local SQLite cache: everything opens instantly and works offline after the first sync.
- Dark theme ("Arcade Night"), UI in Portuguese and English (with flags in the language picker).

### Steam
- Library sync with progress counts, a **Turbo** button to sync more games in parallel, and pull to refresh.
- Store page, community guides and discussions, and a HowLongToBeat search from the Details tab.

### RetroAchievements
- **Hardcore only:** progress, medals and rarity count only hardcore unlocks. Softcore-only unlocks are shown as "doesn't count".
- Library synced in a few calls (the whole library comes from one paginated endpoint). Console filter, and options to hide hacks (hidden by default) and subsets.
- Medals for **mastered** and **beaten** games.
- Achievements show points, RetroPoints and type tags (**Progression**, **Win condition**, **Missable**). A **Missable** chip combines with the status filter (for example, locked missables). Default sort is the set author's order.
- **Comments** for each achievement, 10 per page.
- Details tab with console, release, genre, publisher, developer, player counts, and links to the game page, forum and guide on RetroAchievements.
- **Friends:** following and followers (with a "Mutual" badge), and each friend's games with both players' hardcore progress.
- **Profile card:** points, RetroPoints, rank and masteries, with a warning and an "Update key" button if the key stops working.

## API keys

The app uses the [Steam Web API](https://partner.steamgames.com/doc/webapi) and the [RetroAchievements Web API](https://api-docs.retroachievements.org/).

**No API key is bundled or required to build the app.** The login asks for your own keys. They are stored only on your device, encrypted, in the secure store (Android Keystore through `expo-secure-store`), and are never written to logs. You can remove a key at any time from the login screen.

### Steam Web API key

1. Go to <https://steamcommunity.com/dev/apikey>
2. Sign in with your Steam account
3. Enter a domain (any value works, for example `localhost`) and click **Register for a Web API key**
4. Paste the key (32 hexadecimal characters) into the app. It is saved as soon as the format matches.

> Your Steam profile and game details must be **public** for the app to read your games and achievements.

### RetroAchievements Web API key

1. Sign in at <https://retroachievements.org> and open **Settings → Keys**
2. Paste the Web API key (32 letters and numbers) into the app
3. Enter your RetroAchievements username

> Use your own account's key: the following/followers lists always come from the key's owner. The account is linked by its ULID, so changing your username on the site doesn't break it.

## Requirements

- [Node.js](https://nodejs.org/) LTS (20+)
- npm (comes with Node.js)
- For **local** Android builds: [Android Studio](https://developer.android.com/studio) with the Android SDK and JDK 17
- For **EAS (cloud) builds**: an [Expo account](https://expo.dev/) and the `eas-cli` package
- To use the app: a Steam account with a Web API key and/or a RetroAchievements account with a Web API key

## Getting started (development)

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm start          # or: npx expo start
```

Expo Go works, but without the app's custom native setting (see [Android network limit](#android-network-limit)), so the Steam sync is slower there. A development build (`npm run android`) has everything.

Other useful commands:

```bash
npm run lint              # ESLint
npm run android           # expo run:android (local dev build)
```

## Building the APK

There are two ways to produce an installable APK.

### Option 1 — EAS cloud build

[EAS Build](https://docs.expo.dev/build/introduction/) builds the app on Expo's servers, with no local Android toolchain needed.

```bash
# 1. Install EAS CLI
npm install -g eas-cli

# 2. Log in to your Expo account
eas login

# 3. Link the project to YOUR Expo account
eas init

# 4. Build an internal-testing APK (profile "preview")
npm run build:preview
# equivalent to: eas build --platform android --profile preview
```

> `app.config.js` contains the author's EAS project id (`extra.eas.projectId`). Run `eas init` so your builds are linked to your own Expo account.

Build profiles are defined in [`eas.json`](./eas.json):

| Profile | Distribution | Output | Use case |
| --- | --- | --- | --- |
| `dev` | internal | APK | development client |
| `preview` | internal | APK | installable test build |
| `production` | store | AAB | Google Play release |

> An AAB (`production`) cannot be installed directly on devices. Upload it to the Play Console.

### Option 2 — Local build with Gradle

`eas build --local` only runs on macOS or Linux. On Windows, use Gradle directly:

```bash
# 1. Install dependencies
npm install

# 2. Generate the android/ native project (needed after changing app.config.js, plugins or native packages)
npx expo prebuild --platform android --clean

# 3. Build a release APK
cd android
./gradlew assembleRelease          # Windows: .\gradlew.bat assembleRelease
```

The APK is written to `android/app/build/outputs/apk/release/app-release.apk` (signed with the debug key, which is enough to install and test). To install it on a phone connected by USB: `adb install -r android/app/build/outputs/apk/release/app-release.apk`.

**Architecture.** The APK is built only for 64-bit ARM phones (`arm64-v8a`, almost every modern Android phone), set by [`plugins/withArchitectures.js`](./plugins/withArchitectures.js). For an x86 emulator, build once with `-PreactNativeArchitectures=x86`.

**Faster local builds.** The first release build can still take several minutes. To speed it up:
- Use `--parallel --build-cache` with `assembleRelease`.
- Skip `prebuild --clean` and `gradlew clean` unless something native changed, so Gradle can reuse its cache.
- On Windows, add the project folder and `%USERPROFILE%\.gradle` to the Windows Security antivirus exclusions.

> The Android application id (`com.casualnomore.app`) is set in `app.config.js`. Change it there before publishing under your own identity.

### Android network limit

React Native sends every `fetch` on Android through OkHttp, which allows only 5 simultaneous requests per server. Almost every Steam call goes to the same server, so the library sync would queue up. The config plugin [`plugins/withOkHttpConcurrency.js`](./plugins/withOkHttpConcurrency.js) raises this limit (configured in `app.config.js`). It is applied by `expo prebuild` and by EAS builds.

## Project structure

```
app/                     # expo-router screens: login, tabs (games, friends, profile)
plugins/                 # Expo config plugins (OkHttp concurrency limit)
src/
  api/                   # Steam and RetroAchievements Web API clients
  components/            # shared components (game card, sheets, dialogs...)
    login/               # login form shared by both platforms + per-platform config
    ui/                  # design-system primitives (text, button, chip, progress...)
  config/                # API key store (secure store, one key per platform)
  context/               # auth (connected accounts, saved accounts) and settings
  database/              # SQLite cache (db.js: Steam, raDb.js: RetroAchievements)
  hooks/                 # useLibrary, useAchievements, ...
  i18n/                  # translations (pt / en) + language context
  platforms/             # one module per platform (adapter, library sync, game data)
    steam/
    ra/
  screens/               # screen components (library, game, friends, profile...)
  theme/                 # colors and fonts
  utils/                 # helpers (dates, playtime, toast, CDN...)
assets/                  # images and icons
app.config.js            # Expo app config (name, version, icons, plugins)
eas.json                 # EAS build profiles
RETROACHIEVEMENTS_PLAN.md  # design notes and progress of the RetroAchievements integration
```

## Tech stack

- [Expo SDK 53](https://expo.dev/) / React Native 0.79 (new architecture)
- [expo-router](https://docs.expo.dev/router/introduction/) and React Navigation
- [NativeWind](https://www.nativewind.dev/) (Tailwind CSS for React Native)
- [FlashList](https://shopify.github.io/flash-list/) for long lists
- [react-native-svg](https://github.com/software-mansion/react-native-svg) and expo-linear-gradient
- Inter and Space Grotesk fonts ([@expo-google-fonts](https://github.com/expo/google-fonts))
- SQLite via [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/) for API keys, AsyncStorage for accounts and settings

## Troubleshooting

- **"Enter your Steam Web API key" / "Enter your RetroAchievements Web API Key"** — no key is saved for that platform. Add yours on the login screen.
- **Empty Steam game list** — your profile or game details are private. Set them to **public** on Steam, then pull down to refresh.
- **Empty Steam friend list** — your friend list is set to *Friends Only*. Change it to **Public** in Steam privacy settings.
- **"Invalid key" on RetroAchievements, or "Your Web API Key no longer works" on the Profile** — the key was changed or revoked on the site. Tap **Update key** and paste the new one from Settings → Keys.
- **"User not found on RetroAchievements"** — check the username (it is not case-sensitive, but must exist).
- **"This account is untracked"** — the RetroAchievements account is outside the rankings, so some data may be missing.
- **Empty RetroAchievements library** — games only show up after you play them in an emulator signed in with your account.
- **Build errors on EAS** — make sure you are on the latest `eas-cli` and that the `cli.version` constraint in `eas.json` matches.

## License

[MIT](./LICENSE) © 2026 Richard Pacco. You can use, modify and share the code, as long as the copyright notice and the license are kept.

---

# CasualNoMore (Português)

Um rastreador de conquistas para Android, para **Steam** e **RetroAchievements**. Nenhum jogo é casual se tem conquistas para caçar.

Navegue pelas suas bibliotecas, acompanhe seu progresso de conquistas, compare com amigos e encontre as que ainda não desbloqueou. Conecte uma plataforma ou as duas.

> Este app é um projeto pessoal. Não é afiliado à Valve, à Steam ou ao RetroAchievements.
> Dados de conquistas retrô: [RetroAchievements.org](https://retroachievements.org).

Versão atual: **4.3.0**

**Download:** baixe o APK mais recente na [página de Releases](https://github.com/RichardPacco/CasualNoMore/releases). Depois de instalado, o app se atualiza pelo **Perfil → Verificar atualização**.

## Funcionalidades

### As duas plataformas
- **Login em fluxo único:** primeiro a Steam, depois o RetroAchievements. Conecte uma ou as duas e pule a que você não usa. Depois dá para conectar ou desconectar cada plataforma pelo Perfil.
- Até 3 contas salvas por plataforma para login rápido.
- **Biblioteca** com uma plataforma por vez (um seletor Steam | RetroAchievements aparece com as duas conectadas):
  - três modos de exibição: lista compacta, cards e grade de duas colunas
  - busca, chips de filtro rápido e mais filtros (backlog, completos, com/sem conquistas, fixados...) e ordenação
  - jogos fixados e a seção "jogados recentemente"
- **Tela do jogo** com as abas Detalhes e Conquistas: cores de raridade, datas de desbloqueio, busca, filtros e ordenação, e a ficha da conquista com busca de guias (Google, ChatGPT).
- **Amigos** com jogos em comum e o seu progresso ao lado do deles.
- **Perfil** com as suas estatísticas e os ajustes.
- **Atualização pelo app** (Android): Perfil → Verificar atualização baixa a última release e abre o instalador.
- Cache local em SQLite: tudo abre na hora e funciona offline depois da primeira sincronização.
- Tema escuro ("Arcade Night"), interface em português e inglês (com bandeiras no seletor de idioma).

### Steam
- Sincronização da biblioteca com a contagem de progresso, botão **Turbo** para sincronizar mais jogos em paralelo e puxar para atualizar.
- Página da loja, guias e discussões da comunidade e busca no HowLongToBeat pela aba Detalhes.

### RetroAchievements
- **Só hardcore:** progresso, medalhas e raridade contam só os desbloqueios em hardcore. Desbloqueios só em softcore aparecem como "não conta".
- Biblioteca sincronizada em poucas chamadas (a biblioteca inteira vem de um endpoint paginado). Filtro de console e opções para esconder hacks (escondidos por padrão) e subsets.
- Medalhas de jogo **masterizado** e **zerado**.
- As conquistas mostram pontos, RetroPoints e etiquetas de tipo (**Progressão**, **Vitória**, **Perdível**). O chip **Perdíveis** combina com o filtro de status (por exemplo, perdíveis bloqueadas). A ordenação padrão é a ordem do autor do set.
- **Comentários** de cada conquista, 10 por página.
- Aba Detalhes com console, lançamento, gênero, publicadora, desenvolvedora, número de jogadores e links para a página do jogo, o fórum e o guia no RetroAchievements.
- **Amigos:** seguindo e seguidores (com o selo "Mútuo") e os jogos de cada amigo com o progresso hardcore dos dois.
- **Card do Perfil:** pontos, RetroPoints, rank e masterizados, com um aviso e o botão "Atualizar key" se a key parar de funcionar.

## Chaves de API

O app usa a [Steam Web API](https://partner.steamgames.com/doc/webapi) e a [Web API do RetroAchievements](https://api-docs.retroachievements.org/).

**Nenhuma chave de API é embutida nem é necessária para compilar o app.** O login pede as suas próprias chaves. Elas ficam só no seu aparelho, criptografadas, no armazenamento seguro (Android Keystore, via `expo-secure-store`), e nunca vão para logs. Você pode remover uma chave a qualquer momento pela tela de login.

### Chave da Steam Web API

1. Acesse <https://steamcommunity.com/dev/apikey>
2. Entre com a sua conta Steam
3. Informe um domínio (qualquer valor funciona, por exemplo `localhost`) e clique em **Registrar chave da Web API**
4. Cole a chave (32 caracteres hexadecimais) no app. Ela é salva assim que o formato bate.

> O perfil Steam e os detalhes de jogo precisam estar **públicos** para o app ler seus jogos e conquistas.

### Chave da Web API do RetroAchievements

1. Entre em <https://retroachievements.org> e abra **Settings → Keys**
2. Cole a Web API Key (32 letras e números) no app
3. Informe o seu nome de usuário do RetroAchievements

> Use a chave da sua própria conta: as listas de seguindo e seguidores sempre vêm do dono da chave. A conta é ligada pelo ULID, então trocar o nome de usuário no site não quebra nada.

## Requisitos

- [Node.js](https://nodejs.org/) LTS (20+)
- npm (já vem com o Node.js)
- Para builds **locais** Android: [Android Studio](https://developer.android.com/studio) com Android SDK e JDK 17
- Para builds **EAS (nuvem)**: uma [conta Expo](https://expo.dev/) e o pacote `eas-cli`
- Para usar o app: uma conta Steam com chave da Web API e/ou uma conta RetroAchievements com Web API Key

## Começando (desenvolvimento)

```bash
# 1. Instale as dependências
npm install

# 2. Inicie o servidor de desenvolvimento
npm start          # ou: npx expo start
```

O Expo Go funciona, mas sem a configuração nativa própria do app (veja [Limite de rede do Android](#limite-de-rede-do-android)), então a sincronização da Steam fica mais lenta nele. Um build de desenvolvimento (`npm run android`) tem tudo.

Outros comandos úteis:

```bash
npm run lint              # ESLint
npm run android           # expo run:android (build de dev local)
```

## Compilando o APK

Existem duas formas de gerar um APK instalável.

### Opção 1 — Build EAS na nuvem

O [EAS Build](https://docs.expo.dev/build/introduction/) compila o app nos servidores da Expo, sem precisar de ferramentas Android locais.

```bash
# 1. Instale o EAS CLI
npm install -g eas-cli

# 2. Entre na sua conta Expo
eas login

# 3. Vincule o projeto à SUA conta Expo
eas init

# 4. Gere um APK de teste interno (perfil "preview")
npm run build:preview
# equivalente a: eas build --platform android --profile preview
```

> O `app.config.js` traz o project id do EAS do autor (`extra.eas.projectId`). Rode `eas init` para seus builds ficarem vinculados à sua própria conta Expo.

Os perfis de build estão definidos no [`eas.json`](./eas.json):

| Perfil | Distribuição | Saída | Uso |
| --- | --- | --- | --- |
| `dev` | interna | APK | client de desenvolvimento |
| `preview` | interna | APK | build de teste instalável |
| `production` | loja | AAB | release na Google Play |

> O AAB (`production`) não pode ser instalado diretamente. Envie-o para o Play Console.

### Opção 2 — Build local com Gradle

O `eas build --local` só roda em macOS ou Linux. No Windows, use o Gradle direto:

```bash
# 1. Instale as dependências
npm install

# 2. Gere o projeto nativo android/ (necessário depois de mudar o app.config.js, plugins ou pacotes nativos)
npx expo prebuild --platform android --clean

# 3. Gere o APK de release
cd android
./gradlew assembleRelease          # Windows: .\gradlew.bat assembleRelease
```

O APK sai em `android/app/build/outputs/apk/release/app-release.apk` (assinado com a chave de debug, o que basta para instalar e testar). Para instalar num celular conectado por USB: `adb install -r android/app/build/outputs/apk/release/app-release.apk`.

**Arquitetura.** O APK é gerado só para celulares ARM de 64 bits (`arm64-v8a`, quase todo Android atual), definido pelo [`plugins/withArchitectures.js`](./plugins/withArchitectures.js). Para um emulador x86, faça um build pontual com `-PreactNativeArchitectures=x86`.

**Builds locais mais rápidos.** O primeiro build de release ainda pode levar alguns minutos. Para acelerar:
- Use `--parallel --build-cache` no `assembleRelease`.
- Não rode `prebuild --clean` nem `gradlew clean` se nada nativo mudou, para o Gradle aproveitar o cache.
- No Windows, adicione a pasta do projeto e a `%USERPROFILE%\.gradle` às exclusões do antivírus (Segurança do Windows).

> O application id do Android (`com.casualnomore.app`) está definido no `app.config.js`. Altere-o lá antes de publicar com a sua identidade.

### Limite de rede do Android

O React Native faz todo `fetch` no Android pelo OkHttp, que só permite 5 requisições simultâneas por servidor. Quase todas as chamadas da Steam vão para o mesmo servidor, então a sincronização da biblioteca ficaria na fila. O config plugin [`plugins/withOkHttpConcurrency.js`](./plugins/withOkHttpConcurrency.js) aumenta esse limite (configurado no `app.config.js`). Ele é aplicado pelo `expo prebuild` e pelos builds do EAS.

## Estrutura do projeto

```
app/                     # telas do expo-router: login, abas (jogos, amigos, perfil)
plugins/                 # config plugins do Expo (limite de requisições do OkHttp)
src/
  api/                   # clients das Web APIs da Steam e do RetroAchievements
  components/            # componentes compartilhados (card de jogo, painéis, diálogos...)
    login/               # formulário de login comum às duas plataformas + config de cada uma
    ui/                  # primitivos do design system (texto, botão, chip, progresso...)
  config/                # armazenamento das chaves de API (seguro, uma por plataforma)
  context/               # auth (contas conectadas e salvas) e preferências
  database/              # cache em SQLite (db.js: Steam, raDb.js: RetroAchievements)
  hooks/                 # useLibrary, useAchievements, ...
  i18n/                  # traduções (pt / en) + contexto de idioma
  platforms/             # um módulo por plataforma (adaptador, sincronização, dados do jogo)
    steam/
    ra/
  screens/               # telas (biblioteca, jogo, amigos, perfil...)
  theme/                 # cores e fontes
  utils/                 # utilitários (datas, tempo de jogo, toast, CDN...)
assets/                  # imagens e ícones
app.config.js            # config do app Expo (nome, versão, ícones, plugins)
eas.json                 # perfis de build EAS
RETROACHIEVEMENTS_PLAN.md  # notas de projeto e progresso da integração com o RetroAchievements
```

## Stack de tecnologias

- [Expo SDK 53](https://expo.dev/) / React Native 0.79 (nova arquitetura)
- [expo-router](https://docs.expo.dev/router/introduction/) e React Navigation
- [NativeWind](https://www.nativewind.dev/) (Tailwind CSS para React Native)
- [FlashList](https://shopify.github.io/flash-list/) para listas longas
- [react-native-svg](https://github.com/software-mansion/react-native-svg) e expo-linear-gradient
- Fontes Inter e Space Grotesk ([@expo-google-fonts](https://github.com/expo/google-fonts))
- SQLite via [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/) para as chaves de API, AsyncStorage para contas e preferências

## Solução de problemas

- **"Informe sua chave de API Steam" / "Informe sua Web API Key do RetroAchievements"** — não há chave salva para essa plataforma. Adicione a sua na tela de login.
- **Lista de jogos da Steam vazia** — seu perfil ou os detalhes de jogo estão privados. Deixe como **público** na Steam e puxe para baixo para atualizar.
- **Lista de amigos da Steam vazia** — sua lista de amigos está em *Somente amigos*. Mude para **Público** nas configurações de privacidade da Steam.
- **"Chave inválida" no RetroAchievements, ou "Sua Web API Key não funciona mais" no Perfil** — a chave foi trocada ou revogada no site. Toque em **Atualizar key** e cole a nova, de Settings → Keys.
- **"Usuário não encontrado no RetroAchievements"** — confira o nome de usuário (maiúsculas e minúsculas não importam, mas ele precisa existir).
- **"Esta conta está fora do ranking"** — a conta do RetroAchievements está fora do ranking, então alguns dados podem não aparecer.
- **Biblioteca do RetroAchievements vazia** — os jogos só aparecem depois de jogados num emulador com a sua conta.
- **Erros de build no EAS** — confira se está na versão mais recente do `eas-cli` e se a restrição de `cli.version` no `eas.json` é compatível.

## Licença

[MIT](./LICENSE) © 2026 Richard Pacco. Você pode usar, modificar e compartilhar o código, desde que mantenha o aviso de copyright e a licença.
