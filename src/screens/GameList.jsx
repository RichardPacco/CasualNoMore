import { getOwnedGames, GetSchemaForGame } from "@/src/api/steam";
import GameCard from "@/src/components/GameCard";
import PullToRefresh from "@/src/components/PullToRefresh";
import RadioSheet from "@/src/components/RadioSheet";
import { AuthContext } from "@/src/context/AuthContext";
import { getAllGames, saveGame, saveGamesBatch } from "@/src/database/db";
import { getLanguageStore } from "@/src/i18n/langStore";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS } from "@/src/theme/colors";
import { useTheme } from "@/src/theme/styles";
import { fetchAndMergeAchievements } from "@/src/utils/achievements";
import { showToast } from "@/src/utils/toast";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, Text, TextInput, TouchableOpacity, useColorScheme, View } from "react-native";

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
    const searchInputRef = useRef(null);

    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";
    const t = useTheme();

    // cancellation ref used by loadGames and the effect
    const cancelledRef = useRef(false);

    // small helper
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

    /**
     * Completa um jogo com toda a informação disponível:
     * schema, conquistas (com progresso) e detalhes da loja.
     * Só busca o que ainda não foi cacheado.
     */
    const enrichGame = useCallback(async (baseGame, cached) => {
        const lang = getLanguageStore();
        const stale = cached ? cached.lang !== lang : false;

        let schema = stale ? null : (cached?.schema ?? null);
        let schemaStatus = stale ? "pending" : (cached?.schemaStatus || "pending");
        let achievements = stale ? null : (cached?.achievements ?? null);
        let achievementsStatus = stale ? "pending" : (cached?.achievementsStatus || "pending");
        let details = stale ? null : (cached?.details ?? null);
        let detailsStatus = stale ? "pending" : (cached?.detailsStatus || "pending");

        if (schemaStatus === "pending") {
            try {
                schema = await GetSchemaForGame(baseGame.appid, steamId);
                schemaStatus = "done";
            } catch (err) {
                console.error("[GameList] Erro schema", baseGame.appid, err);
                schemaStatus = "pending";
            }
        }

        if (achievementsStatus === "pending") {
            try {
                achievements = await fetchAndMergeAchievements(baseGame.appid, steamId, schema);
                achievementsStatus = "done";
            } catch (err) {
                console.error("[GameList] Erro achievements", baseGame.appid, err);
                achievementsStatus = "pending";
            }
        }

        // Detalhes da loja são buscados sob demanda no GameDetailsTab e persistidos no DB.
        // Steam mascara tempo de jogo privado como 0 (não omite o campo). Se o jogo tem
        // conquistas desbloqueadas ele foi jogado — logo playtime 0 significa tempo privado.
        const rawPlaytime = baseGame.playtime_forever || 0;
        const unlockedCount = (achievements || []).filter(a => a.achieved).length;
        const playtimeHidden = rawPlaytime === 0 && unlockedCount > 0;
        return {
            ...baseGame,
            playtime_forever: rawPlaytime,
            playtime_2weeks: baseGame.playtime_2weeks || 0,
            playtimeHidden,
            schema, schemaStatus, achievements, achievementsStatus, details, detailsStatus,
            lang,
        };
    }, [steamId]);

    /**
     * Força refetch completo de um jogo (playtime, schema, conquistas),
     * salva no DB e atualiza a lista.
     */
    const forceRefreshGame = useCallback(async (baseGame) => {
        const reset = {
            ...baseGame,
            schema: null,
            schemaStatus: "pending",
            achievements: null,
            achievementsStatus: "pending",
        };
        const fresh = await enrichGame(baseGame, reset);

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

            await forceRefreshGame(baseGame);
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
        showToast(tr("gameRefreshing"), "info");
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
                await forceRefreshGame(baseGame);
            }

            showToast(tr("gameRefreshed"), "success");
        } catch (err) {
            console.error("[GameList] refreshRecentGames failed", err);
            showToast(tr("gameRefreshFailed"), "error");
        } finally {
            setRefreshingRecent(false);
        }
    }, [steamId, forceRefreshGame, refreshingRecent, tr]);

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
                case "withAchievements": return games.filter(g => (g.achievements || []).length > 0).length;
                case "withoutAchievements": return games.filter(g => (g.achievements || []).length === 0).length;
                case "completed": return games.filter(g => {
                    const list = g.achievements || [];
                    return list.length > 0 && list.every(a => a.achieved);
                }).length;
                case "progress": return games.filter(g => {
                    const list = g.achievements || [];
                    return list.length > 0 && !list.every(a => a.achieved) && list.some(a => a.achieved);
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
            case "withAchievements": result = result.filter(g => (g.achievements || []).length > 0); break;
            case "withoutAchievements": result = result.filter(g => (g.achievements || []).length === 0); break;
            case "completed": result = result.filter(g => {
                const list = g.achievements || [];
                return list.length > 0 && list.every(a => a.achieved);
            }); break;
            case "progress": result = result.filter(g => {
                const list = g.achievements || [];
                return list.length > 0 && !list.every(a => a.achieved) && list.some(a => a.achieved);
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
        cancelledRef.current = false;

        try {
            // 1️⃣ Load games from DB
            const cachedGames = await getAllGames(steamId);
            let enrichedGames = [...cachedGames];

            if (cachedGames.length > 0) {
                setGames(cachedGames);
                setProgress({ current: cachedGames.length, total: cachedGames.length });
                setLoading(false);
            }

            // 2️⃣ Fetch fresh games from Steam
            const fresh = await getOwnedGames(steamId);
            if (!fresh?.games) {
                if (cachedGames.length === 0) setLoading(false);
                return;
            }

            const total = fresh.games.length;
            setProgress({ current: cachedGames.length, total });

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

            const cacheMap = new Map(cachedGames.map(g => [g.appid, g]));
            const BATCH_SIZE = 5;
            let batchToSave = [];

            for (let i = 0; i < freshGames.length; i++) {
                if (cancelledRef.current) break;

                const baseGame = freshGames[i];
                const cachedEntry = cacheMap.get(baseGame.appid);

                const enriched = await enrichGame(baseGame, cachedEntry);

                const idx = enrichedGames.findIndex(g => g.appid === baseGame.appid);
                let updated = false;

                if (idx >= 0) {
                    const prev = enrichedGames[idx];
                    if (prev.playtime_forever !== enriched.playtime_forever
                        || prev.playtime_2weeks !== enriched.playtime_2weeks
                        || !!prev.playtimeHidden !== !!enriched.playtimeHidden
                        || prev.schemaStatus !== enriched.schemaStatus
                        || prev.achievementsStatus !== enriched.achievementsStatus
                        || prev.detailsStatus !== enriched.detailsStatus
                        || prev.lang !== enriched.lang) {
                        enrichedGames[idx] = enriched;
                        updated = true;
                    }
                } else {
                    enrichedGames.push(enriched);
                    updated = true;
                }

                if (updated) {
                    batchToSave.push(enriched);

                    // Update UI immediately
                    setGames([...enrichedGames]);
                    setProgress({ current: enrichedGames.length, total });

                    // Save batch if reached BATCH_SIZE or last item
                    if (batchToSave.length >= BATCH_SIZE || i === freshGames.length - 1) {
                        await saveGamesBatch(steamId, batchToSave);
                        batchToSave = [];
                    }

                    // Optional small throttle so UI shows progress
                    if (i < total - 1) await sleep(200);
                }
            }

            // Finish sync: clear progress header even if nothing was updated
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
        cancelledRef.current = false;
        loadGames();
        return () => {
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
            <View className="flex-row items-center mb-3">
                <TextInput
                    ref={searchInputRef}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder={tr("searchGamesPlaceholder")}
                    placeholderTextColor={isDark ? "#9ca3af" : "#6b7280"}
                    returnKeyType="search"
                    onSubmitEditing={() => Keyboard.dismiss()}
                    className={`flex-1 rounded-xl px-4 py-2 border ${isDark
                        ? "bg-slate-800 border-accent text-white"
                        : "bg-slate-100 border-gray-300 text-black"
                        }`}
                    style={{ fontSize: 16 }}
                />

                {/* Clear query */}
                <TouchableOpacity
                    onPress={() => {
                        setSearchQuery("");
                        setDebouncedQuery("");
                    }}
                    style={{ marginLeft: 8 }}
                >
                    <Text style={{ color: isDark ? COLORS.accent : "#111" }}>{tr("clear")}</Text>
                </TouchableOpacity>
            </View>

            <PullToRefresh refreshing={refreshing} onRefresh={onRefresh}>
                <FlatList
                    ref={listRef}
                    data={recentBlock ? recentBlock.rest : filteredGames}
                    keyExtractor={(item) => item.appid.toString()}
                    renderItem={renderGameCard}
                    initialNumToRender={10}
                    windowSize={5}
                    contentContainerStyle={{ paddingTop: 12, paddingBottom: 70 }}
                    onScroll={(e) => {
                        setShowTopButton(e.nativeEvent.contentOffset.y > 400);
                    }}
                    ListHeaderComponent={
                        <>
                            {progress.current < progress.total && (
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
