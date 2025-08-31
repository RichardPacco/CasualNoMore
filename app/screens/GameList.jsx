import { remapProps } from "nativewind";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, FlatList, PanResponder, Text, useColorScheme, View, } from "react-native";
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

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default function GameList({ navigation }) {
    const { steamId } = useContext(AuthContext);

    // ---------- hooks / state ----------
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [filter, setFilter] = useState("all");

    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

    const renderGameCard = useCallback(
        ({ item }) => <GameCard game={item} navigation={navigation} />,
        [navigation]
    );

    const filterOptions = useMemo(
        () => [
            { label: "🎮 Todos", value: "all" },
            { label: "🚫 Nunca Jogados", value: "neverPlayed" },
            { label: "🕹️ Jogados", value: "played" },
            { label: "⏱️ Recentes (2 semanas)", value: "recent" },
            { label: "🔥 Mais Recentes (ordenados)", value: "mostRecent" },
        ],
        []
    );

    const valueToIndex = useMemo(() => {
        const map = {};
        filterOptions.forEach((opt, i) => (map[opt.value] = i));
        return map;
    }, [filterOptions]);

    const [filterIndex, setFilterIndex] = useState(() => valueToIndex[filter] ?? 0);
    useEffect(() => {
        const idx = valueToIndex[filter];
        if (typeof idx === "number") setFilterIndex(idx);
    }, [filter, valueToIndex]);

    const filteredGames = useMemo(() => {
        let result = games;
        if (filter === "played") result = result.filter(g => g.playtime_forever > 0);
        else if (filter === "neverPlayed") result = result.filter(g => g.playtime_forever === 0);
        else if (filter === "recent") result = result.filter(g => g.playtime_2weeks > 0);
        else if (filter === "mostRecent")
            result = [...result].sort((a, b) => {
                const a2 = a.playtime_2weeks || 0;
                const b2 = b.playtime_2weeks || 0;
                if (b2 !== a2) return b2 - a2;
                return (b.playtime_forever || 0) - (a.playtime_forever || 0);
            });
        return result;
    }, [games, filter]);

    // ---------- load jogos ----------

    useEffect(() => {
        if (!steamId) return;
        let cancelled = false;

        async function loadGames() {
            try {
                // 1️⃣ Carregar jogos do DB
                const cachedGames = await getAllGames(steamId);
                if (cachedGames.length > 0) {
                    console.log("[GameList] Carregados do DB:", cachedGames.length);
                    setGames(cachedGames);
                    setProgress({ current: cachedGames.length, total: cachedGames.length });
                    setLoading(false);
                }

                // 2️⃣ Buscar jogos fresh da Steam
                const fresh = await getOwnedGames(steamId);
                if (!fresh?.games) return;

                const total = fresh.games.length;
                setProgress({ current: cachedGames.length, total });

                // Mapa para reutilizar schema
                const cacheMap = new Map(cachedGames.map(g => [g.appid, g]));

                let enrichedGames = [...cachedGames];

                for (let i = 0; i < fresh.games.length; i++) {
                    if (cancelled) break;

                    const baseGame = fresh.games[i];
                    const cachedEntry = cacheMap.get(baseGame.appid);

                    let enriched;
                    if (cachedEntry && cachedEntry.schema) {
                        enriched = { ...baseGame, schema: cachedEntry.schema };
                    } else {
                        try {
                            const schema = await GetSchemaForGame(baseGame.appid, steamId);
                            enriched = { ...baseGame, schema };
                        } catch (err) {
                            console.error("[GameList] Erro schema", baseGame.appid, err);
                            enriched = { ...baseGame };
                        }
                    }

                    // Verifica se precisa atualizar
                    const idx = enrichedGames.findIndex(g => g.appid === baseGame.appid);
                    let updated = false;

                    if (idx >= 0) {
                        const prev = enrichedGames[idx];
                        if ((prev.playtime_forever || 0) !== (enriched.playtime_forever || 0)) {
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
                        if (i < total - 1) await sleep(500); // pausa apenas quando há atualização
                    }
                }

                setLoading(false);
                console.log("[GameList] Todos os jogos carregados.");
            } catch (err) {
                console.error("[GameList] loadGames failed", err);
                setLoading(false);
            }
        }

        loadGames();

        return () => {
            cancelled = true;
        };
    }, [steamId]);





    // ---------- swipe stuff ----------
    const [isSwiping, setIsSwiping] = useState(false);
    const panRef = useRef(null);
    const SWIPE_THRESHOLD = 80;

    const translateX = useRef(new Animated.Value(0)).current;
    const labelScale = useRef(new Animated.Value(1)).current;
    const labelOpacity = useRef(new Animated.Value(1)).current;

    const changeIndexBy = (delta) => {
        setFilterIndex(prevIndex => {
            const next = Math.max(0, Math.min(filterOptions.length - 1, prevIndex + delta));
            if (next !== prevIndex) {
                setFilter(filterOptions[next].value);
                return next;
            }
            return prevIndex;
        });
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_evt, gs) => {
                const { dx, dy } = gs;
                return Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy);
            },
            onPanResponderGrant: () => {
                setIsSwiping(true);
                translateX.stopAnimation();
            },
            onPanResponderMove: (_evt, gs) => {
                translateX.setValue(gs.dx);
                const abs = Math.min(Math.abs(gs.dx), 200);
                const newOpacity = 1 - abs / 350;
                labelOpacity.setValue(newOpacity);
            },
            onPanResponderRelease: (_evt, gs) => {
                const { dx, vx } = gs;
                if (dx > SWIPE_THRESHOLD || (dx > 30 && vx > 0.8)) {
                    changeIndexBy(-1);
                } else if (dx < -SWIPE_THRESHOLD || (dx < -30 && vx < -0.8)) {
                    changeIndexBy(1);
                }
                Animated.timing(translateX, {
                    toValue: 0,
                    duration: 180,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }).start(() => {
                    Animated.timing(labelOpacity, { toValue: 1, duration: 120, useNativeDriver: true }).start();
                });
                setIsSwiping(false);
            },
            onPanResponderTerminate: () => {
                Animated.timing(translateX, { toValue: 0, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
                Animated.timing(labelOpacity, { toValue: 1, duration: 120, useNativeDriver: true }).start();
                setIsSwiping(false);
            },
            onPanResponderTerminationRequest: () => true,
        })
    ).current;

    useEffect(() => {
        Animated.sequence([
            Animated.timing(labelScale, { toValue: 1.06, duration: 120, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
            Animated.timing(labelScale, { toValue: 1.0, duration: 120, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        ]).start();
    }, [filterIndex, labelScale]);

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
    const placeholderClass = isDark ? "text-gray-400 text-base" : "text-gray-700 text-base";
    const selectedTextClass = isDark ? "text-green-400 text-base font-semibold" : "text-black text-base font-semibold";
    const itemTextClass = isDark ? "text-white text-sm" : "text-black text-sm";

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
            ref={panRef}
        >
            <StyledDropdown
                className={dropdownClass}
                containerClassName={dropdownContainerClass}
                containerStyle={containerStyleForced}
                style={mainStyleForced}
                placeholderClassName={placeholderClass}
                selectedTextClassName={selectedTextClass}
                itemTextClassName={itemTextClass}
                placeholderStyle={placeholderStyleObj}
                selectedTextStyle={selectedTextStyleObj}
                itemTextStyle={itemTextStyleObj}
                activeColor={isDark ? "rgba(74, 222, 128, 0.2)" : "#d1fae5"}
                data={filterOptions}
                labelField="label"
                valueField="value"
                value={filter}
                onChange={(item) => {
                    setFilter(item.value);
                    const idx = valueToIndex[item.value] ?? 0;
                    setFilterIndex(idx);
                }}
                placeholder="🎯 Selecione um filtro"
            />

            <FlatList
                data={filteredGames}
                keyExtractor={(item) => item.appid.toString()}
                renderItem={renderGameCard}
                initialNumToRender={10}
                windowSize={5}
                removeClippedSubviews={true}
                contentContainerStyle={{ paddingBottom: 12 }}
                scrollEnabled={!isSwiping}
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
