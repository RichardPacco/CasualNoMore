export const translations = {
    // --- app-level ---
    tabGames: { pt: "Jogos", en: "Games" },
    tabFriends: { pt: "Amigos", en: "Friends" },
    tabProfile: { pt: "Perfil", en: "Profile" },
    splashTagline: { pt: "Nenhum jogo é casual se tem conquistas !", en: "No game is casual if theres cheevos to hunt !" },

    // --- login ---
    loginCacheCleared: { pt: "Todos os dados de cache foram limpos!", en: "All cached data has been cleared!" },
    loginError: { pt: "Erro", en: "Error" },
    loginClearCacheFailed: { pt: "Falha ao limpar o cache.", en: "Failed to clear cache." },
    loginDbCleared: { pt: "Banco limpo!", en: "Database cleared!" },
    loginDbClearedDesc: { pt: "O banco de dados foi zerado.", en: "The database has been reset." },
    loginDbClearFailed: { pt: "Falha ao limpar o banco de dados.", en: "Failed to clear the database." },
    loginInvalidProfile: { pt: "Perfil Steam incorreto — confira o número ou a conexão com a internet.", en: "Invalid Steam profile — check the ID or your internet connection." },
    loginPrivateProfile: { pt: "Seu perfil Steam é privado. Torne-o público para continuar.", en: "Your Steam profile is private. Make it public to continue." },
    loginFetchFailed: { pt: "Falha ao buscar perfil. Veja o console.", en: "Failed to fetch profile. Check the console." },
    loginEmptyInput: { pt: "Informe seu SteamID64 ou vanity URL.", en: "Enter your SteamID64 or vanity URL." },
    loginVanityFailed: { pt: "Não foi possível resolver o vanity URL. Use o SteamID64 (número) se possível.", en: "Could not resolve the vanity URL. Use your SteamID64 (number) if possible." },
    loginConnectionError: { pt: "Verifique conexão com a internet ou reinicie o app. {err}", en: "Check your internet connection or restart the app. {err}" },
    loginCacheLabel: { pt: "Cache", en: "Cache" },
    loginDbLabel: { pt: "DB", en: "DB" },
    loginPublicTip: { pt: "O perfil Steam deve estar público para o aplicativo funcionar", en: "Your Steam profile must be public for the app to work" },
    loginSteamIdLabel: { pt: "Steam URL ou SteamID", en: "Steam URL or SteamID" },
    loginClearDbTitle: { pt: "Limpar Banco de Dados?", en: "Clear Database?" },
    loginClearDbMessage: { pt: "Isso vai apagar todos os jogos salvos e progresso local. Essa ação não pode ser desfeita.", en: "This will delete all saved games and local progress. This action cannot be undone." },
    loginCancel: { pt: "Cancelar", en: "Cancel" },
    loginClear: { pt: "Limpar", en: "Clear" },
    loginAccountsLabel: { pt: "Contas salvas — Toque para entrar - Segure para excluir", en: "Saved accounts — Tap to enter - Hold to delete" },
    loginRemoveAccountTitle: { pt: "Remover conta?", en: "Remove account?" },
    loginRemoveAccountMessage: { pt: "Remover {name} das contas salvas?", en: "Remove {name} from saved accounts?" },
    loginRemove: { pt: "Remover", en: "Remove" },
    loginApiKeyLabel: { pt: "Chave da API Steam", en: "Steam Web API Key" },
    loginGetApiKey: { pt: "Obter chave", en: "Get key" },
    loginApiKeyMissing: { pt: "Informe sua chave de API Steam.", en: "Enter your Steam Web API key." },
    loginApiKeySaved: { pt: "Chave de API salva!", en: "API key saved!" },
    loginApiKeySavedLabel: { pt: "Chave de API salva", en: "API key saved" },
    loginRemoveApiKey: { pt: "Remover chave", en: "Remove key" },
    loginApiKeyRemoved: { pt: "Chave de API removida!", en: "API key removed!" },

    // --- language ---
    languageLabel: { pt: "Idioma", en: "Language" },

    // --- about ---
    aboutMadeBy: { pt: "Feito por {name}", en: "Made by {name}" },
    aboutGitHub: { pt: "GitHub", en: "GitHub" },

    // --- profile ---
    profileFriendsTitle: { pt: "Amigos (Lista de Jogos Pública)", en: "Friends (Public Games List)" },
    searchFriendsPlaceholder: { pt: "Pesquisar amigos...", en: "Search friends..." },
    friendsSearchNoResults: { pt: "Nenhum amigo encontrado", en: "No friends found" },
    profileGamesCount: { pt: "Jogos: {count}", en: "Games: {count}" },
    profileCommonGamesCount: { pt: "Jogos compartilhados: {count}", en: "Shared games: {count}" },
    profilePerfectedGames: { pt: "Jogos completos", en: "Perfected games" },
    profileAvgCompletion: { pt: "Conclusão média", en: "Avg completion" },
    profileNoPublicFriends: { pt: "Nenhum amigo com jogos públicos encontrado", en: "No friends with public games found" },
    profileFriendsPrivate: { pt: "Sua lista de amigos está privada, em 'Somente amigos' ou indisponível", en: "Your friend list is private, set to 'friends only', or unavailable" },
    profileUnavailable: { pt: "Perfil não disponível", en: "Profile unavailable" },
    profileLoadError: { pt: "Ocorreu um erro ao carregar o perfil. Verifique sua conexão.", en: "An error occurred while loading the profile. Check your connection." },
    profileRetry: { pt: "Tentar novamente", en: "Try again" },

    // --- profile card ---
    statusOffline: { pt: "Offline", en: "Offline" },
    statusOnline: { pt: "Online", en: "Online" },
    statusBusy: { pt: "Ocupado", en: "Busy" },
    statusAway: { pt: "Ausente", en: "Away" },
    statusSleep: { pt: "Soneca", en: "Sleep" },
    statusLookingTrade: { pt: "Procurando Trocar", en: "Looking to Trade" },
    statusLookingPlay: { pt: "Procurando Jogar", en: "Looking to Play" },
    statusUnknown: { pt: "Desconhecido", en: "Unknown" },
    logout: { pt: "Sair", en: "Log out" },
    profileName: { pt: "Nome: {name}", en: "Name: {name}" },
    profileCountry: { pt: "País: {code}", en: "Country: {code}" },
    profileLastOnline: { pt: "Última vez online: {date}", en: "Last online: {date}" },
    viewProfile: { pt: "Ver Perfil", en: "View Profile" },

    // --- game list ---
    filterAll: { pt: "Todos", en: "All" },
    filterNeverPlayed: { pt: "Nunca Jogados", en: "Never Played" },
    filterPlayed: { pt: "Jogados", en: "Played" },
    filterWithAchievements: { pt: "Com Conquistas", en: "With Achievements" },
    filterWithoutAchievements: { pt: "Sem Conquistas", en: "Without Achievements" },
    filterCompleted: { pt: "Completados", en: "Completed" },
    filterNotCompleted: { pt: "Não Completados", en: "Not Completed" },
    filterBacklog: { pt: "Backlog", en: "Backlog" },
    gameRecentRefresh: { pt: "Atualizando jogos recentes...", en: "Updating most recent games..." },
    gameRecentRefreshed: { pt: "Jogos atualizados!", en: "Recent games updated!" },
    sortRecent: { pt: "Mais recentes", en: "Most Recent" },
    sortPlaytime: { pt: "Tempo de Jogo", en: "Playtime" },
    sortName: { pt: "Nome", en: "Name" },
    sortProgress: { pt: "Progresso", en: "Progress" },
    searchingGames: { pt: "Buscando {current}/{total} jogos…", en: "Searching {current}/{total} games…" },
    searchGamesPlaceholder: { pt: "Pesquisar jogos...", en: "Search games..." },
    clear: { pt: "Limpar", en: "Clear" },
    loadingGames: { pt: "Carregando {current}/{total}", en: "Loading {current}/{total}" },
    searchingFriends: { pt: "Buscando {current}/{total} amigos…", en: "Searching {current}/{total} friends…" },
    loadingFriends: { pt: "Carregando {current}/{total}", en: "Loading {current}/{total}" },
    filterTitle: { pt: "Filtrar", en: "Filter" },
    sortTitle: { pt: "Ordenar por", en: "Sort by" },


    // --- game card ---
    playtimeMinutes: { pt: "{minutes} minutos", en: "{minutes} minutes" },
    playtimeHours: { pt: "{hours} horas {minutes} minutos", en: "{hours} hours {minutes} minutes" },
    playtimeHidden: { pt: "Tempo de jogo oculto", en: "Playtime hidden" },
    playtimeNeverPlayed: { pt: "Nunca jogado", en: "Never played" },
    achievementsCount: { pt: "{unlocked}/{total} conquistas ({percent}%)", en: "{unlocked}/{total} achievements ({percent}%)" },

    // --- game screen ---
    communityGuides: { pt: "Guias da Comunidade", en: "Steam Guides" },
    steamDiscussions: { pt: "Discussões na Steam", en: "Steam Discussions" },
    achievements: { pt: "Conquistas", en: "Achievements" },
    details: { pt: "Detalhes", en: "Details" },

    // --- game details ---
    readMore: { pt: "Ler Mais", en: "Read More" },
    readLess: { pt: "Minimizar", en: "Minimize" },
    genre: { pt: "Gênero", en: "Genre" },
    release: { pt: "Lançamento", en: "Release" },
    viewInStore: { pt: "Ver na Loja", en: "View in Store" },

    // --- achievements ---
    hiddenDescription: { pt: "Descrição Oculta", en: "Hidden Description" },
    noAchievements: { pt: "Este jogo não possui conquistas", en: "This game has no achievements" },
    achFilterUnlocked: { pt: "Desbloqueadas", en: "Unlocked" },
    achFilterLocked: { pt: "Bloqueadas", en: "Locked" },
    achFilterLegendary: { pt: "Lendárias (< 5%)", en: "Legendary (< 5%)" },
    achSortRarity: { pt: "Raridade", en: "Rarity" },
    achSortUnlock: { pt: "Data de Desbloqueio", en: "Unlock Date" },
    achSortReverse: { pt: "Ordem Inversa", en: "Reverse Order" },
    unlockedAt: { pt: "Desbloqueada em {date}", en: "Unlocked on {date}" },

    // --- guide search ---
    searchGoogle: { pt: "Buscar no Google", en: "Search on Google" },
    searchChatGPT: { pt: "Perguntar ao ChatGPT", en: "Ask ChatGPT" },
    achSearchPlaceholder: { pt: "Pesquisar conquistas...", en: "Search achievements..." },
    noAchievementsMatch: { pt: "Nenhuma conquista encontrada", en: "No achievements found" },

    // --- common games ---
    commonGamesTitle: { pt: "Jogos compartilhados ({count})", en: "Shared games ({count})" },
    noCommonGames: { pt: "Nenhum jogo compartilhado", en: "No shared games" },
    friendFallback: { pt: "Amigo", en: "Friend" },
    friendCommonGames: { pt: "Jogos Compartilhados", en: "Shared Games" },
    friendOwnGames: { pt: "Jogos Dele", en: "His Games" },
    friendGamesTitle: { pt: "Jogos dele ({count})", en: "His games ({count})" },
    noGames: { pt: "Este amigo não possui jogos públicos", en: "This friend has no public games" },

    // --- single game refresh ---
    gameRefreshing: { pt: "Atualizando jogo...", en: "Updating game..." },
    gameRefreshed: { pt: "Jogo atualizado!", en: "Game updated!" },
    gameRefreshFailed: { pt: "Falha ao atualizar o jogo.", en: "Failed to update the game." },
    gameRefreshHint: { pt: "Segure para atualizar", en: "Press and hold to refresh" },

    // --- pull to refresh ---
    pullToRefreshUpdating: { pt: "Atualizando...", en: "Updating..." },

    // --- recent games refresh ---
    refreshRecentGames: { pt: "Atualizar jogos recentes", en: "Refresh recent games" },
    noRecentGames: { pt: "Nenhum jogo jogado recentemente.", en: "No recently played games." },
    noGamesTitle: { pt: "Nenhum jogo encontrado", en: "No games found" },
    noGamesMessage: { pt: "Sua lista de jogos pode estar privada ou em 'Somente amigos', pode estar vazia ou houve um erro de conexão. Puxe para baixo para tentar novamente.", en: "Your games list may be private or set to 'friends only', may be empty, or there was a connection error. Pull down to retry." },

    // --- list separators ---
    recentGamesSeparator: { pt: "Jogados Recentemente", en: "Recently Played" },
};
