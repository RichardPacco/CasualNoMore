import { getOwnedGames, GetSchemaForGame } from "@/src/api/steam";
import GameCard from "@/src/components/GameCard";
import PullToRefresh from "@/src/components/PullToRefresh";
import RadioSheet from "@/src/components/RadioSheet";
import { AuthContext } from "@/src/context/AuthContext";
import { getAllGames, saveGamesBatch } from "@/src/database/db";
import { COLORS } from "@/src/theme/colors";
import { useTheme } from "@/src/theme/styles";
import { fetchAndMergeAchievements } from "@/src/utils/achievements";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, Text, TextInput, TouchableOpacity, useColorScheme, View } from "react-native";

export default function GameList({ navigation, route }) {
    const { steamId } = useContext(AuthContext);

    // ---------- hooks / state ----------
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [filter, setFilter] = useState("all");
    const [sort, setSort] = useState("recentPlaytime");
    const [refreshing, setRefreshing] = useState(false);
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
        let schema = cached?.schema ?? null;
        let schemaStatus = cached?.schemaStatus || "pending";
        let achievements = cached?.achievements ?? null;
        let achievementsStatus = cached?.achievementsStatus || "pending";
        let details = cached?.details ?? null;
        let detailsStatus = cached?.detailsStatus || "pending";

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

        // Detalhes da loja são buscados sob demanda no GameDetailsTab e persistidos no DB
        return {
            ...baseGame,
            playtime_forever: baseGame.playtime_forever || 0,
            playtime_2weeks: baseGame.playtime_2weeks || 0,
            schema, schemaStatus, achievements, achievementsStatus, details, detailsStatus
        };
    }, [steamId]);

    const renderGameCard = useCallback(
        ({ item }) => <GameCard game={item} navigation={navigation} />,
        [navigation]
    );

    const filterOptions = useMemo(() => [
        { label: "Todos", value: "all" },
        { label: "Nunca Jogados", value: "neverPlayed" },
        { label: "Jogados", value: "played" },
        { label: "Nas últimas 2 semanas", value: "recent" },
        { label: "Com Conquistas", value: "withAchievements" },
        { label: "Sem Conquistas", value: "withoutAchievements" },
        { label: "Completados", value: "completed" },
        { label: "Backlog", value: "progress" },
    ], []);

    const sortOptions = useMemo(() => [
        { label: "Mais recentes", value: "recentPlaytime" },
        { label: "Tempo de Jogo", value: "totalPlaytime" },
        { label: "Nome", value: "name" },
    ], []);

    const filterCounts = useMemo(() => {
        const countFor = (value) => {
            switch (value) {
                case "played": return games.filter(g => g.playtime_forever > 0).length;
                case "neverPlayed": return games.filter(g => g.playtime_forever === 0).length;
                case "recent": return games.filter(g => g.playtime_2weeks > 0).length;
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
            case "recent": result = result.filter(g => g.playtime_2weeks > 0); break;
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
                        || prev.schemaStatus !== enriched.schemaStatus
                        || prev.achievementsStatus !== enriched.achievementsStatus
                        || prev.detailsStatus !== enriched.detailsStatus) {
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
    }, [steamId, loadGames]);

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
                        Buscando {progress.current}/{progress.total} jogos…
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
                    placeholder="Pesquisar jogos..."
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
                    <Text style={{ color: isDark ? COLORS.accent : "#111" }}>Limpar</Text>
                </TouchableOpacity>
            </View>

            <PullToRefresh refreshing={refreshing} onRefresh={onRefresh}>
                <FlatList
                    ref={listRef}
                    data={filteredGames}
                    keyExtractor={(item) => item.appid.toString()}
                    renderItem={renderGameCard}
                    initialNumToRender={10}
                    windowSize={5}
                    contentContainerStyle={{ paddingTop: 12 }}
                    onScroll={(e) => {
                        setShowTopButton(e.nativeEvent.contentOffset.y > 400);
                    }}
                    ListHeaderComponent={
                        progress.current < progress.total ? (
                            <View className="py-4 items-center">
                                <ActivityIndicator size="small" color={COLORS.accent} />
                                <Text className={`${t.textSecondary} mt-2`}>
                                    Carregando {progress.current}/{progress.total}
                                </Text>
                            </View>
                        ) : null
                    }
                />
            </PullToRefresh>

            {/* floating buttons: filter + sort + scroll to top */}
            <View className="absolute bottom-6 right-6 gap-3">
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
                title="Filtrar"
                options={filterOptions}
                selected={filter}
                onSelect={setFilter}
                counts={filterCounts}
            />

            <RadioSheet
                visible={sortVisible}
                onClose={() => setSortVisible(false)}
                title="Ordenar por"
                options={sortOptions}
                selected={sort}
                onSelect={setSort}
            />
        </View>
    );
}
