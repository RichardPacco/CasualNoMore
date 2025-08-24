import AsyncStorage from "@react-native-async-storage/async-storage";
import { remapProps } from "nativewind";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, FlatList, PanResponder, Text, View, useColorScheme, } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { getOwnedGames } from "../../src/api/steam";
import GameCard from "../../src/components/GameCard";
import { AuthContext } from "../../src/context/AuthContext";

const StyledDropdown = remapProps(Dropdown, {
    className: "style",
    containerClassName: "containerStyle",
    placeholderClassName: "placeholderStyle",
    selectedTextClassName: "selectedTextStyle",
    itemTextClassName: "itemTextStyle",
});

export default function GameList({ navigation }) {
    const { steamId } = useContext(AuthContext);

    // ---------- hooks / estado (sempre no topo) ----------
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
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
        async function loadGames() {
            const cacheKey = `games_${steamId}`;
            try {
                const cached = await AsyncStorage.getItem(cacheKey);
                if (cached) {
                    setGames(JSON.parse(cached));
                    setLoading(false);
                }
                const fresh = await getOwnedGames(steamId);
                if (fresh?.games) {
                    const freshGames = fresh.games;
                    if (JSON.stringify(freshGames) !== cached) {
                        setGames(freshGames);
                        await AsyncStorage.setItem(cacheKey, JSON.stringify(freshGames));
                    }
                }
            } catch (err) {
                console.error("[GameList] erro carregando jogos:", err);
            } finally {
                setLoading(false);
            }
        }
        loadGames();
    }, [steamId]);

    // ---------- swipe (estado e gestos) ----------
    const [isSwiping, setIsSwiping] = useState(false);
    const panRef = useRef(null);
    const SWIPE_THRESHOLD = 80; // px sensibilidade

    // Animated values
    const translateX = useRef(new Animated.Value(0)).current; // acompanha o dx durante drag
    const labelScale = useRef(new Animated.Value(1)).current; // anima pulso quando troca
    const labelOpacity = useRef(new Animated.Value(1)).current; // leve fade

    // atualiza índice por delta (usa setter funcional para evitar stale closures)
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

    // PanResponder: atualiza translateX durante o movimento e chama changeIndexBy no release
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_evt, gs) => {
                const { dx, dy } = gs;
                return Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy);
            },
            onPanResponderGrant: () => {
                setIsSwiping(true);
                // parar quaisquer animações pendentes
                translateX.stopAnimation();
            },
            onPanResponderMove: (_evt, gs) => {
                // atualiza o Animated.Value diretamente com dx (não usa timing para acompanhar o dedo)
                translateX.setValue(gs.dx);
                // opcional: também mapear opacidade baseada no dx
                const abs = Math.min(Math.abs(gs.dx), 200);
                const newOpacity = 1 - abs / 350; // leve redução
                labelOpacity.setValue(newOpacity);
            },
            onPanResponderRelease: (_evt, gs) => {
                const { dx, vx } = gs;

                // decidir se é swipe válido
                if (dx > SWIPE_THRESHOLD || (dx > 30 && vx > 0.8)) {
                    // swipe para direita -> voltar
                    changeIndexBy(-1);
                    // feedback de troca: pulse
                    Animated.sequence([
                        Animated.timing(labelScale, { toValue: 1.08, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                        Animated.timing(labelScale, { toValue: 1.0, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                    ]).start();
                } else if (dx < -SWIPE_THRESHOLD || (dx < -30 && vx < -0.8)) {
                    // swipe para esquerda -> próximo
                    changeIndexBy(1);
                    Animated.sequence([
                        Animated.timing(labelScale, { toValue: 1.08, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                        Animated.timing(labelScale, { toValue: 1.0, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                    ]).start();
                }

                // animar o translateX de volta a zero suavemente
                Animated.timing(translateX, {
                    toValue: 0,
                    duration: 180,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }).start(() => {
                    // restaurar opacidade
                    Animated.timing(labelOpacity, { toValue: 1, duration: 120, useNativeDriver: true }).start();
                });

                setIsSwiping(false);
            },
            onPanResponderTerminate: () => {
                // cancelar
                Animated.timing(translateX, { toValue: 0, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
                Animated.timing(labelOpacity, { toValue: 1, duration: 120, useNativeDriver: true }).start();
                setIsSwiping(false);
            },
            onPanResponderTerminationRequest: () => true,
        })
    ).current;

    // quando o filtro muda (por dropdown ou swipe), fazemos um pequeno pulse (caso não tenha sido tocado via swipe)
    useEffect(() => {
        // dispara um pulse suave sempre que filterIndex mudar (já temos outro pulse no swipe, mas esse garante feedback ao selecionar no dropdown)
        Animated.sequence([
            Animated.timing(labelScale, { toValue: 1.06, duration: 120, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
            Animated.timing(labelScale, { toValue: 1.0, duration: 120, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        ]).start();
    }, [filterIndex, labelScale]);

    // ---------- UI / styles ----------
    if (loading && games.length === 0) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-900">
                <ActivityIndicator size="large" color="#4ade80" />
                <Text className="text-gray-400 mt-2">Carregando seus jogos...</Text>
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
            {/* Animated label: move com o dedo e faz pulse quando o filtro muda */}
            <Animated.View
                style={{
                    transform: [
                        {
                            translateX: translateX.interpolate({
                                // mover mais suavemente (clamp)
                                inputRange: [-300, -120, 0, 120, 300],
                                outputRange: [-50, -20, 0, 20, 50],
                                extrapolate: "clamp",
                            }),
                        },
                        { scale: labelScale },
                    ],
                    opacity: labelOpacity,
                }}
            >
                {/* <Text className={`mb-2 ${isDark ? "text-gray-400" : "text-gray-600"} text-sm`}>
                    {`Filtro: ${filterOptions[filterIndex].label}`}
                </Text> */}
            </Animated.View>

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
            />
        </View>
    );
}
