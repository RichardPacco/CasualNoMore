import { useFocusEffect } from '@react-navigation/native';
import { remapProps } from "nativewind";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, FlatList, Keyboard, PanResponder, RefreshControl, Text, TextInput, TouchableOpacity, useColorScheme, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { getOwnedGames, GetSchemaForGame } from "../../src/api/steam";
import GameCard from "../../src/components/GameCard";
import { AuthContext } from "../../src/context/AuthContext";
import { getAllGames, saveGame } from "../../src/database/db";

const StyledDropdown = remapProps(Dropdown, {
    className: "style",
    containerClassName: "containerStyle",
    placeholderClassName: "placeholderStyle",
    selectedTextClassName: "selectedTextStyle",
    itemTextClassName: "itemTextStyle",
});

export default function GameList({ navigation, route }) {
    const { steamId } = useContext(AuthContext);

    // ---------- hooks / state ----------
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [filter, setFilter] = useState("all");
    const [sort, setSort] = useState("recentPlaytime");
    const [refreshing, setRefreshing] = useState(false);
    const [sidebarVisible, setSidebarVisible] = useState(false);

    // search states
    const [searchVisible, setSearchVisible] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const searchInputRef = useRef(null);

    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

    const sidebarWidth = 280;
    const sidebarAnim = useRef(new Animated.Value(-sidebarWidth)).current;

    const openSidebar = () => {
        setSidebarVisible(true);
        Animated.timing(sidebarAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    };
    const closeSidebar = () => {
        Animated.timing(sidebarAnim, { toValue: -sidebarWidth, duration: 300, useNativeDriver: true }).start(() => setSidebarVisible(false));
    };

    // Pan drag helpers
    const startAnimValueRef = useRef(-sidebarWidth);

    // PanResponder: ONLY allow drag-to-open (start near left edge). When sidebar is open, dragging does nothing.
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_evt, gs) => {
                const { dx, dy, moveX } = gs;
                const startedNearEdge = moveX < 40; // start only from left edge
                const horizontalEnough = Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy);
                // IMPORTANT: only allow starting the gesture when sidebar is closed (no drag-to-close)
                return horizontalEnough && startedNearEdge && !sidebarVisible;
            },
            onPanResponderGrant: () => {
                // capture current animated value and make sidebar render so we can drag it in
                sidebarAnim.stopAnimation((value) => {
                    startAnimValueRef.current = (typeof value === "number") ? value : -sidebarWidth;
                    // if fully closed, ensure the sidebar renders to visualize drag
                    if (startAnimValueRef.current <= -sidebarWidth + 1) {
                        setSidebarVisible(true);
                    }
                });
            },
            onPanResponderMove: (_evt, gs) => {
                const { dx } = gs;
                // only move while opening (do not allow dragging past 0)
                const next = Math.min(0, Math.max(-sidebarWidth, startAnimValueRef.current + dx));
                sidebarAnim.setValue(next);
            },
            onPanResponderRelease: (_evt, gs) => {
                const { dx, vx } = gs;
                const endPos = startAnimValueRef.current + dx;
                // open if dragged enough or flung right; otherwise snap closed
                const shouldOpen = vx > 0.35 || endPos > -sidebarWidth / 2;
                if (shouldOpen) {
                    Animated.timing(sidebarAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
                        setSidebarVisible(true);
                    });
                } else {
                    // snap back closed
                    Animated.timing(sidebarAnim, { toValue: -sidebarWidth, duration: 180, useNativeDriver: true }).start(() => {
                        setSidebarVisible(false);
                    });
                }
            },
            onPanResponderTerminate: () => {
                // if interrupted, snap to nearest (same logic as release)
                sidebarAnim.stopAnimation((value) => {
                    if (value > -sidebarWidth / 2) {
                        Animated.timing(sidebarAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setSidebarVisible(true));
                    } else {
                        Animated.timing(sidebarAnim, { toValue: -sidebarWidth, duration: 160, useNativeDriver: true }).start(() => setSidebarVisible(false));
                    }
                });
            },
            onPanResponderTerminationRequest: () => true,
        })
    ).current;

    // cancellation ref used by loadGames and the effect
    const cancelledRef = useRef(false);

    // small helper
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

    const renderGameCard = useCallback(
        ({ item }) => <GameCard game={item} navigation={navigation} />,
        [navigation]
    );

    const filterOptions = useMemo(() => [
        { label: "🎮 Todos", value: "all" },
        { label: "🚫 Nunca Jogados", value: "neverPlayed" },
        { label: "🕹️ Jogados", value: "played" },
        { label: "⏱️ Nas últimas 2 semanas", value: "recent" },
    ], []);

    const sortOptions = useMemo(() => [
        { label: "⏱️ Mais recentes", value: "recentPlaytime" },
        { label: "🔥 Tempo de Jogo", value: "totalPlaytime" },
        { label: "🔤 Nome", value: "name" },
    ], []);

    const filteredGames = useMemo(() => {
        let result = games;

        switch (filter) {
            case "played": result = result.filter(g => g.playtime_forever > 0); break;
            case "neverPlayed": result = result.filter(g => g.playtime_forever === 0); break;
            case "recent": result = result.filter(g => g.playtime_2weeks > 0); break;
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
        setRefreshing(true);
        cancelledRef.current = false;

        try {
            // 1️⃣ Carregar jogos do DB
            const cachedGames = await getAllGames(steamId);
            let enrichedGames = [...cachedGames];

            if (cachedGames.length > 0) {
                setGames(cachedGames);
                setProgress({ current: cachedGames.length, total: cachedGames.length });
                setLoading(false);
            }

            // 2️⃣ Buscar jogos fresh da Steam
            const fresh = await getOwnedGames(steamId);
            if (!fresh?.games) {
                setRefreshing(false);
                return;
            }

            const total = fresh.games.length;
            setProgress({ current: cachedGames.length, total });

            const cacheMap = new Map(cachedGames.map(g => [g.appid, g]));

            for (let i = 0; i < fresh.games.length; i++) {
                if (cancelledRef.current) break;

                const baseGame = fresh.games[i];
                const cachedEntry = cacheMap.get(baseGame.appid);

                let enriched;
                if (cachedEntry && cachedEntry.schema) {
                    enriched = { ...baseGame, schema: cachedEntry.schema, schemaStatus: cachedEntry.schemaStatus };
                } else {
                    try {
                        const schema = await GetSchemaForGame(baseGame.appid, steamId);
                        enriched = { ...baseGame, schema, schemaStatus: "done" };
                    } catch (err) {
                        // if schema fetch fails, keep the baseGame and mark pending
                        console.error("[GameList] Erro schema", baseGame.appid, err);
                        enriched = { ...baseGame, schema: null, schemaStatus: "pending" };
                    }
                }

                const idx = enrichedGames.findIndex(g => g.appid === baseGame.appid);
                let updated = false;

                if (idx >= 0) {
                    const prev = enrichedGames[idx];
                    if ((prev.playtime_forever || 0) !== (enriched.playtime_forever || 0) || prev.schemaStatus !== enriched.schemaStatus) {
                        enrichedGames[idx] = enriched;
                        updated = true;
                    }
                } else {
                    enrichedGames.push(enriched);
                    updated = true;
                }

                if (updated) {
                    await saveGame(steamId, enriched); // salva jogo no DB
                    setGames([...enrichedGames]);
                    setProgress({ current: enrichedGames.length, total });
                    // optional small throttle so UI shows progress (only when updates occur)
                    if (i < total - 1) await sleep(250);
                }
            }

            setLoading(false);
        } catch (err) {
            console.error("[GameList] loadGames failed", err);
            setLoading(false);
        } finally {
            setRefreshing(false);
        }
    }, [steamId]);

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

    useFocusEffect(
        useCallback(() => {
            const resetAt = route?.params?.resetSearchAt;
            if (resetAt) {
                // Reset search UI/state
                setSearchVisible(false);
                setSearchQuery('');
                setDebouncedQuery('');
                if (searchInputRef.current?.blur) searchInputRef.current.blur();

                // Optional: close sidebar
                closeSidebar();

                // Clear the param so the reset only happens once
                navigation.setParams({ resetSearchAt: undefined });
            }
        }, [route?.params?.resetSearchAt])
    );

    // ---------- UI ----------
    if (loading && games.length === 0) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-900">
                <ActivityIndicator size="large" color="#4ade80" />
                {progress.total > 0 && (
                    <Text className="text-gray-400 mt-2">
                        Buscando {progress.current}/{progress.total} jogos…
                    </Text>
                )}
            </View>
        );
    }

    const dropdownClass = isDark
        ? "rounded-xl px-4 py-2 mb-4 border bg-slate-800 border-green-400"
        : "rounded-xl px-4 py-2 mb-4 border bg-slate-200 border-gray-400";
    const dropdownContainerClass = isDark
        ? "bg-slate-800 rounded-xl border border-green-400 py-1"
        : "bg-slate-50 rounded-xl border border-gray-300 py-1";

    const containerStyleForced = {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: isDark ? "#4ade80" : "#9ca3af",
        backgroundColor: isDark ? "#1f2937" : "#f9fafb",
        paddingVertical: 4,
    };

    const mainStyleForced = {
        backgroundColor: isDark ? "#111827" : "#e5e7eb",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: isDark ? "#4ade80" : "#9ca3af",
    };

    const placeholderStyleObj = { color: isDark ? "#9ca3af" : "#374151", fontSize: 16 };
    const selectedTextStyleObj = { color: isDark ? "#4ade80" : "#111111", fontSize: 16, fontWeight: "600" };
    const itemTextStyleObj = { color: isDark ? "#ffffff" : "#111111", fontSize: 15 };

    return (
        <View
            {...panResponder.panHandlers}
            className={`flex-1 p-4 ${isDark ? "bg-gray-900" : "bg-white"}`}
        >
            {/* top row: search toggle + filters */}
            <View className="flex-row items-center mb-3">
                {/* search toggle / input */}
                <View style={{ flex: 1 }}>
                    {/* always-visible search input */}
                    <View className="flex-row items-center">
                        <TextInput
                            ref={searchInputRef}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Pesquisar jogos..."
                            placeholderTextColor={isDark ? "#9ca3af" : "#6b7280"}
                            returnKeyType="search"
                            onSubmitEditing={() => Keyboard.dismiss()}
                            className={`flex-1 rounded-xl px-4 py-2 border ${isDark
                                ? "bg-slate-800 border-green-400 text-white"
                                : "bg-slate-100 border-gray-300 text-black"
                                }`}
                            style={{ fontSize: 16 }}
                        />

                        {/* Clear query */}
                        <TouchableOpacity
                            onPress={() => {
                                setSearchQuery("");
                                setDebouncedQuery("");
                                // keep focus so the user can keep typing
                                if (searchInputRef.current?.focus) searchInputRef.current.focus();
                            }}
                            style={{ marginLeft: 8 }}
                        >
                            <Text style={{ color: isDark ? "#4ade80" : "#111" }}>Limpar</Text>
                        </TouchableOpacity>
                    </View>

                </View>

                {/* filters toggle */}
                <TouchableOpacity
                    onPress={openSidebar}
                    style={{ marginLeft: 12, padding: 12, backgroundColor: isDark ? '#1f2937' : '#f3f4f6', borderRadius: 10 }}
                >
                    <Text style={{ color: isDark ? '#4ade80' : '#111' }}>☰</Text>
                </TouchableOpacity>
            </View>

            {/* overlay + Sidebar (rendered when sidebarVisible) */}
            {sidebarVisible && (
                <>
                    {/* overlay to tap to close */}
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={closeSidebar}
                        style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            bottom: 0,
                            right: 0,
                            backgroundColor: "rgba(0,0,0,0.28)",
                            zIndex: 9,
                        }}
                    />

                    <Animated.View
                        style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: sidebarWidth,
                            backgroundColor: isDark ? "#111827" : "#f9fafb",
                            transform: [{ translateX: sidebarAnim }],
                            padding: 16,
                            zIndex: 10,
                            shadowColor: "#000",
                            shadowOpacity: 0.2,
                            shadowRadius: 6,
                            shadowOffset: { width: 2, height: 0 },
                        }}
                    >
                        <TouchableOpacity onPress={closeSidebar} style={{ marginBottom: 20 }}>
                            <Text style={{ color: isDark ? "#4ade80" : "#111", fontWeight: "bold" }}>✕ Fechar</Text>
                        </TouchableOpacity>

                        {/* Sidebar dropdowns: override text colors for dark mode */}
                        <StyledDropdown
                            className={dropdownClass}
                            containerClassName={dropdownContainerClass}
                            containerStyle={{
                                ...containerStyleForced,
                                backgroundColor: isDark ? "#1f2937" : containerStyleForced.backgroundColor,
                            }}
                            style={{
                                ...mainStyleForced,
                                backgroundColor: isDark ? "#0b1220" : mainStyleForced.backgroundColor,
                            }}
                            placeholderStyle={{ color: isDark ? "#9ca3af" : "#374151", fontSize: 16 }}
                            selectedTextStyle={{ color: isDark ? "#4ade80" : "#111111", fontSize: 16, fontWeight: "600" }}
                            itemTextStyle={{ color: isDark ? "#ffffff" : "#111111", fontSize: 15 }}
                            activeColor={isDark ? "rgba(74, 222, 128, 0.12)" : "#d1fae5"}
                            placeholder="🎯 Filtro"
                            value={filter}
                            onChange={(item) => setFilter(item.value)}
                            data={filterOptions}
                            labelField="label"
                            valueField="value"
                        />

                        <StyledDropdown
                            className={dropdownClass}
                            containerClassName={dropdownContainerClass}
                            containerStyle={{
                                ...containerStyleForced,
                                backgroundColor: isDark ? "#1f2937" : containerStyleForced.backgroundColor,
                            }}
                            style={{
                                ...mainStyleForced,
                                backgroundColor: isDark ? "#0b1220" : mainStyleForced.backgroundColor,
                            }}
                            placeholderStyle={{ color: isDark ? "#9ca3af" : "#374151", fontSize: 16 }}
                            selectedTextStyle={{ color: isDark ? "#4ade80" : "#111111", fontSize: 16, fontWeight: "600" }}
                            itemTextStyle={{ color: isDark ? "#ffffff" : "#111111", fontSize: 15 }}
                            activeColor={isDark ? "rgba(74, 222, 128, 0.12)" : "#d1fae5"}
                            placeholder="⏱️ Ordenar por"
                            value={sort}
                            onChange={(item) => setSort(item.value)}
                            data={sortOptions}
                            labelField="label"
                            valueField="value"
                        />
                    </Animated.View>
                </>
            )}

            <FlatList
                data={filteredGames}
                keyExtractor={(item) => item.appid.toString()}
                renderItem={renderGameCard}
                initialNumToRender={10}
                windowSize={5}
                removeClippedSubviews={true}
                contentContainerStyle={{ paddingTop: 12 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={loadGames} />
                }
                ListHeaderComponent={
                    progress.current < progress.total ? (
                        <View className="py-4 items-center">
                            <ActivityIndicator size="small" color="#4ade80" />
                            <Text className="text-gray-400 mt-2">
                                Carregando {progress.current}/{progress.total}
                            </Text>
                        </View>
                    ) : null
                }
            />
        </View>
    );
}
