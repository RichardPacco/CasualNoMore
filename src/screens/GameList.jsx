import { getOwnedGames, GetSchemaForGame } from "@/src/api/steam";
import GameCard from "@/src/components/GameCard";
import PullToRefresh from "@/src/components/PullToRefresh";
import RadioSheet from "@/src/components/RadioSheet";
import { AuthContext } from "@/src/context/AuthContext";
import { getAllGames, parseJson, saveGame, saveGamesBatch } from "@/src/database/db";
import { getLanguageStore } from "@/src/i18n/langStore";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS } from "@/src/theme/colors";
import { useTheme } from "@/src/theme/styles";
import { computeProgress, fetchAndMergeAchievements, getGameCounts } from "@/src/utils/achievements";
import { showToast } from "@/src/utils/toast";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Text, TouchableOpacity, useColorScheme, View } from "react-native";
import SearchBar from "@/src/components/SearchBar";

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
    const [filterVisible, setFilterVisible] = useState(false);
    const [sortVisible, setSortVisible] = useState(false);
    const [showTopButton, setShowTopButton] = useState(false);
    const listRef = useRef(null);

    // search states
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");

    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";
    const t = useTheme();

    // geração da carga atual: quando uma nova carga começa (ou o componente
    // desmonta), o número muda e execuções antigas param de escrever na UI/DB.
    // Um simples boolean não serve — a nova carga rearmaria o flag e a execução
    // antiga continuaria rodando em paralelo (progresso e lista "bugados").
    const loadGenRef = useRef(0);

    // cancellation ref usado pelo refreshRecentGames (cancela no unmount)
    const cancelledRef = useRef(false);

    /**
     * Completa um jogo com toda a informação disponível:
     * schema, conquistas (com progresso) e detalhes da loja.
     * Só busca o que ainda não foi cacheado. Se uma busca falhar,
     * mantém o dado antigo (fallback) e deixa o status "pending"
     * para tentar de novo na próxima carga.
     */
    const enrichGame = useCallback(async (baseGame, cached, force = false) => {
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
            lang,
        };
    }, [steamId]);

    /**
     * Força refetch completo de um jogo (playtime, schema, conquistas).
     * `existing` (jogo atual da lista) serve de fallback se algo falhar.
     */
    const forceRefreshGame = useCallback(async (baseGame, existing) => {
        const fresh = await enrichGame(baseGame, existing, true);

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
            const baseGame = owned?.games?.find(g => g.appid === game.appid);
            if (!baseGame) throw new Error("game not in owned list");

            await forceRefreshGame(baseGame, game);
            showToast(tr("gameRefreshed"), "success");
        } catch (err) {
            console.error("[GameList] refreshSingleGame failed", game.appid, err);
            showToast(tr("gameRefreshFailed"), "error");
        }
    }, [steamId, forceRefreshGame, tr]);

    /**
     * Atualiza por completo apenas os jogos jogados nas últimas 2 semanas
     * (playtime_2weeks > 0) — botão de refresh recentes.
     */
    const refreshRecentGames = useCallback(async () => {
        if (refreshingRecent) return;
        setRefreshingRecent(true);
        showToast(tr("gameRecentRefresh"), "info");
        try {
            const owned = await getOwnedGames(steamId);
            if (!owned?.games) throw new Error("no games");

            const recent = owned.games.filter(g => (g.playtime_2weeks || 0) > 0);
            if (recent.length === 0) {
                showToast(tr("noRecentGames"), "info");
                return;
            }

            for (const baseGame of recent) {
                if (cancelledRef.current) break;
                const existing = games.find(g => g.appid === baseGame.appid);
                await forceRefreshGame(baseGame, existing);
            }

            showToast(tr("gameRecentRefreshed"), "success");
        } catch (err) {
            console.error("[GameList] refreshRecentGames failed", err);
            showToast(tr("gameRefreshFailed"), "error");
        } finally {
            setRefreshingRecent(false);
        }
    }, [steamId, forceRefreshGame, refreshingRecent, tr, games]);

    // jogo "recente" = jogado nas últimas 2 semanas
    const isRecentGame = useCallback((g) => (g.playtime_2weeks || 0) > 0, []);

    const renderGameCard = useCallback(
        ({ item }) => <GameCard game={item} navigation={navigation} onLongPress={refreshSingleGame} />,
        [navigation, refreshSingleGame]
    );

    const filterOptions = useMemo(() => [
        { label: tr("filterAll"), value: "all" },
        { label: tr("filterNeverPlayed"), value: "neverPlayed" },
        { label: tr("filterPlayed"), value: "played" },
        { label: tr("filterWithAchievements"), value: "withAchievements" },
        { label: tr("filterWithoutAchievements"), value: "withoutAchievements" },
        { label: tr("filterCompleted"), value: "completed" },
        { label: tr("filterBacklog"), value: "progress" },
    ], [tr]);

    const sortOptions = useMemo(() => [
        { label: tr("sortRecent"), value: "recentPlaytime" },
        { label: tr("sortPlaytime"), value: "totalPlaytime" },
        { label: tr("sortName"), value: "name" },
    ], [tr]);

    const filterCounts = useMemo(() => {
        const countFor = (value) => {
            switch (value) {
                case "played": return games.filter(g => g.playtime_forever > 0).length;
                case "neverPlayed": return games.filter(g => g.playtime_forever === 0).length;
                case "withAchievements": return games.filter(g => getGameCounts(g).total > 0).length;
                case "withoutAchievements": return games.filter(g => getGameCounts(g).total === 0).length;
                case "completed": return games.filter(g => {
                    const { unlocked, total } = getGameCounts(g);
                    return total > 0 && unlocked === total;
                }).length;
                case "progress": return games.filter(g => {
                    const { unlocked, total } = getGameCounts(g);
                    return total > 0 && unlocked > 0 && unlocked !== total;
                }).length;
                default: return games.length;
            }
        };
        return filterOptions.reduce((acc, opt) => {
            acc[opt.value] = countFor(opt.value);
            return acc;
        }, {});
    }, [games, filterOptions]);

    const filteredGames = useMemo(() => {
        let result = games;

        switch (filter) {
            case "played": result = result.filter(g => g.playtime_forever > 0); break;
            case "neverPlayed": result = result.filter(g => g.playtime_forever === 0); break;
            case "withAchievements": result = result.filter(g => getGameCounts(g).total > 0); break;
            case "withoutAchievements": result = result.filter(g => getGameCounts(g).total === 0); break;
            case "completed": result = result.filter(g => {
                const { unlocked, total } = getGameCounts(g);
                return total > 0 && unlocked === total;
            }); break;
            case "progress": result = result.filter(g => {
                const { unlocked, total } = getGameCounts(g);
                return total > 0 && unlocked > 0 && unlocked !== total;
            }); break;
            default: break;
        }

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

    // ---------- load jogos ----------
    const loadGames = useCallback(async () => {
        if (!steamId) return;
        const gen = ++loadGenRef.current;
        cancelledRef.current = false;

        try {
            // 1️⃣ Load games from DB
            const cachedGames = await getAllGames(steamId);
            if (loadGenRef.current !== gen) return;

            // Map appid -> índice na lista: lookups O(1) no lugar do findIndex
            const gameMap = new Map();
            const gamesList = [];
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
            if (loadGenRef.current !== gen) return;
            if (!fresh?.games) {
                if (gamesList.length === 0) setLoading(false);
                return;
            }

            const total = fresh.games.length;
            setProgress({ current: gamesList.length, total });

            // Processa primeiro os jogos mais relevantes (mais jogados recentemente)
            // para que o topo da lista ganhe dados (progresso) antes do resto
            const freshGames = [...fresh.games].sort((a, b) => {
                const a2 = a.playtime_2weeks || 0;
                const b2 = b.playtime_2weeks || 0;
                if (b2 !== a2) return b2 - a2;
                const a0 = a.playtime_forever || 0;
                const b0 = b.playtime_forever || 0;
                if (b0 !== a0) return b0 - a0;
                return (a.name || "").localeCompare(b.name || "");
            });

            // Enriquecimento em paralelo (poucos por vez para não estourar a API)
            // e atualização da UI + persistência em lotes (reduz re-renders e I/O).
            const CONCURRENCY = 5;  // quantos jogos são enriquecidos ao mesmo tempo
            const UI_BATCH = 10;    // a cada quantos jogos a lista é re-renderizada
            let batchToSave = [];
            let updatedAny = false;

            for (let i = 0; i < freshGames.length; i += CONCURRENCY) {
                if (loadGenRef.current !== gen) return;

                const chunk = freshGames.slice(i, i + CONCURRENCY);
                const enrichedChunk = await Promise.all(chunk.map(baseGame => {
                    const idx = gameMap.get(baseGame.appid);
                    const cachedEntry = idx !== undefined ? gamesList[idx] : null;
                    return enrichGame(baseGame, cachedEntry);
                }));
                if (loadGenRef.current !== gen) return;

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
                            || prev.lang !== enriched.lang;
                        if (!changed) continue;
                        gamesList[idx] = enriched;
                    } else {
                        gameMap.set(enriched.appid, gamesList.length);
                        gamesList.push(enriched);
                    }

                    updatedAny = true;
                    batchToSave.push(enriched);
                }

                setProgress({ current: Math.min(i + CONCURRENCY, total), total });

                // Atualiza a lista e persiste em lotes, não a cada jogo
                if (updatedAny && (batchToSave.length >= UI_BATCH || i + CONCURRENCY >= freshGames.length)) {
                    setGames([...gamesList]);
                    await saveGamesBatch(steamId, batchToSave);
                    batchToSave = [];
                }
            }

            // Finish sync: clear progress header even if nothing was updated
            if (loadGenRef.current !== gen) return;
            setProgress({ current: total, total });
            setLoading(false);
        } catch (err) {
            console.error("[GameList] loadGames failed", err);
            setLoading(false);
        }
    }, [steamId, enrichGame]);

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
        loadGames();
        return () => {
            // Cancela a carga em andamento (troca de idioma ou unmount):
            // a execução antiga detecta a geração nova e para de escrever.
            // eslint-disable-next-line react-hooks/exhaustive-deps -- incremento intencional do counter
            loadGenRef.current++;
            cancelledRef.current = true;
        };
    }, [steamId, loadGames, language]);

    // debounce search query
    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
        return () => clearTimeout(t);
    }, [searchQuery]);


    // ---------- UI ----------
    if (loading && games.length === 0) {
        return (
            <View className={`flex-1 justify-center items-center ${t.pageBg}`}>
                <ActivityIndicator size="large" color={COLORS.accent} />
                {progress.total > 0 && (
                    <Text className={`${t.textSecondary} mt-2`}>
                        {tr("searchingGames", { current: progress.current, total: progress.total })}
                    </Text>
                )}
            </View>
        );
    }

    return (
        <View
            className={`flex-1 p-4 ${t.pageBg}`}
        >
            {/* search input */}
            <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                onClear={() => {
                    setSearchQuery("");
                    setDebouncedQuery("");
                }}
                placeholder={tr("searchGamesPlaceholder")}
                inputProps={{
                    returnKeyType: "search",
                    onSubmitEditing: () => Keyboard.dismiss(),
                }}
            />

            <PullToRefresh refreshing={refreshing} onRefresh={onRefresh} enabled={progress.current >= progress.total}>
                <FlashList
                    ref={listRef}
                    data={recentBlock ? recentBlock.rest : filteredGames}
                    keyExtractor={(item) => item.appid.toString()}
                    renderItem={renderGameCard}
                    maintainVisibleContentPosition={{ disabled: true }}
                    contentContainerStyle={{ paddingTop: 12, paddingBottom: 70 }}
                    onScroll={(e) => {
                        setShowTopButton(e.nativeEvent.contentOffset.y > 400);
                    }}
                    ListHeaderComponent={
                        <>
                            {!refreshing && progress.current < progress.total && (
                                <View className="py-4 items-center">
                                    <ActivityIndicator size="small" color={COLORS.accent} />
                                    <Text className={`${t.textSecondary} mt-2`}>
                                        {tr("loadingGames", { current: progress.current, total: progress.total })}
                                    </Text>
                                </View>
                            )}

                            {recentBlock && recentBlock.recent.length > 0 && (
                                <View
                                    className={`rounded-xl ${t.elevatedCardBg} p-2 mb-4`}
                                    style={{ borderWidth: 1, borderColor: COLORS.accent }}
                                >
                                    <View className="flex-row items-center gap-2 px-2 pb-1">
                                        <Text className="text-xs font-semibold uppercase tracking-wide"
                                            style={{ color: COLORS.accent }}>
                                            {tr("recentGamesSeparator")}
                                        </Text>
                                        <View className="flex-1 h-px" style={{ backgroundColor: COLORS.accent }} />
                                    </View>
                                    {recentBlock.recent.map(g => (
                                        <GameCard
                                            key={g.appid}
                                            game={g}
                                            navigation={navigation}
                                            onLongPress={refreshSingleGame}
                                        />
                                    ))}
                                </View>
                            )}
                        </>
                    }
                    ListEmptyComponent={
                        games.length === 0 ? (
                            <View className="items-center justify-center py-20 px-6">
                                <View className="w-16 h-16 rounded-full bg-accent/15 items-center justify-center mb-4">
                                    <Ionicons name="game-controller-outline" size={30} color={COLORS.accent} />
                                </View>
                                <Text className="text-white text-lg font-bold text-center">
                                    {tr("noGamesTitle")}
                                </Text>
                                <Text className={`${t.textSecondary} text-sm text-center mt-2`}>
                                    {tr("noGamesMessage")}
                                </Text>
                            </View>
                        ) : null
                    }
                />
            </PullToRefresh>

            {/* floating buttons: refresh recent + filter + sort + scroll to top */}
            <View className="absolute bottom-24 right-6 gap-3">
                <TouchableOpacity
                    onPress={refreshRecentGames}
                    disabled={refreshingRecent}
                    activeOpacity={0.8}
                    accessibilityLabel={tr("refreshRecentGames")}
                    className={`w-12 h-12 rounded-xl items-center justify-center border ${t.elevatedCardBg} ${t.cardBorder}`}
                    style={{
                        elevation: 6,
                        shadowColor: "#000",
                        shadowOpacity: 0.25,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 3 },
                    }}
                >
                    {refreshingRecent ? (
                        <ActivityIndicator size="small" color={COLORS.accent} />
                    ) : (
                        <Ionicons name="refresh" size={22} color={COLORS.accent} />
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setFilterVisible(true)}
                    activeOpacity={0.8}
                    className={`w-12 h-12 rounded-xl items-center justify-center border ${t.elevatedCardBg} ${t.cardBorder}`}
                    style={{
                        elevation: 6,
                        shadowColor: "#000",
                        shadowOpacity: 0.25,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 3 },
                    }}
                >
                    <Ionicons
                        name={filter === "all" ? "funnel-outline" : "funnel"}
                        size={22}
                        color={COLORS.accent}
                    />
                    {filter !== "all" && (
                        <View
                            style={{
                                position: "absolute",
                                top: 8,
                                right: 8,
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: COLORS.warning,
                                borderWidth: 1,
                                borderColor: isDark ? "#111827" : "#ffffff",
                            }}
                        />
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setSortVisible(true)}
                    activeOpacity={0.8}
                    className={`w-12 h-12 rounded-xl items-center justify-center border ${t.elevatedCardBg} ${t.cardBorder}`}
                    style={{
                        elevation: 6,
                        shadowColor: "#000",
                        shadowOpacity: 0.25,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 3 },
                    }}
                >
                    <Ionicons
                        name={sort === "recentPlaytime" ? "swap-vertical-outline" : "swap-vertical"}
                        size={22}
                        color={COLORS.accent}
                    />
                    {sort !== "recentPlaytime" && (
                        <View
                            style={{
                                position: "absolute",
                                top: 8,
                                right: 8,
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: COLORS.warning,
                                borderWidth: 1,
                                borderColor: isDark ? "#111827" : "#ffffff",
                            }}
                        />
                    )}
                </TouchableOpacity>

                {showTopButton && (
                    <TouchableOpacity
                        onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
                        activeOpacity={0.8}
                        className={`w-12 h-12 rounded-xl items-center justify-center border ${t.elevatedCardBg} ${t.cardBorder}`}
                        style={{
                            elevation: 6,
                            shadowColor: "#000",
                            shadowOpacity: 0.25,
                            shadowRadius: 6,
                            shadowOffset: { width: 0, height: 3 },
                        }}
                    >
                        <Ionicons name="chevron-up-outline" size={24} color={COLORS.accent} />
                    </TouchableOpacity>
                )}
            </View>

            <RadioSheet
                visible={filterVisible}
                onClose={() => setFilterVisible(false)}
                title={tr("filterTitle")}
                options={filterOptions}
                selected={filter}
                onSelect={setFilter}
                counts={filterCounts}
            />

            <RadioSheet
                visible={sortVisible}
                onClose={() => setSortVisible(false)}
                title={tr("sortTitle")}
                options={sortOptions}
                selected={sort}
                onSelect={setSort}
            />
        </View>
    );
}
