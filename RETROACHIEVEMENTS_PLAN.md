# Integração com o RetroAchievements: plano de implementação

> Branch: `integracao-RA` (criada a partir de `UI-rework`)
> Objetivo: um app que trata **Steam** e **RetroAchievements (RA)** como plataformas iguais. O usuário pode conectar uma das duas ou as duas, ver a biblioteca unificada, as conquistas, o perfil e os amigos de cada uma.

Este documento serve de consulta durante a implementação. Ele está dividido em:

1. [Como a API do RA funciona](#1-como-a-api-do-ra-funciona)
2. [Diferenças entre Steam e RA que afetam o app](#2-diferenças-entre-steam-e-ra-que-afetam-o-app)
3. [Arquitetura alvo](#3-arquitetura-alvo)
4. [Modelo de dados](#4-modelo-de-dados)
5. [Etapas de implementação](#5-etapas-de-implementação) (0 a 7)
6. [Textos novos (i18n)](#6-textos-novos-i18n)
7. [Riscos e cuidados](#7-riscos-e-cuidados)
8. [Decisões em aberto](#8-decisões-em-aberto)
9. [Referências](#9-referências)

---

## 1. Como a API do RA funciona

### 1.1 Autenticação

- Não tem OAuth. Cada usuário tem uma **Web API Key** pessoal em <https://retroachievements.org/settings>, na seção "Keys".
- A key vai no parâmetro `y` de toda requisição.
- O usuário consultado vai no parâmetro `u`, que aceita o **nome de usuário ou o ULID**.
- O nome de usuário pode mudar, então a recomendação oficial é buscar o perfil uma vez pelo nome, guardar o `ULID` e usar o ULID dali em diante.
- A key deve ser tratada como senha. Vamos guardá-la no SecureStore, como já é feito com a key da Steam.
- Com a key de um usuário dá para consultar **outros usuários** (perfil, biblioteca, progresso). É isso que permite a parte de amigos e de jogos em comum.

### 1.2 URLs

| O quê | URL |
|---|---|
| Base da API | `https://retroachievements.org/API/API_<Nome>.php?y=<key>&...` |
| Imagens de jogo (`ImageIcon`, `ImageBoxArt`, `ImageTitle`, `ImageIngame`) e avatar (`UserPic`) | `https://media.retroachievements.org` + caminho retornado (ex.: `/Images/074560.png`, `/UserPic/Nome.png`) |
| Conquista desbloqueada | `https://media.retroachievements.org/Badge/<BadgeName>.png` |
| Conquista bloqueada (cinza) | `https://media.retroachievements.org/Badge/<BadgeName>_lock.png` |
| Página do jogo no site | `https://retroachievements.org/game/<GameID>` |
| Página da conquista | `https://retroachievements.org/achievement/<ID>` |
| Página do usuário | `https://retroachievements.org/user/<User>` |
| Fórum do jogo | `https://retroachievements.org/viewtopic.php?t=<ForumTopicID>` |

### 1.3 Formato das respostas

- As chamadas HTTP diretas devolvem chaves em **PascalCase** (`GameID`, `NumAwarded`...). Os exemplos em camelCase da documentação são das bibliotecas oficiais (Node/Kotlin), que **não** vamos usar: o `fetch` puro é suficiente e evita uma dependência.
- Algumas listas vêm como **objeto indexado por ID** e não como array (ex.: `Achievements` em `GetGameInfoAndUserProgress`). É preciso converter com `Object.values()`.
- Números às vezes vêm como string (`"1"`). Converter com `Number()` no adaptador.
- As datas vêm como string. Algumas usam ISO com fuso (`2023-10-27T02:52:34+00:00`) e outras usam `YYYY-MM-DD HH:MM:SS` sem fuso (UTC). Criar um helper `parseRaDate()` que trata os dois formatos.

### 1.4 Limite de requisições

- A documentação **não publica um limite**. Para não arriscar bloqueio:
  - no máximo **3 requisições simultâneas** para o RA (fila própria, separada da fila da Steam)
  - em erro **429**, esperar e tentar de novo com backoff (1 s, 2 s, 4 s; no máximo 3 tentativas)
  - cache no banco e nada de buscar de novo o que já está salvo e atualizado
- O **turbo** continua valendo só para a Steam.

### 1.5 Endpoints que vamos usar

| Endpoint | Parâmetros | Para quê | Campos que interessam |
|---|---|---|---|
| `API_GetUserProfile` | `u` | Validar o login, pegar o ULID, avatar e pontos | `User`, `ULID`, `UserPic`, `MemberSince`, `RichPresenceMsg`, `LastGameID`, `TotalPoints`, `TotalSoftcorePoints`, `TotalTruePoints`, `Motto`, `Untracked` |
| `API_GetUserCompletionProgress` | `u`, `c` (máx. 500), `o` | **Biblioteca inteira** com progresso, paginada | `Count`, `Total`, `Results[]` com `GameID`, `Title`, `ImageIcon`, `ConsoleID`, `ConsoleName`, `MaxPossible`, `NumAwarded`, `NumAwardedHardcore`, `MostRecentAwardedDate`, `HighestAwardKind`, `HighestAwardDate` |
| `API_GetGameInfoAndUserProgress` | `u`, `g`, `a=1` | Tela do jogo: detalhes e conquistas do usuário | Ver 1.6 |
| `API_GetUserRecentlyPlayedGames` | `u`, `c` (máx. 50), `o` | Seção "Jogados recentemente" | `GameID`, `Title`, `ConsoleName`, `ImageIcon`, `ImageTitle`, `ImageIngame`, `ImageBoxArt`, `LastPlayed`, `NumPossibleAchievements`, `NumAchieved`, `NumAchievedHardcore`, `PossibleScore`, `ScoreAchieved`, `ScoreAchievedHardcore` |
| `API_GetUserSummary` | `u`, `g=0`, `a=0` | Rank e status no perfil (a documentação avisa que é **lento**: chamar só no perfil e com `g=0&a=0`) | `Rank`, `TotalRanked`, `Status`, `RichPresenceMsg`, `LastGame` |
| `API_GetUserAwards` | `u` | Medalhas no perfil | `TotalAwardsCount`, `MasteryAwardsCount`, `CompletionAwardsCount`, `BeatenHardcoreAwardsCount`, `BeatenSoftcoreAwardsCount`, `VisibleUserAwards[]` |
| `API_GetUsersIFollow` | `c` (máx. 500), `o` | Amigos: quem eu sigo (sempre da conta dona da key) | `Results[]` com `User`, `ULID`, `Points`, `PointsSoftcore`, `IsFollowingMe` |
| `API_GetUsersFollowingMe` | `c` (máx. 500), `o` | Amigos: quem me segue | `Results[]` com `User`, `ULID`, `Points`, `PointsSoftcore`, `AmIFollowing` |
| `API_GetConsoleIDs` | `a=1`, `g=1` | Nomes e ícones dos consoles para o filtro | `ID`, `Name`, `IconURL`, `Active`, `IsGameSystem` |

### 1.6 `GetGameInfoAndUserProgress` em detalhe

**Jogo:** `ID`, `Title`, `ConsoleID`, `ConsoleName`, `ForumTopicID`, `ImageIcon`, `ImageTitle`, `ImageIngame`, `ImageBoxArt`, `Publisher`, `Developer`, `Genre`, `Released`, `ReleasedAtGranularity`, `GuideURL`, `ParentGameID`, `NumDistinctPlayers`, `NumDistinctPlayersCasual`, `NumDistinctPlayersHardcore`, `NumAchievements`.

**Progresso do usuário:** `NumAwardedToUser`, `NumAwardedToUserHardcore`, `UserCompletion`, `UserCompletionHardcore`, `UserTotalPlaytime`, `HighestAwardKind`, `HighestAwardDate`.

**`Achievements`** é um **objeto indexado por ID**. Cada item tem:
`ID`, `Title`, `Description`, `Points`, `TrueRatio`, `BadgeName`, `DisplayOrder`, `type`, `NumAwarded`, `NumAwardedHardcore`, `Author`, `DateCreated`, `DateModified` e, **se o usuário desbloqueou**, `DateEarned` e/ou `DateEarnedHardcore`.

- `type` pode ser `progression`, `win_condition`, `missable` ou `null`.
- `HighestAwardKind` pode ser `mastered`, `completed`, `beaten-hardcore`, `beaten-softcore` ou `null`.
  - **mastered** = 100% em hardcore
  - **completed** = 100% em softcore
  - **beaten** = cumpriu as conquistas de progressão e vitória ("zerou")

---

## 2. Diferenças entre Steam e RA que afetam o app

| Assunto | Steam (hoje) | RetroAchievements | Consequência |
|---|---|---|---|
| Identidade | `steamId` (número de 64 bits) | `ULID` (string estável) + `User` (pode mudar) | As contas passam a ter `platform` + `id` |
| Sincronizar a biblioteca | `GetOwnedGames` + **1 a 3 chamadas por jogo** (schema, conquistas, %) | **1 a 3 chamadas no total** (`GetUserCompletionProgress` paginado) | O RA sincroniza rápido, sem fila por jogo e sem turbo |
| Conquistas por jogo | Buscadas no sync | Buscadas **ao abrir o jogo** (`GetGameInfoAndUserProgress`) | Cache `achievements` + `achievementsStatus` na tabela do RA, preenchido sob demanda |
| Tempo de jogo | `playtime_forever`, `playtime_2weeks` | Não vem na lista; só `UserTotalPlaytime` por jogo | No RA, o card mostra o console no lugar do tempo. A ordenação "Tempo jogado" não se aplica |
| Imagem do jogo | Capsule 231×87 e header 460×215 | Ícone **quadrado 96×96**; box art de tamanho variável; title/ingame são screenshots ~4:3 | O `GameCard` precisa de um modo de imagem quadrada |
| Ícone de conquista | Ícone colorido e `icongray` | `Badge/<BadgeName>.png` e `_lock.png` | Mesma lógica: escolher pelo `achieved` |
| Raridade | `GetGlobalAchievementPercentagesForApp` | `NumAwarded / NumDistinctPlayers` | Calcular no adaptador e gravar em `globalPercent` |
| Modos | Um só | **Hardcore** e **softcore** | Configuração de qual modo conta no progresso |
| Pontos | Não tem | `Points` e `TrueRatio` (pontos ponderados pela raridade) | Mostrar na conquista, no jogo e no perfil |
| Tipos de conquista | Não tem | progression / win_condition / missable | Etiquetas e filtro "Perdíveis" |
| Medalha do card | 100% = medalha | mastered / completed / beaten | Medalhas diferentes por nível |
| Idioma | Conquistas traduzidas (parâmetro `l`) | Só em inglês | No RA, ignorar `lang`/`detailsLang`. Não buscar de novo ao trocar o idioma |
| Descrição do jogo | HTML da loja | Não tem | Na aba Detalhes do RA, só blocos de informação e links |
| Amigos | Lista de amigos (mútua) | Seguindo / seguidores (não mútua) | Segmento "Seguindo / Seguidores" |
| Itens que não são jogos | — | Hubs, Events, `~Hack~`, `~Homebrew~`, `[Subset - ...]` | Filtros para esconder hacks e subsets; ignorar o console Events/Hubs |

---

## 3. Arquitetura alvo

### 3.1 Estrutura de pastas (novos itens marcados com ★)

```
src/
  api/
    steam.js
    retroachievements.js        ★ cliente HTTP do RA (fila, retry, helpers de mídia)
  config/
    apiKeyStore.js              (passa a receber a plataforma)
  context/
    AuthContext.jsx             (contas multi-plataforma)
    SettingsContext.jsx         ★ preferências (modo hardcore/softcore, esconder hacks/subsets)
  database/
    db.js                       (Steam, continua igual, e genericiza o pin)
    raDb.js                     ★ tabela ra_games_<ulid> e ra_friends_<ulid>
  platforms/                    ★ camada de plataforma
    index.js                    ★ PLATFORMS = { steam, ra }, getPlatform(id)
    steam/
      adapter.js                ★ jogo Steam → LibraryGame; conquistas → formato comum
      useSteamLibrary.js        ★ lógica de sync que hoje está dentro do GameList
    ra/
      adapter.js                ★ jogo RA → LibraryGame; conquistas RA → formato comum
      useRaLibrary.js           ★ sync paginado do RA
      consoles.js               ★ cache dos consoles (GetConsoleIDs)
  hooks/
    useAchievements.js          (escolhe a fonte pela plataforma)
    useLibrary.js               ★ junta as bibliotecas das contas conectadas
  components/
    GameCard.jsx                (recebe LibraryGame)
    PlatformBadge.jsx           ★ selo "Steam"/"RA" no card
    AwardMedal.jsx              ★ medalha por nível (mastered/completed/beaten/100%)
    AchievementTypeTag.jsx      ★ etiqueta Progressão/Vitória/Perdível
    PlatformPicker.jsx          ★ escolha de plataforma (login e "conectar outra")
  utils/
    raDate.js                   ★ parseRaDate
```

### 3.2 Fluxo dos dados

```
                ┌──────────── AuthContext.accounts ────────────┐
                │  steam: { steamId } | null                   │
                │  ra:    { user, ulid, userPic } | null       │
                └───────────────┬───────────────┬──────────────┘
                                │               │
                     useSteamLibrary      useRaLibrary
                    (fila por jogo,      (1–3 páginas de
                     turbo, db.js)        completion, raDb.js)
                                │               │
                     steam/adapter.js     ra/adapter.js
                                └──────┬────────┘
                                       ▼
                          useLibrary → LibraryGame[]
                                       ▼
          GameList (chips de plataforma, filtros, ordenação) → GameCard
                                       ▼
                navigate("GameScreen", { platform, id })
                                       ▼
          GameScreen → useAchievements(platform, id) → adaptador → abas
```

**Regra principal:** as telas não sabem de onde vem o dado. Elas só usam `LibraryGame` e `Achievement` (seção 4). Tudo o que é específico da plataforma fica no adaptador ou no hook da plataforma. Quando uma tela realmente precisa de algo só do RA (pontos, tipo da conquista), o campo é **opcional** no formato comum e a tela mostra se ele existir.

---

## 4. Modelo de dados

### 4.1 Contas (`AuthContext`)

```js
// AsyncStorage "@accounts"
{
  steam: { steamId: "7656119...", name: "Fulano", avatar: "https://..." } | null,
  ra:    { user: "Fulano", ulid: "01H...", userPic: "/UserPic/Fulano.png" } | null,
}
```

- `"@steam_id"` vira `accounts.steam.steamId`. Sem migração: instalação limpa.
- `@saved_accounts` (contas recentes no login) passa a guardar `{ platform, id, name, avatar }`.
- API do contexto:
  - `accounts`, `loading`
  - `connect(platform, account)`, `disconnect(platform)`
  - `hasAnyAccount`
  - compatibilidade: `steamId` continua exposto como `accounts.steam?.steamId` para mexer menos nas telas da Steam

### 4.2 Keys (`apiKeyStore`)

| Plataforma | Chave no SecureStore |
|---|---|
| Steam | `steam_api_key` (como hoje) |
| RA | `ra_api_key` |

Funções: `getApiKey(platform)`, `loadApiKeys()`, `saveApiKey(platform, key)` e `deleteApiKey(platform)`.

### 4.3 Tabela `ra_games_<ulid>`

O `ulid` só tem letras e números, então pode entrar no nome da tabela, como já fazemos com o steamId.

| Coluna | Tipo | Origem |
|---|---|---|
| `gameId` | INTEGER PK | `GameID` |
| `title` | TEXT | `Title` |
| `consoleId` | INTEGER | `ConsoleID` |
| `consoleName` | TEXT | `ConsoleName` |
| `imageIcon` | TEXT | `ImageIcon` (caminho relativo) |
| `imageTitle` | TEXT | de `GameInfo` / `RecentlyPlayed` |
| `imageIngame` | TEXT | idem |
| `imageBoxArt` | TEXT | idem |
| `maxPossible` | INTEGER | `MaxPossible` |
| `numAwarded` | INTEGER | `NumAwarded` (softcore + hardcore) |
| `numAwardedHardcore` | INTEGER | `NumAwardedHardcore` |
| `highestAwardKind` | TEXT | `HighestAwardKind` |
| `highestAwardDate` | TEXT | `HighestAwardDate` |
| `mostRecentAwardedDate` | TEXT | `MostRecentAwardedDate` |
| `lastPlayed` | TEXT | `RecentlyPlayed.LastPlayed` (quando disponível) |
| `achievements` | TEXT (JSON) | `Achievement[]` já convertidas |
| `achievementsStatus` | TEXT | `pending` / `done` / `error` |
| `achievementsSyncedAt` | INTEGER | timestamp. Usado para saber quando buscar de novo |
| `details` | TEXT (JSON) | publisher, developer, genre, released, guideUrl, forumTopicId, players... |
| `pinned` | INTEGER DEFAULT 0 | local |

> A biblioteca do RA tem **só jogos que o usuário já abriu com o emulador**. Não existe uma "biblioteca comprada" como na Steam.

E `ra_friends_<ulid>`: `ulid` PK, `user`, `profile` (JSON), `games` (JSON da completion progress dele), `relation` (`following` / `follower` / `mutual`).

### 4.4 Formato comum de jogo: `LibraryGame`

O adaptador de cada plataforma produz este objeto. É o único formato que `GameList` e `GameCard` conhecem.

```js
{
  key: "steam:440" | "ra:14402",   // único entre plataformas; usado como keyExtractor
  platform: "steam" | "ra",
  id: 440,                          // appid ou GameID
  name: "Team Fortress 2",
  image: { uri, shape: "capsule" | "square" },  // card/compact
  gridImage: { uri, shape: "header" | "square" },
  subtitle: "120 h jogadas" | "Mega Drive / Genesis",
  unlocked: 18, total: 28, percent: 64.3,
  award: null | "complete" | "mastered" | "completed" | "beaten",
  pinned: true,
  sortKeys: {
    recent: 1698374400000,          // Steam: rtime_last_played / RA: lastPlayed ou mostRecentAwardedDate
    playtime: 7200 | null,          // RA: null (não ordena por tempo)
    name: "team fortress 2",
  },
  console: { id: 1, name: "Mega Drive / Genesis" } | null,
  flags: { hack: false, subset: false, homebrew: false },
  status: "pending" | "done" | "error",
}
```

- **Steam:** `award` = `"complete"` quando 100%.
- **RA:** `award` vem de `highestAwardKind`. `unlocked` depende do modo escolhido (hardcore → `numAwardedHardcore`, softcore → `numAwarded`).

### 4.5 Formato comum de conquista: `Achievement`

Mantém os campos de hoje, que já são usados por `AchievementsTab`, `AchievementSheet` e `rarity.js`, e adiciona campos opcionais.

| Campo | Steam | RA |
|---|---|---|
| `apiname` | `name` | `String(ID)` |
| `name` | `displayName` | `Title` |
| `description` | `description` | `Description` |
| `icon` | ícone ou `icongray` | `Badge/<BadgeName>.png` ou `_lock.png` |
| `achieved` | `achieved === 1` | conforme o modo: hardcore → `!!DateEarnedHardcore`; softcore → `!!(DateEarned \|\| DateEarnedHardcore)` |
| `unlocktime` | segundos | `parseRaDate(DateEarnedHardcore \|\| DateEarned) / 1000` |
| `globalPercent` | da API | `NumAwarded / NumDistinctPlayers * 100` (no modo hardcore: `NumAwardedHardcore / NumDistinctPlayersHardcore`) |
| `points` ★ | — | `Points` |
| `trueRatio` ★ | — | `TrueRatio` |
| `hardcore` ★ | — | `!!DateEarnedHardcore` |
| `type` ★ | — | `type` |
| `order` ★ | — | `DisplayOrder` |

> Guardar no banco **os dois estados** (`earned`, `earnedHardcore`) e calcular `achieved` na leitura. Assim, trocar entre hardcore e softcore não exige buscar de novo.

### 4.6 Preferências (`SettingsContext`, AsyncStorage `@settings`)

| Chave | Valores | Padrão sugerido |
|---|---|---|
| `raMode` | `"hardcore"` / `"softcore"` | `"hardcore"` |
| `hideHacks` | bool | `true` |
| `hideSubsets` | bool | `false` |
| `libraryPlatform` | `"all"` / `"steam"` / `"ra"` | `"all"` |

---

## 5. Etapas de implementação

Cada etapa termina com o app funcionando e vira um commit. A Steam **não pode quebrar** em nenhuma delas.

### Etapa 0 — Base multi-plataforma (refatoração sem mudança visual)

**Objetivo:** preparar a estrutura. Ao final, o app funciona exatamente igual, só com a Steam.

**Arquivos**

- `src/context/AuthContext.jsx`: `accounts`, `connect`, `disconnect`, `hasAnyAccount`. Continua expondo `steamId`.
- `src/config/apiKeyStore.js`: as funções passam a receber `platform`. Atualizar quem chama: `steam.js`, `login.jsx`, `index.jsx`, `Profile.jsx`, `ClearDbModal`, `RemoveAccountModal`.
- `app/index.jsx`: vai para as abas se `hasAnyAccount` e a key da plataforma conectada existir.
- `src/platforms/index.js` e `src/platforms/steam/adapter.js`: `toLibraryGame(row)`.
- `src/platforms/steam/useSteamLibrary.js`: **extrair** do `GameList.jsx` (hoje com ~1070 linhas) toda a lógica de sync: `loadGenRef`, `activeLoadRef`, turbo, `getStoreAssets`, `deleteGamesNotOwned`, "jogados recentemente". O hook devolve `{ games, syncState, refresh, turbo, toggleTurbo }`.
- `src/hooks/useLibrary.js`: por enquanto só repassa a lista da Steam convertida para `LibraryGame[]`.
- `src/components/GameCard.jsx`: recebe `LibraryGame` (`image`, `subtitle`, `award`). Remover as referências diretas a `appid`, `capsuleUrl` e `playtime`.
- `src/screens/GameList.jsx`: usa `useLibrary`. `keyExtractor` passa a ser `game.key`. Filtros e ordenação usam `sortKeys`.
- Navegação: `navigate("GameScreen", { platform, id })` em `GameList.jsx:336` e `GameCard.jsx:52`. `GameScreen.jsx:33` lê `{ platform, id }`.
- `togglePin`: chamar via plataforma (`platforms[platform].togglePin(account, id)`).

> **Feito.** As contas salvas do login (`@saved_accounts`) continuam só da Steam e ganham o campo `platform` na etapa 1, junto com o novo login. As contas conectadas agora ficam em `@accounts` (o antigo `@steam_id` não é lido: instalação limpa).

**Pronto quando**
- [ ] Login e logout da Steam funcionam como antes
- [ ] Biblioteca, os três modos de exibição, filtros, ordenação, turbo e pin iguais a antes
- [ ] Tela do jogo, conquistas e detalhes iguais
- [ ] `npx expo lint` sem erros novos

### Etapa 1 — Cliente da API do RA e login

**Arquivos**

`src/api/retroachievements.js`:
- `raFetch(endpoint, params)`: monta a URL com `y`, passa por uma fila com no máximo 3 requisições, faz retry em 429/5xx e trata 401 com uma mensagem de key inválida.
- `raMedia(path)`, `raBadge(badgeName, locked)`.
- `getUserProfile(u)`, `getUserCompletionProgress(u)` (pagina até `Count < 500`), `getGameInfoAndUserProgress(u, g)`, `getUserRecentlyPlayedGames(u, c=50)`, `getUserSummary(u)`, `getUserAwards(u)`, `getUsersIFollow()`, `getUsersFollowingMe()`, `getConsoleIds()`.

`src/utils/raDate.js`: `parseRaDate(str)`.

`app/(auth)/login.jsx`:
- Primeira tela: escolha da plataforma com o componente novo `PlatformPicker`.
- Fluxo do RA em passos, no mesmo estilo do da Steam:
  1. explicar onde pegar a key, com um botão que abre `retroachievements.org/settings`
  2. campo de usuário e campo de key (com mostrar/ocultar)
  3. validar com `getUserProfile(user)`. Se der certo, guardar `ULID`, `User` e `UserPic` e chamar `connect("ra", ...)`
- Mostrar a mensagem de erro certa para usuário inexistente, key inválida (401) ou falta de rede.
- Contas recentes: listar as das duas plataformas, cada uma com o seu selo.

**Pronto quando**
- [ ] Login só com RA funciona: entra nas abas, e as telas ainda sem suporte mostram o estado vazio sem erro
- [ ] Key errada mostra um erro claro e não salva nada
- [ ] Logout do RA apaga `ra_api_key` e `accounts.ra`

### Etapa 2 — Biblioteca do RA

**Arquivos**

- `src/database/raDb.js`:
  - `ensureRaTable(ulid)`, `saveRaGamesBatch`, `getAllRaGames`, `getRaGame`
  - `updateRaGameAchievements`, `updateRaGameDetails`, `toggleRaPin`, `deleteRaGamesNotPresent`
  - Usar o mesmo `runInTransaction` do `db.js` (exportar a função) para respeitar a fila de transações.
- `src/platforms/ra/adapter.js`: `toLibraryGame(row, settings)`. Detecta hacks, homebrew e subsets pelo título (`~Hack~`, `~Homebrew~`, `[Subset`).
- `src/platforms/ra/useRaLibrary.js`:
  - abre com o cache do banco
  - sincroniza com `getUserCompletionProgress` (todas as páginas) e grava em lote
  - depois busca `getUserRecentlyPlayedGames(50)` para preencher `lastPlayed` e as imagens maiores
  - não tem turbo nem fila por jogo
- `src/platforms/ra/consoles.js`: busca `GetConsoleIDs` uma vez e guarda no AsyncStorage (os consoles mudam raramente).
- `src/hooks/useLibrary.js`: junta `steam` e `ra` conforme as contas conectadas. Também une o estado de sincronização (`syncing` se qualquer uma estiver sincronizando).
- `src/screens/GameList.jsx`:
  - chip de plataforma (Todas / Steam / RA), visível só com as duas contas conectadas
  - o card de sincronização mostra o progresso de cada plataforma; o botão Turbo aparece só se a Steam estiver sincronizando
  - "Jogados recentemente" mistura as duas plataformas pelo `sortKeys.recent`
- `src/components/FilterSortSheet.jsx`:
  - filtro de **Console** (multi-seleção), só com jogos do RA visíveis
  - opções "Esconder hacks" e "Esconder subsets"
  - a ordenação "Tempo jogado" fica desabilitada ou ignora jogos do RA (vão para o fim)
- `src/components/GameCard.jsx`:
  - `image.shape === "square"`: no modo **card**, o ícone quadrado fica no lugar do capsule (mesma altura, largura = altura); no modo **grade**, o ícone ocupa a área quadrada inteira; no modo **compacto**, nada muda
  - `PlatformBadge` no canto, só quando o filtro é "Todas"
  - `AwardMedal` no lugar do `completion_icon.png` (a Steam continua usando a medalha atual)
- `src/components/AwardMedal.jsx`:
  - Steam 100% → medalha atual
  - RA **mastered** → dourada
  - RA **completed** → prata
  - RA **beaten** → ícone de bandeira
  - (cores no `colors.js`)

**Pronto quando**
- [ ] Conta só RA: a biblioteca carrega em poucos segundos, com ícones, console e progresso certos
- [ ] Duas contas: lista misturada, chip de plataforma funciona, busca encontra jogos das duas
- [ ] Filtro por console e esconder hacks funcionam
- [ ] Pin funciona para os jogos do RA e persiste
- [ ] Puxar para atualizar sincroniza as duas plataformas

### Etapa 3 — Tela do jogo do RA

**Arquivos**

- `src/hooks/useAchievements.js`: recebe `{ platform, id }`. No RA:
  - usa o cache se `achievementsStatus === "done"` e `achievementsSyncedAt` tem menos de X minutos
  - senão busca `getGameInfoAndUserProgress(ulid, id)`
  - converte com `ra/adapter.toAchievements(info, settings.raMode)` e grava `achievements` + `details` + imagens
  - também atualiza `numAwarded`, `numAwardedHardcore` e `highestAwardKind` na linha do jogo, para a biblioteca refletir o resultado ao voltar
  - **não** buscar de novo ao trocar o idioma (o RA só tem inglês)
- `src/screens/GameScreen.jsx`:
  - topo: `ImageTitle` ou `ImageIngame` (screenshot) como fundo, com o `ImageIcon` sobreposto
  - subtítulo: console
  - no RA, mostrar **pontos ganhos / pontos totais** ao lado da porcentagem
- `src/screens/AchievementsTab.jsx`:
  - linha da conquista: pontos (ex.: "25 pts"), selo **HC** quando `hardcore`, `AchievementTypeTag` quando houver `type`
  - novo chip **"Perdíveis"** (só no RA e só se houver conquistas `missable`)
  - ordenações:
    - **Padrão** (`DisplayOrder`, que no RA é a ordem pensada pelo autor)
    - **Raridade**
    - **Pontos**
    - **Data de desbloqueio**
- `src/components/AchievementSheet.jsx`: mostrar pontos, TrueRatio, tipo e as datas de desbloqueio softcore e hardcore. Botão "Ver no RetroAchievements" (`/achievement/<ID>`). A busca no Google/ChatGPT continua igual.
- `src/screens/GameDetailsTab.jsx` passa a decidir o conteúdo pela plataforma:
  - **Steam:** como está hoje
  - **RA:**
    - botões: **Ver no RetroAchievements**; **Fórum** (se houver `ForumTopicID`); **Guia** (se houver `GuideURL`); HowLongToBeat (busca pelo nome, como na Steam)
    - blocos: Console, Lançamento, Gênero, Publisher, Developer, Jogadores (hardcore / total)
    - sem a seção "Sobre o jogo"
- `src/components/AchievementTypeTag.jsx`:
  - Progressão → azul, ícone `flag-outline`
  - Vitória → dourado, ícone `trophy-outline`
  - Perdível → vermelho, ícone `alert-circle-outline`

**Pronto quando**
- [ ] Abrir um jogo do RA mostra as conquistas com os ícones certos (bloqueadas em cinza)
- [ ] Trocar hardcore/softcore muda o progresso sem buscar de novo
- [ ] Raridade, pontos e tipos aparecem
- [ ] Ao voltar para a biblioteca, o card mostra o progresso atualizado
- [ ] A tela de jogo da Steam continua idêntica

### Etapa 4 — Perfil e conexão da segunda plataforma

**Arquivos**

- `src/screens/Profile.jsx`:
  - um card por conta conectada
  - card do RA:
    - avatar (`raMedia(UserPic)`), nome, motto, membro desde
    - **pontos hardcore**, **softcore** e **TruePoints**
    - **rank** (`Rank / TotalRanked`, de `GetUserSummary`)
    - status / RichPresence
  - linha de medalhas (`GetUserAwards`): masters, completions, beaten (HC/SC)
  - botão **"Conectar Steam"** / **"Conectar RetroAchievements"** para a plataforma que falta, abrindo o fluxo de login da etapa 1 já na plataforma certa
  - "Remover conta" separado por plataforma
- Seção de **Configurações** no perfil: modo do RA (hardcore/softcore), esconder hacks, esconder subsets.
- `src/components/ClearDbModal.jsx`: apaga as tabelas das duas plataformas.
- `src/components/RemoveAccountModal.jsx`: recebe `platform`.
- `src/components/AboutModal.jsx`: crédito "Dados de conquistas retro: RetroAchievements.org".

**Pronto quando**
- [ ] Com uma conta, dá para conectar a outra sem sair
- [ ] Remover uma plataforma mantém a outra funcionando
- [ ] O perfil do RA mostra pontos, rank e medalhas

### Etapa 5 — Amigos do RA e jogos em comum

**Arquivos**

- `src/screens/Friends.jsx`:
  - segmento **Steam / RA** (só com as duas contas)
  - no RA, um segundo segmento: **Seguindo / Seguidores** (`GetUsersIFollow` / `GetUsersFollowingMe`), com selo "Mútuo" quando `IsFollowingMe` / `AmIFollowing`
  - linha: avatar (`/UserPic/<User>.png`), nome, pontos HC
  - o RA não tem status online na lista; o RichPresence aparece só ao abrir o perfil do amigo
- `src/database/raDb.js`: `ra_friends_<ulid>`.
- `src/screens/CommonGames.jsx`:
  - recebe `{ platform, friendId }` pela rota. Aproveitar para fazer o **E1** (hoje recebe o objeto inteiro do amigo)
  - no RA: `getUserCompletionProgress(friendUlid)` e interseção com a minha biblioteca por `GameID`
  - comparação lado a lado: meu % × % dele, nível de medalha dos dois
  - "Todos os jogos dele": a lista inteira dele

**Pronto quando**
- [ ] A lista de seguindo e seguidores do RA carrega e fica em cache
- [ ] Os jogos em comum aparecem com o progresso dos dois
- [ ] Os amigos da Steam continuam iguais

### Etapa 6 — Acabamento

- [ ] Traduções PT/EN de todos os textos novos (seção 6)
- [ ] Estados vazios do RA: "Você ainda não jogou nada com RetroAchievements", com um link para o site
- [ ] Mensagens de erro: key revogada (401) → aviso no perfil com "Atualizar key"; usuário "Untracked" → aviso
- [ ] Acessibilidade: `accessibilityLabel` em selos, medalhas e etiquetas
- [ ] Performance: com mais de 1000 jogos do RA + Steam, a busca e os filtros continuam rápidos (memoização em `useLibrary`)
- [ ] Limpeza: código morto que sobrar do `GameList.jsx`, chaves de tradução sem uso
- [ ] Atualizar a versão (ex.: 2.1.0) e o `android.versionCode`

### Etapa 7 — Opcional, depois que tudo estiver estável

- Seção "Últimas conquistas" (`GetUserSummary` com `a=10&g=5`, ou `API_GetAchievementsEarnedBetween`)
- Conquista da semana (`API_GetAchievementOfTheWeek`)
- Lista "Quero jogar" (`API_GetUserWantToPlayList`)
- Comparar o perfil de dois usuários do RA
- Notificar desbloqueios (precisa de fundo/polling; avaliar custo de bateria)

---

## 6. Textos novos (i18n)

Adicionar em `src/i18n/translations.js`, PT e EN:

| Chave | PT | EN |
|---|---|---|
| `platformSteam` | Steam | Steam |
| `platformRa` | RetroAchievements | RetroAchievements |
| `platformAll` | Todas | All |
| `choosePlatform` | Escolha a plataforma | Choose a platform |
| `connectPlatform` | Conectar {{platform}} | Connect {{platform}} |
| `raUsername` | Usuário do RetroAchievements | RetroAchievements username |
| `raApiKey` | Web API Key | Web API Key |
| `raKeyHelp` | Encontre sua key em retroachievements.org → Settings → Keys | Find your key at retroachievements.org → Settings → Keys |
| `raOpenSettings` | Abrir configurações do RA | Open RA settings |
| `raInvalidKey` | Usuário ou key inválidos | Invalid username or key |
| `raUserNotFound` | Usuário não encontrado | User not found |
| `points` | {{n}} pts | {{n}} pts |
| `pointsOf` | {{earned}}/{{total}} pts | {{earned}}/{{total}} pts |
| `truePoints` | TruePoints | TruePoints |
| `hardcore` | Hardcore | Hardcore |
| `softcore` | Softcore | Softcore |
| `raMode` | Modo de progresso do RA | RA progress mode |
| `awardMastered` | Masterizado | Mastered |
| `awardCompleted` | Completo | Completed |
| `awardBeaten` | Zerado | Beaten |
| `typeProgression` | Progressão | Progression |
| `typeWin` | Vitória | Win condition |
| `typeMissable` | Perdível | Missable |
| `filterMissable` | Perdíveis | Missable |
| `console` | Console | Console |
| `hideHacks` | Esconder hacks | Hide hacks |
| `hideSubsets` | Esconder subsets | Hide subsets |
| `viewOnRa` | Ver no RetroAchievements | View on RetroAchievements |
| `forum` | Fórum | Forum |
| `guide` | Guia | Guide |
| `publisher` | Publicadora | Publisher |
| `developer` | Desenvolvedora | Developer |
| `players` | Jogadores | Players |
| `rank` | Rank | Rank |
| `following` | Seguindo | Following |
| `followers` | Seguidores | Followers |
| `mutual` | Mútuo | Mutual |
| `raEmptyLibrary` | Você ainda não jogou nada com RetroAchievements | You haven't played anything with RetroAchievements yet |
| `raCredit` | Dados de conquistas retro: RetroAchievements.org | Retro achievement data: RetroAchievements.org |

---

## 7. Riscos e cuidados

- **Tamanho do `GameList.jsx`**: a etapa 0 tira a lógica de sync dele. É a parte com mais risco de regressão (geração de carga, refresh concorrente, turbo). Testar bem antes de seguir.
- **Limite de requisições não documentado**: fila de 3, backoff em 429, e nada de buscar conquistas de todos os jogos no sync (só ao abrir o jogo).
- **Chaves PascalCase e números como string**: centralizar a conversão nos adaptadores e nunca usar campos crus do RA nas telas.
- **`GetUserSummary` é lento**: chamar só no perfil, com `g=0&a=0`, e com cache.
- **Usuário que muda de nome**: sempre usar o **ULID** nas chamadas e nos nomes de tabela. O `User` serve só para exibir.
- **Usuário "Untracked"** (banido ou oculto do ranking): a API pode retornar dados limitados. Mostrar um aviso e não quebrar.
- **Consoles "Hubs" e "Events"**: aparecem em algumas listas. Filtrar com `GetConsoleIDs?g=1` e ignorar os IDs que não são de jogos.
- **Imagens quadradas e pequenas (96px)**: no modo grade podem ficar borradas em telas grandes. Avaliar usar `ImageBoxArt` quando já estiver no banco (vem do GameInfo e do RecentlyPlayed).
- **Hardcore × softcore**: `NumAwarded` inclui as conquistas em hardcore. **Verificar** com uma conta real se o número da completion progress já soma os dois ou não, antes de fechar a lógica do modo softcore.
- **Privacidade**: a key do RA nunca vai para logs. Não logar URLs completas do `raFetch` (contêm `y=`).
- **Termos de uso**: a API é pública para uso pessoal com a key do próprio usuário, que é o nosso caso. Creditar o RetroAchievements no "Sobre".

---

## 8. Decisões em aberto

Confirmar antes ou durante a etapa indicada. Os padrões abaixo são as recomendações.

| # | Decisão | Recomendação | Afeta a etapa |
|---|---|---|---|
| D1 | Biblioteca misturada com chip de plataforma **ou** uma aba por plataforma | Misturada + chip | 2 |
| D2 | O progresso padrão do RA conta só hardcore ou soft + hard | Hardcore, configurável no perfil | 3 |
| D3 | Pode entrar no app só com o RA (sem Steam) | Sim | 0 e 1 |
| D4 | Esconder hacks e subsets por padrão | Hacks escondidos, subsets visíveis | 2 |
| D5 | Medalhas do RA: ícones próprios por nível ou reutilizar `completion_icon.png` com cores | Reutilizar com cores (dourada, prata, bandeira) | 2 |
| D6 | Fazer mocks das telas novas (login com escolha de plataforma, biblioteca mista, jogo do RA, perfil com dois cards) antes de implementar | Sim, antes da etapa 2 | 1 a 4 |

---

## 9. Referências

- Documentação oficial da API: <https://api-docs.retroachievements.org/>
  - Getting started (autenticação): <https://api-docs.retroachievements.org/getting-started.html>
  - [GetUserProfile](https://api-docs.retroachievements.org/v1/get-user-profile.html)
  - [GetUserCompletionProgress](https://api-docs.retroachievements.org/v1/get-user-completion-progress.html)
  - [GetGameInfoAndUserProgress](https://api-docs.retroachievements.org/v1/get-game-info-and-user-progress.html)
  - [GetUserRecentlyPlayedGames](https://api-docs.retroachievements.org/v1/get-user-recently-played-games.html)
  - [GetUserSummary](https://api-docs.retroachievements.org/v1/get-user-summary.html)
  - [GetUserAwards](https://api-docs.retroachievements.org/v1/get-user-awards.html)
  - [GetUsersIFollow](https://api-docs.retroachievements.org/v1/get-users-i-follow.html)
  - [GetUsersFollowingMe](https://api-docs.retroachievements.org/v1/get-users-following-me.html)
  - [GetConsoleIDs](https://api-docs.retroachievements.org/v1/get-console-ids.html)
- Onde o usuário pega a key: <https://retroachievements.org/settings>
