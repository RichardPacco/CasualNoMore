import { getOwnedGames, GetSchemaForGame, getStoreAssets } from "@/src/api/steam";
import GameCard from "@/src/components/GameCard";
import { AppText, Button, Chip, ProgressBar, TextField } from "@/src/components/ui";
import PullToRefresh from "@/src/components/PullToRefresh";
import FilterSortSheet from "@/src/components/FilterSortSheet";
import { AuthContext } from "@/src/context/AuthContext";
import { deleteGamesNotOwned, getAllGames, getGame, parseJson, saveGame, saveGamesBatch, togglePin as dbTogglePin, getPinnedAppIds } from "@/src/database/db";
import { getLanguageStore } from "@/src/i18n/langStore";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";
import { computeProgress, fetchAndMergeAchievements, getGameCounts } from "@/src/utils/achievements";
import { showToast } from "@/src/utils/toast";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Pressable from "@/src/components/ui/Pressable";

// Configurações de privacidade do perfil na Steam (para deixar os jogos públicos)
const STEAM_PRIVACY_URL = "https://steamcommunity.com/my/edit/settings";

// Jogos enriquecidos ao mesmo tempo na sincronização (cada um faz ~4 chamadas
// à Steam). O turbo não trata erro 429: se a Steam limitar, os jogos que
// falharem ficam pendentes e são buscados de novo na próxima sincronização.
const CONCURRENCY_NORMAL = 5;
const CONCURRENCY_TURBO = 20;

// Modos de exibição da biblioteca (salvos no aparelho com esta chave)
const VIEW_MODE_KEY = "@library_view_mode";
const VIEW_MODES = ["compact", "card", "grid"];
const VIEW_MODE_OPTIONS = [
    { value: "compact", icon: "list", label: "viewCompact" },
    { value: "card", icon: "albums-outline", label: "viewCards" },
    { value: "grid", icon: "grid-outline", label: "viewGrid" },
];

/** Jogo tem conquistas e todas foram desbloqueadas. */
function isCompleted(g) {
    const { unlocked, total } = getGameCounts(g);
    return total > 0 && unlocked === total;
}

/**
 * Definição única de cada filtro da lista (valor -> regra). Usada tanto para
 * filtrar quanto para contar, então os números do menu sempre batem com a
 * lista exibida. Para um filtro novo: a regra aqui + a opção em filterOptions.
 */
const GAME_FILTERS = {
    all: () => true,
    played: g => g.playtime_forever > 0,
    neverPlayed: g => g.playtime_forever === 0,
    withAchievements: g => getGameCounts(g).total > 0,
    withoutAchievements: g => getGameCounts(g).total === 0,
    completed: isCompleted,
    notCompleted: g => getGameCounts(g).total > 0 && !isCompleted(g),
    progress: g => {
        const { unlocked, total } = getGameCounts(g);
        return total > 0 && unlocked > 0 && unlocked !== total;
    },
    pinned: g => !!g.pinned,
};

/** Regra do filtro pelo valor; valor desconhecido = sem filtro. */
function filterRule(value) {
    return GAME_FILTERS[value] ?? GAME_FILTERS.all;
}

/**
 * Biblioteca (redesign, prancheta 04): lista de jogos do usuário com busca,
 * chips de filtro, ordenação, seções de fixados e jogados recentemente,
 * e progresso de conquistas.
 */
export default function GameList({ navigation, route }) {
    const { steamId } = useContext(AuthContext);
    const { t: tr, language } = useLanguage();

    // ---------- hooks / state ----------
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [filter, setFilter] = useState("all");
    const [sort, setSort] = useState("recentPlaytime");
    const [refreshing, setRefreshing] = useState(false);
    const [refreshingRecent, setRefreshingRecent] = useState(false);

    // Turbo: mais jogos ao mesmo tempo na sincronização. O state é para o
    // botão; o ref é lido pelo laço de carga a cada rodada.
    const [turbo, setTurbo] = useState(false);
    const turboRef = useRef(false);
    const toggleTurbo = useCallback(() => {
        turboRef.current = !turboRef.current;
        setTurbo(turboRef.current);
    }, []);
    // painel único de filtrar e ordenar (aberto por "Mais filtros" ou pelo botão de ordenar)
    const [sheetVisible, setSheetVisible] = useState(false);

    // Modo de exibição da lista: "compact" (sem imagem), "card" ou "grid"
    // (2 colunas). Fica salvo no aparelho; se a leitura falhar, usa "card".
    const [viewMode, setViewModeState] = useState("card");
    useEffect(() => {
        AsyncStorage.getItem(VIEW_MODE_KEY)
            .then(saved => { if (VIEW_MODES.includes(saved)) setViewModeState(saved); })
            .catch(() => { });
    }, []);
    const setViewMode = useCallback((mode) => {
        setViewModeState(mode);
        AsyncStorage.setItem(VIEW_MODE_KEY, mode).catch(() => { });
    }, []);
    const [showTopButton, setShowTopButton] = useState(false);
    const listRef = useRef(null);

    // search states
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");


    // geração da carga atual: quando uma nova carga começa (ou o componente
    // desmonta), o número muda e execuções antigas param de escrever na UI/DB.
    // Um simples boolean não serve — a nova carga rearmaria o flag e a execução
    // antiga continuaria rodando em paralelo (progresso e lista "bugados").
    const loadGenRef = useRef(0);

    // Lista de trabalho da carga em andamento ({ gamesList, gameMap }), ou null
    // quando nenhuma carga está rodando. Permite que outras partes da tela
    // (ex.: volta da GameScreen) atualizem a cópia que a carga vai gravar, e
    // que o refresh de recentes saiba que não deve rodar em paralelo.
    const activeLoadRef = useRef(null);

    // Trava síncrona do refresh de recentes (o state demora um render para
    // atualizar, então dois toques rápidos passariam pela checagem do state).
    const refreshingRecentRef = useRef(false);

    // Sempre a lista mais recente, para callbacks que rodam depois de awaits.
    const gamesRef = useRef(games);
    gamesRef.current = games;

    /**
     * Completa um jogo com toda a informação disponível:
     * schema, conquistas (com progresso) e detalhes da loja.
     * Só busca o que ainda não foi cacheado. Se uma busca falhar,
     * mantém o dado antigo (fallback) e deixa o status "pending"
     * para tentar de novo na próxima carga.
     */
    const enrichGame = useCallback(async (baseGame, cached, force = false, pinnedIds = null) => {
        const lang = getLanguageStore();
        const stale = force || (cached ? cached.lang !== lang : false);
        const cachedSchema = parseJson(cached?.schema);
        const cachedAchievements = parseJson(cached?.achievements);
        const cachedDetails = parseJson(cached?.details);

        let schema = stale ? null : (cachedSchema ?? null);
        let schemaStatus = stale ? "pending" : (cached?.schemaStatus || "pending");
        let achievements = stale ? null : (cachedAchievements ?? null);
        let achievementsStatus = stale ? "pending" : (cached?.achievementsStatus || "pending");
        // Detalhes da loja: em troca de idioma ou long-press (stale/force) são
        // zerados para serem re-adquiridos sob demanda pelo GameDetailsTab.
        let details = stale ? null : (cachedDetails ?? null);
        let detailsStatus = stale ? "pending" : (cached?.detailsStatus || "pending");

        if (schemaStatus === "pending") {
            try {
                schema = await GetSchemaForGame(baseGame.appid, steamId);
                schemaStatus = "done";
            } catch (err) {
                console.error("[GameList] Erro schema", baseGame.appid, err);
                schema = cachedSchema ?? null;
                schemaStatus = "pending";
            }
        }

        if (achievementsStatus === "pending") {
            // Sem schema a lista de conquistas não é montável (o merge usa o schema
            // para os nomes). Se o schema falhou, mantém o cache e tenta depois.
            if (schemaStatus === "done") {
                try {
                    achievements = await fetchAndMergeAchievements(baseGame.appid, steamId, schema);
                    achievementsStatus = "done";
                } catch (err) {
                    console.error("[GameList] Erro achievements", baseGame.appid, err);
                    achievements = cachedAchievements ?? null;
                    achievementsStatus = "pending";
                }
            } else {
                achievements = cachedAchievements ?? null;
                achievementsStatus = "pending";
            }
        }

        // Detalhes da loja são buscados sob demanda no GameDetailsTab e persistidos no DB.
        // Steam mascara tempo de jogo privado como 0 (não omite o campo). Se o jogo tem
        // conquistas desbloqueadas ele foi jogado — logo playtime 0 significa tempo privado.
        const rawPlaytime = baseGame.playtime_forever || 0;
        const unlockedCount = (achievements || []).filter(a => a.achieved).length;
        const playtimeHidden = rawPlaytime === 0 && unlockedCount > 0;
        const { unlocked, total } = computeProgress(achievements || []);
        return {
            ...baseGame,
            playtime_forever: rawPlaytime,
            playtime_2weeks: baseGame.playtime_2weeks || 0,
            playtimeHidden,
            unlocked, totalAchievements: total,
            schema, schemaStatus, achievements, achievementsStatus, details, detailsStatus,
            // idioma dos detalhes da loja: zerado junto com eles quando stale
            detailsLang: details ? (cached?.detailsLang ?? null) : null,
            // URLs das imagens da loja (com hash): as recém-buscadas vêm no
            // baseGame (getStoreAssets); senão mantém as do cache.
            capsuleUrl: baseGame.capsuleUrl ?? cached?.capsuleUrl ?? null,
            headerUrl: baseGame.headerUrl ?? cached?.headerUrl ?? null,
            lang,
            pinned: cached?.pinned || (pinnedIds?.has(baseGame.appid) ? 1 : 0),
        };
    }, [steamId]);

    /**
     * Força refetch completo de um jogo (playtime, schema, conquistas).
     * `existing` (jogo atual da lista) serve de fallback se algo falhar.
     */
    const forceRefreshGame = useCallback(async (baseGame, existing, pinnedIds = null, isStale = () => false) => {
        const fresh = await enrichGame(baseGame, existing, true, pinnedIds);
        // Descarta o resultado se o refresh foi substituído durante a busca
        if (isStale()) return;

        setGames(prev => prev.map(g => g.appid === fresh.appid ? fresh : g));
        await saveGame(steamId, fresh);
    }, [steamId, enrichGame]);

    /**
     * Atualiza um único jogo por completo ao segurar no card.
     */
    const refreshSingleGame = useCallback(async (game) => {
        showToast(tr("gameRefreshing"), "info");
        try {
            const owned = await getOwnedGames(steamId);
            const ownedGame = owned?.games?.find(g => g.appid === game.appid);
            if (!ownedGame) throw new Error("game not in owned list");

            // Rebusca também as URLs das imagens (o hash muda se a arte mudar)
            const assets = await getStoreAssets([game.appid]);
            const baseGame = { ...ownedGame, ...assets.get(game.appid) };

            await forceRefreshGame(baseGame, game);
            showToast(tr("gameRefreshed"), "success");
        } catch (err) {
            console.error("[GameList] refreshSingleGame failed", game.appid, err);
            showToast(tr("gameRefreshFailed"), "error");
        }
    }, [steamId, forceRefreshGame, tr]);

    /**
     * Alterna o estado pinned de um jogo (fixar/desfixar).
     */
    const togglePinGame = useCallback(async (game) => {
        const newPinned = await dbTogglePin(steamId, game.appid);
        setGames(prev => prev.map(g =>
            g.appid === game.appid ? { ...g, pinned: newPinned } : g
        ));
        showToast(newPinned ? tr("gamePinned") : tr("gameUnpinned"), "success");
    }, [steamId, tr]);

    /**
     * Atualiza por completo os jogos jogados nas últimas 2 semanas
     * (playtime_2weeks > 0) e todos os jogos fixados.
     * `silent` sem toasts (disparo automático ao abrir a lista).
     */
    const refreshRecentGames = useCallback(async (silent = false) => {
        // Nunca roda junto com a carga completa (as duas gravariam os mesmos
        // jogos e a última a terminar venceria) nem duas vezes ao mesmo tempo.
        if (refreshingRecentRef.current || activeLoadRef.current) return;
        refreshingRecentRef.current = true;
        setRefreshingRecent(true);

        // Mesma geração da carga: se uma nova carga começar (pull-to-refresh,
        // troca de idioma) ou a tela desmontar, este refresh para de escrever.
        const gen = loadGenRef.current;
        const isStale = () => loadGenRef.current !== gen;

        if (!silent) showToast(tr("gameRecentRefresh"), "info");
        try {
            const owned = await getOwnedGames(steamId);
            if (isStale()) return;
            if (!owned?.games) throw new Error("no games");

            const pinnedIds = new Set(await getPinnedAppIds(steamId));
            if (isStale()) return;

            const toRefresh = owned.games.filter(g =>
                (g.playtime_2weeks || 0) > 0 || pinnedIds.has(g.appid)
            );
            if (toRefresh.length === 0) {
                if (!silent) showToast(tr("noRecentGames"), "info");
                return;
            }

            // Rebusca as URLs das imagens desses jogos (o hash muda se a arte mudar)
            const assets = await getStoreAssets(toRefresh.map(g => g.appid));
            if (isStale()) return;

            for (const ownedGame of toRefresh) {
                if (isStale()) return;
                const baseGame = { ...ownedGame, ...assets.get(ownedGame.appid) };
                const existing = gamesRef.current.find(g => g.appid === baseGame.appid);
                await forceRefreshGame(baseGame, existing, pinnedIds, isStale);
            }

            if (!silent && !isStale()) showToast(tr("gameRecentRefreshed"), "success");
        } catch (err) {
            console.error("[GameList] refreshRecentGames failed", err);
            if (!silent && !isStale()) showToast(tr("gameRefreshFailed"), "error");
        } finally {
            refreshingRecentRef.current = false;
            setRefreshingRecent(false);
        }
    }, [steamId, forceRefreshGame, tr]);

    /**
     * Verifica se o jogo foi jogado nas últimas 2 semanas (playtime_2weeks > 0).
     */
    const isRecentGame = useCallback((g) => (g.playtime_2weeks || 0) > 0, []);

    // Ref para disparar o refresh de recentes ao abrir a lista sem colocar
    // refreshRecentGames nas dependências do useEffect de carga.
    const refreshRecentRef = useRef(null);
    refreshRecentRef.current = refreshRecentGames;

    // appid do último jogo aberto: ao voltar para a lista, essa linha é relida
    // do banco para refletir o que a GameScreen salvou (conquistas, detalhes).
    const lastOpenedRef = useRef(null);

    /**
     * Abre a GameScreen passando só o appid (a tela lê o jogo do banco).
     */
    const openGame = useCallback((game) => {
        lastOpenedRef.current = game.appid;
        navigation.navigate("GameScreen", { appid: game.appid });
    }, [navigation]);

    useEffect(() => {
        return navigation.addListener("focus", async () => {
            const appid = lastOpenedRef.current;
            if (!appid || !steamId) return;
            lastOpenedRef.current = null;
            const row = await getGame(steamId, appid);
            if (!row) return;
            // Se uma carga está rodando, atualiza também a cópia dela; senão o
            // próximo lote da carga traria de volta a versão antiga do jogo.
            const active = activeLoadRef.current;
            const idx = active?.gameMap.get(appid);
            if (idx !== undefined) active.gamesList[idx] = row;
            setGames(prev => prev.map(g => g.appid === appid ? row : g));
        });
    }, [navigation, steamId]);

    /**
     * Renderiza um card de jogo na lista virtualizada (FlashList).
     */
    const renderGameCard = useCallback(
        ({ item, index }) => {
            const card = (
                <GameCard
                    game={item}
                    navigation={navigation}
                    onOpen={openGame}
                    onLongPress={refreshSingleGame}
                    onTogglePin={togglePinGame}
                    variant={viewMode}
                />
            );
            if (viewMode !== "grid") return card;
            // grade de 2 colunas: meio espaço de cada lado entre as colunas
            return (
                <View style={{ flex: 1, paddingLeft: index % 2 ? 5 : 0, paddingRight: index % 2 ? 0 : 5 }}>
                    {card}
                </View>
            );
        },
        [navigation, openGame, refreshSingleGame, togglePinGame, viewMode]
    );

    const filterOptions = useMemo(() => [
        // ordem da grade do painel de filtros (prancheta 05), em pares
        { label: tr("filterAll"), value: "all" },
        { label: tr("filterBacklog"), value: "progress" },
        { label: tr("filterPlayed"), value: "played" },
        { label: tr("filterNeverPlayed"), value: "neverPlayed" },
        { label: tr("filterWithAchievements"), value: "withAchievements" },
        { label: tr("filterWithoutAchievements"), value: "withoutAchievements" },
        { label: tr("filterCompleted"), value: "completed" },
        { label: tr("filterNotCompleted"), value: "notCompleted" },
        { label: tr("filterPinned"), value: "pinned" },
    ], [tr]);

    const sortOptions = useMemo(() => [
        { label: tr("sortRecent"), value: "recentPlaytime" },
        { label: tr("sortPlaytime"), value: "totalPlaytime" },
        { label: tr("sortName"), value: "name" },
        { label: tr("sortProgress"), value: "progress" },
    ], [tr]);

    // Quantos jogos se encaixam em cada opção de filtro (mesma regra da lista)
    const filterCounts = useMemo(() => {
        return filterOptions.reduce((acc, opt) => {
            acc[opt.value] = games.filter(filterRule(opt.value)).length;
            return acc;
        }, {});
    }, [games, filterOptions]);

    const filteredGames = useMemo(() => {
        let result = filter === "all" ? games : games.filter(filterRule(filter));

        // apply search by name (debounced)
        if (debouncedQuery && debouncedQuery.trim().length > 0) {
            const q = debouncedQuery.trim().toLowerCase();
            result = result.filter(g => (g.name || "").toLowerCase().includes(q));
        }

        switch (sort) {
            case "recentPlaytime":
                result = [...result].sort((a, b) => {
                    const a2 = a.playtime_2weeks || 0;
                    const b2 = b.playtime_2weeks || 0;
                    if (b2 !== a2) return b2 - a2;
                    return (b.playtime_forever || 0) - (a.playtime_forever || 0);
                });
                break;
            case "totalPlaytime":
                result = [...result].sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0));
                break;
            case "name":
                result = [...result].sort((a, b) => a.name.localeCompare(b.name));
                break;
            case "progress":
                result = [...result].sort((a, b) => {
                    const aP = getGameCounts(a);
                    const bP = getGameCounts(b);
                    const aHas = aP.total > 0 ? 1 : 0;
                    const bHas = bP.total > 0 ? 1 : 0;
                    if (aHas !== bHas) return bHas - aHas;
                    return bP.percent - aP.percent;
                });
                break;
            default: break;
        }

        return result;
    }, [games, filter, sort, debouncedQuery]);

    // Na ordenação padrão, separa os recentes (vão num card com borda no
    // cabeçalho) do restante (vira a lista virtualizada).
    const recentBlock = useMemo(() => {
        if (sort !== "recentPlaytime") return null;
        const recent = filteredGames.filter(isRecentGame);
        const rest = filteredGames.filter(g => !isRecentGame(g));
        return { recent, rest };
    }, [filteredGames, sort, isRecentGame]);

    // Separa os fixados (vão num card com borda no cabeçalho) do restante.
    const pinnedBlock = useMemo(() => {
        const pinned = filteredGames.filter(g => g.pinned);
        const rest = filteredGames.filter(g => !g.pinned);
        return { pinned, rest };
    }, [filteredGames]);

    // ---------- load jogos ----------
    /**
     * Carrega os jogos do banco e sincroniza com a Steam, enriquecendo
     * cada jogo com schema, conquistas e progresso (com cache e lotes).
     */
    const loadGames = useCallback(async () => {
        if (!steamId) return false;
        const gen = ++loadGenRef.current;

        // Map appid -> índice na lista: lookups O(1) no lugar do findIndex
        const gameMap = new Map();
        const gamesList = [];
        const work = { gamesList, gameMap };
        activeLoadRef.current = work;

        try {
            // 1️⃣ Load games from DB
            const cachedGames = await getAllGames(steamId);
            if (loadGenRef.current !== gen) return false;

            for (const g of cachedGames) {
                if (!gameMap.has(g.appid)) {
                    gameMap.set(g.appid, gamesList.length);
                    gamesList.push(g);
                }
            }

            if (gamesList.length > 0) {
                setGames(gamesList);
                setProgress({ current: gamesList.length, total: gamesList.length });
                setLoading(false);
            }

            // 2️⃣ Fetch fresh games from Steam
            const fresh = await getOwnedGames(steamId);
            if (loadGenRef.current !== gen) return false;
            if (!fresh?.games) {
                if (gamesList.length === 0) setLoading(false);
                return false;
            }

            const total = fresh.games.length;
            setProgress({ current: gamesList.length, total });

            // Processa primeiro os jogos mais relevantes (mais jogados recentemente)
            // para que o topo da lista ganhe dados (progresso) antes do resto
            const sortedFresh = [...fresh.games].sort((a, b) => {
                const a2 = a.playtime_2weeks || 0;
                const b2 = b.playtime_2weeks || 0;
                if (b2 !== a2) return b2 - a2;
                const a0 = a.playtime_forever || 0;
                const b0 = b.playtime_forever || 0;
                if (b0 !== a0) return b0 - a0;
                return (a.name || "").localeCompare(b.name || "");
            });

            // URLs das imagens da loja só para quem ainda não tem no cache
            // (jogos novos na conta ou nunca buscados): em lotes de 100 por chamada.
            const missingAssets = sortedFresh
                .filter(g => {
                    const idx = gameMap.get(g.appid);
                    return !(idx !== undefined && gamesList[idx].capsuleUrl);
                })
                .map(g => g.appid);
            const assets = await getStoreAssets(missingAssets);
            if (loadGenRef.current !== gen) return false;
            const freshGames = sortedFresh.map(g => ({ ...g, ...assets.get(g.appid) }));

            // Enriquecimento em paralelo (poucos por vez para não estourar a API)
            // e atualização da UI + persistência em lotes (reduz re-renders e I/O).
            // Quantos jogos são enriquecidos ao mesmo tempo: lido a cada rodada,
            // então ligar/desligar o turbo vale na hora, no meio da sincronização.
            const UI_BATCH = 10;    // a cada quantos jogos a lista é re-renderizada
            let batchToSave = [];
            let updatedAny = false;

            for (let i = 0; i < freshGames.length;) {
                if (loadGenRef.current !== gen) return false;

                const step = turboRef.current ? CONCURRENCY_TURBO : CONCURRENCY_NORMAL;
                const next = i + step;
                const chunk = freshGames.slice(i, next);
                const enrichedChunk = await Promise.all(chunk.map(baseGame => {
                    const idx = gameMap.get(baseGame.appid);
                    const cachedEntry = idx !== undefined ? gamesList[idx] : null;
                    return enrichGame(baseGame, cachedEntry);
                }));
                if (loadGenRef.current !== gen) return false;

                for (const enriched of enrichedChunk) {
                    const idx = gameMap.get(enriched.appid);

                    if (idx !== undefined) {
                        const prev = gamesList[idx];
                        const changed = prev.playtime_forever !== enriched.playtime_forever
                            || prev.playtime_2weeks !== enriched.playtime_2weeks
                            || !!prev.playtimeHidden !== !!enriched.playtimeHidden
                            || prev.schemaStatus !== enriched.schemaStatus
                            || prev.achievementsStatus !== enriched.achievementsStatus
                            || prev.detailsStatus !== enriched.detailsStatus
                            || prev.lang !== enriched.lang
                            || prev.capsuleUrl !== enriched.capsuleUrl
                            || prev.headerUrl !== enriched.headerUrl;
                        if (!changed) continue;
                        gamesList[idx] = enriched;
                    } else {
                        gameMap.set(enriched.appid, gamesList.length);
                        gamesList.push(enriched);
                    }

                    updatedAny = true;
                    batchToSave.push(enriched);
                }

                setProgress({ current: Math.min(next, total), total });

                // Atualiza a lista e persiste em lotes, não a cada jogo
                if (updatedAny && (batchToSave.length >= UI_BATCH || next >= freshGames.length)) {
                    setGames([...gamesList]);
                    await saveGamesBatch(steamId, batchToSave);
                    batchToSave = [];
                }

                i = next;
            }

            if (loadGenRef.current !== gen) return false;

            // 3️⃣ Remove do cache (e da tela) os jogos que saíram da biblioteca.
            // Só chega aqui com a lista da Steam em mãos: lista privada ou erro
            // retornam antes, então o cache nunca é apagado por engano.
            const removed = await deleteGamesNotOwned(steamId, fresh.games.map(g => g.appid));
            if (loadGenRef.current !== gen) return false;
            if (removed.length > 0) {
                const removedSet = new Set(removed);
                setGames(prev => prev.filter(g => !removedSet.has(g.appid)));
            }

            // Finish sync: clear progress header even if nothing was updated
            setProgress({ current: total, total });
            setLoading(false);
            return true;
        } catch (err) {
            console.error("[GameList] loadGames failed", err);
            setLoading(false);
            return false;
        } finally {
            // Só libera se ninguém tiver iniciado uma carga nova nesse meio-tempo
            if (activeLoadRef.current === work) activeLoadRef.current = null;
        }
    }, [steamId, enrichGame]);

    /**
     * Dispara o reload completo da lista ao puxar para atualizar (pull-to-refresh).
     */
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await loadGames();
        } finally {
            setRefreshing(false);
        }
    }, [loadGames]);


    useEffect(() => {
        if (!steamId) return;
        // Sempre que a lista abre, força refresh completo dos jogos recentes
        // e fixados — mas só DEPOIS da carga completa terminar, para as duas
        // não buscarem e gravarem os mesmos jogos em paralelo. Se a carga foi
        // substituída (troca de idioma, unmount), o refresh não roda.
        loadGames().then(completed => {
            if (completed) refreshRecentRef.current?.(true);
        });
        return () => {
            // Cancela a carga e o refresh de recentes em andamento (troca de
            // idioma ou unmount): as execuções antigas detectam a geração nova
            // e param de escrever.
            // eslint-disable-next-line react-hooks/exhaustive-deps -- incremento intencional do counter
            loadGenRef.current++;
        };
    }, [steamId, loadGames, language]);

    // debounce search query
    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
        return () => clearTimeout(t);
    }, [searchQuery]);


    // ---------- UI ----------
    // Botão turbo dos cards de sincronização: liga/desliga mais jogos ao mesmo tempo
    const turboButton = (
        <Pressable
            onPress={toggleTurbo}
            accessibilityRole="switch"
            accessibilityState={{ checked: turbo }}
            accessibilityLabel={tr("turboA11y")}
            hitSlop={{ top: 6, bottom: 6 }}
            style={({ pressed }) => [styles.turbo, turbo && styles.turboOn, { opacity: pressed ? 0.8 : 1 }]}
        >
            <Ionicons name={turbo ? "flash" : "flash-outline"} size={14} color={turbo ? COLORS.gold : COLORS.textSoft} />
            <AppText variant="muted" style={[styles.turboLabel, { color: turbo ? COLORS.gold : COLORS.textSoft }]}>
                {tr("turbo")}
            </AppText>
        </Pressable>
    );

    // Primeira sincronização (banco ainda vazio): título, card de progresso e
    // linhas-esqueleto no lugar da lista (redesign, prancheta 13).
    if (loading && games.length === 0) {
        const pct = progress.total ? (progress.current / progress.total) * 100 : 0;
        return (
            <View style={styles.screen}>
                <View style={[styles.header, { gap: 16 }]}>
                    <View style={{ gap: 2 }}>
                        <AppText variant="title">{tr("libraryTitle")}</AppText>
                        <AppText variant="muted">{tr("firstSync")}</AppText>
                    </View>
                    <View style={styles.syncCard} accessibilityRole="progressbar" accessibilityLabel={tr("syncSearching")}>
                        <View style={styles.syncTop}>
                            <AppText variant="itemName" style={{ flex: 1 }}>{tr("syncSearching")}</AppText>
                            {progress.total > 0 ? (
                                <AppText variant="muted" color={COLORS.accent} style={{ fontFamily: FONTS.bodySemibold }}>
                                    {tr("syncCount", { current: progress.current, total: progress.total })}
                                </AppText>
                            ) : (
                                <ActivityIndicator size="small" color={COLORS.accent} />
                            )}
                        </View>
                        <ProgressBar value={pct} height={6} />
                        <View style={styles.syncTop}>
                            <AppText variant="muted" style={{ fontSize: 12, flex: 1 }}>{tr("syncHint")}</AppText>
                            {turboButton}
                        </View>
                    </View>
                    <View style={{ gap: 8 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                        {[0.6, 0.45, 0.7].map((w, i) => (
                            <View key={i} style={styles.skeletonRow}>
                                <View style={styles.skeletonCapsule} />
                                <View style={{ flex: 1, gap: 8 }}>
                                    <View style={[styles.skeletonLine, { width: `${w * 100}%` }]} />
                                    <View style={[styles.skeletonLine, { height: 6 }]} />
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            </View>
        );
    }

    // ---------- blocos do topo da lista (redesign, prancheta 04) ----------
    const syncing = progress.current < progress.total;

    // Seções do topo: fixados e jogados recentemente (só na ordenação padrão)
    const pinnedRows = pinnedBlock.pinned;
    const recentRows = recentBlock ? recentBlock.recent.filter(g => !g.pinned) : [];
    const listData = recentBlock ? recentBlock.rest.filter(g => !g.pinned) : pinnedBlock.rest;
    const hasTopBlocks = pinnedRows.length > 0 || recentRows.length > 0;

    // Chips rápidos; os outros filtros ficam em "Mais filtros"
    const QUICK_FILTERS = ["all", "progress", "completed"];
    const moreSelected = !QUICK_FILTERS.includes(filter);
    const filterLabel = (value) => filterOptions.find(o => o.value === value)?.label ?? value;
    const sortLabel = sortOptions.find(o => o.value === sort)?.label ?? "";

    const renderRow = (g) => {
        const card = (
            <GameCard
                key={g.appid}
                game={g}
                navigation={navigation}
                onOpen={openGame}
                onLongPress={refreshSingleGame}
                onTogglePin={togglePinGame}
                variant={viewMode}
            />
        );
        // na grade, cada card ocupa meia largura (ver styles.sectionGrid)
        return viewMode === "grid" ? <View key={g.appid} style={styles.gridCell}>{card}</View> : card;
    };
    // Seção do topo (fixados/recentes) no formato do modo atual
    const renderSection = (rows) => (
        <View style={viewMode === "grid" ? styles.sectionGrid : null}>{rows.map(renderRow)}</View>
    );

    return (
        <View style={styles.screen}>
            {/* Cabeçalho fixo: título, atualizar recentes, busca, ordenação e chips */}
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <View style={{ flex: 1, gap: 2 }}>
                        <AppText variant="title">{tr("libraryTitle")}</AppText>
                        <AppText variant="muted">
                            {tr("librarySubtitle", { count: games.length, completed: filterCounts.completed ?? 0 })}
                        </AppText>
                    </View>
                    {/* Modo de exibição: lista sem imagem, cards ou grade */}
                    <View style={styles.viewToggle} accessibilityRole="radiogroup" accessibilityLabel={tr("viewModeLabel")}>
                        {VIEW_MODE_OPTIONS.map(opt => {
                            const on = viewMode === opt.value;
                            return (
                                <Pressable
                                    key={opt.value}
                                    onPress={() => setViewMode(opt.value)}
                                    accessibilityRole="radio"
                                    accessibilityState={{ checked: on }}
                                    accessibilityLabel={tr(opt.label)}
                                    hitSlop={{ top: 4, bottom: 4 }}
                                    style={[styles.viewOption, on && styles.viewOptionOn]}
                                >
                                    <Ionicons name={opt.icon} size={18} color={on ? COLORS.accent : COLORS.textMuted} />
                                </Pressable>
                            );
                        })}
                    </View>
                    <Pressable
                        onPress={() => refreshRecentGames(false)}
                        // desativado durante a sincronização completa, que já
                        // atualiza tudo (inclusive os recentes)
                        disabled={refreshingRecent || syncing}
                        accessibilityRole="button"
                        accessibilityLabel={tr("refreshRecentGames")}
                        accessibilityState={{ disabled: refreshingRecent || syncing, busy: refreshingRecent }}
                        style={({ pressed }) => [
                            styles.iconButton,
                            { opacity: !refreshingRecent && syncing ? 0.5 : pressed ? 0.8 : 1 },
                        ]}
                    >
                        {refreshingRecent ? (
                            <ActivityIndicator size="small" color={COLORS.accent} />
                        ) : (
                            <Ionicons name="refresh" size={20} color={COLORS.accent} />
                        )}
                    </Pressable>
                </View>

                <View style={styles.searchRow}>
                    <TextField
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder={tr("searchGamesPlaceholder")}
                        accessibilityLabel={tr("searchGamesPlaceholder")}
                        returnKeyType="search"
                        onSubmitEditing={() => Keyboard.dismiss()}
                        containerStyle={{ flex: 1 }}
                        left={<Ionicons name="search" size={18} color={COLORS.textMuted} />}
                        right={searchQuery ? (
                            <Pressable
                                onPress={() => { setSearchQuery(""); setDebouncedQuery(""); }}
                                accessibilityRole="button"
                                accessibilityLabel={tr("clearSearch")}
                                style={styles.clearButton}
                            >
                                <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
                            </Pressable>
                        ) : null}
                    />
                    <Pressable
                        onPress={() => setSheetVisible(true)}
                        accessibilityRole="button"
                        accessibilityLabel={tr("sortButton", { sort: sortLabel })}
                        style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.8 : 1 }]}
                    >
                        <Ionicons name="swap-vertical" size={20} color={COLORS.textSoft} />
                        {sort !== "recentPlaytime" && <View style={styles.dot} />}
                    </Pressable>
                </View>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chips}
                    keyboardShouldPersistTaps="handled"
                >
                    {QUICK_FILTERS.map(value => (
                        <Chip
                            key={value}
                            label={filterLabel(value)}
                            count={filterCounts[value]}
                            selected={filter === value}
                            onPress={() => setFilter(value)}
                        />
                    ))}
                    <Chip
                        label={moreSelected ? filterLabel(filter) : tr("moreFilters")}
                        count={moreSelected ? filterCounts[filter] : undefined}
                        selected={moreSelected}
                        onPress={() => setSheetVisible(true)}
                    />
                </ScrollView>
            </View>

            <PullToRefresh refreshing={refreshing} onRefresh={onRefresh} enabled={!syncing}>
                <FlashList
                    key={`${filter}-${sort}-${debouncedQuery}-${!!recentBlock}-${pinnedBlock.pinned.length}-${viewMode}`}
                    numColumns={viewMode === "grid" ? 2 : 1}
                    ref={listRef}
                    data={listData}
                    keyExtractor={(item) => item.appid.toString()}
                    renderItem={renderGameCard}
                    maintainVisibleContentPosition={{ disabled: true }}
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                    onScroll={(e) => {
                        setShowTopButton(e.nativeEvent.contentOffset.y > 400);
                    }}
                    ListHeaderComponent={
                        <View style={styles.blocks}>
                            {!refreshing && syncing && (
                                <View style={styles.syncCard} accessibilityRole="progressbar">
                                    <View style={styles.syncTop}>
                                        <ActivityIndicator size="small" color={COLORS.accent} />
                                        <AppText variant="muted" style={{ flex: 1 }}>
                                            {tr("loadingGames", { current: progress.current, total: progress.total })}
                                        </AppText>
                                        {turboButton}
                                    </View>
                                    <ProgressBar value={progress.total ? (progress.current / progress.total) * 100 : 0} />
                                </View>
                            )}

                            {pinnedRows.length > 0 && (
                                <View style={styles.section}>
                                    <AppText variant="label" color={COLORS.gold}>{tr("pinnedSeparator")}</AppText>
                                    {renderSection(pinnedRows)}
                                </View>
                            )}

                            {recentRows.length > 0 && (
                                <View style={styles.section}>
                                    <AppText variant="label">{tr("recentGamesSeparator")}</AppText>
                                    {renderSection(recentRows)}
                                </View>
                            )}

                            {hasTopBlocks && listData.length > 0 && (
                                <AppText variant="label" style={{ marginBottom: 10 }}>{tr("allGamesSeparator")}</AppText>
                            )}
                        </View>
                    }
                    ListEmptyComponent={
                        games.length === 0 ? (
                            <View style={styles.empty}>
                                <View style={styles.emptyIcon}>
                                    <Ionicons name="game-controller-outline" size={30} color={COLORS.accent} />
                                </View>
                                <AppText variant="subtitle" style={{ textAlign: "center" }}>{tr("noGamesTitle")}</AppText>
                                <AppText variant="muted" style={{ textAlign: "center", fontSize: 14, lineHeight: 21 }}>
                                    {tr("noGamesMessage")}
                                </AppText>
                                <Button
                                    label={tr("profileRetry")}
                                    onPress={onRefresh}
                                    loading={refreshing}
                                    style={{ marginTop: 8, paddingHorizontal: 28 }}
                                />
                                <Pressable
                                    onPress={() => WebBrowser.openBrowserAsync(STEAM_PRIVACY_URL)
                                        .catch(err => console.error("Failed to open browser:", err))}
                                    accessibilityRole="link"
                                    style={styles.helpLink}
                                >
                                    <AppText variant="muted" color={COLORS.accent} style={{ fontFamily: FONTS.bodySemibold, fontSize: 14 }}>
                                        {tr("publicProfileHelp")}
                                    </AppText>
                                </Pressable>
                            </View>
                        ) : null
                    }
                />
            </PullToRefresh>

            {/* Voltar ao topo: aparece depois de rolar, acima da tab bar */}
            {showTopButton && (
                <Pressable
                    onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
                    accessibilityRole="button"
                    accessibilityLabel={tr("scrollToTop")}
                    style={({ pressed }) => [styles.topButton, { opacity: pressed ? 0.8 : 1 }]}
                >
                    <Ionicons name="chevron-up" size={22} color={COLORS.accent} />
                </Pressable>
            )}

            <FilterSortSheet
                visible={sheetVisible}
                onClose={() => setSheetVisible(false)}
                filterOptions={filterOptions}
                counts={filterCounts}
                filter={filter}
                sortOptions={sortOptions}
                sort={sort}
                onApply={({ filter: f, sort: s }) => {
                    setFilter(f);
                    setSort(s);
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.bg },
    header: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    viewToggle: {
        flexDirection: "row",
        padding: 3,
        gap: 2,
        borderRadius: 14,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
    },
    viewOption: { width: 36, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    viewOptionOn: { backgroundColor: COLORS.accentSoft },
    // seções do topo na grade: 2 colunas com 10 px entre elas
    sectionGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
    gridCell: { width: "48.6%" },
    // 48 px: mesma altura do campo de busca, para ficarem alinhados
    iconButton: {
        width: 48,
        height: 48,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        backgroundColor: COLORS.surface,
        alignItems: "center",
        justifyContent: "center",
    },
    dot: {
        position: "absolute",
        top: 9,
        right: 9,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.gold,
        borderWidth: 1,
        borderColor: COLORS.surface,
    },
    searchRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
    clearButton: { width: 36, height: 44, marginRight: -10, alignItems: "center", justifyContent: "center" },
    chips: { gap: 8, paddingVertical: 5, paddingRight: 20 },
    // espaço no fim para a lista não ficar atrás da tab bar flutuante
    listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 110 },
    blocks: { gap: 16, paddingBottom: 4 },
    section: { gap: 10 },
    syncCard: {
        padding: 14,
        borderRadius: 16,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        gap: 10,
    },
    syncTop: { flexDirection: "row", alignItems: "center", gap: 10 },
    // botão turbo: pílula pequena, dourada quando ligada
    turbo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        height: 32,
        paddingHorizontal: 10,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    turboOn: { borderColor: COLORS.gold, backgroundColor: "rgba(255, 179, 0, 0.12)" },
    turboLabel: { fontFamily: FONTS.bodySemibold, fontSize: 12 },
    helpLink: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
    skeletonRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 16, backgroundColor: COLORS.surface },
    skeletonCapsule: { width: 92, height: 34, borderRadius: 8, backgroundColor: COLORS.surface2 },
    skeletonLine: { height: 10, borderRadius: 5, backgroundColor: COLORS.surface2 },
    empty: { alignItems: "center", paddingVertical: 80, paddingHorizontal: 12, gap: 10 },
    emptyIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: COLORS.accentSoft,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 6,
    },
    topButton: {
        position: "absolute",
        right: 20,
        bottom: 100,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.surface2,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: "center",
        justifyContent: "center",
        elevation: 6,
        shadowColor: "#000",
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },
});
