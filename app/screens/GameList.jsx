import { remapProps } from "nativewind";
import PQueue from 'p-queue';
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, useColorScheme, View } from "react-native";
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

export default function GameList({ navigation }) {
    const { steamId } = useContext(AuthContext);

    // ---------- hooks / state ----------
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [filter, setFilter] = useState("all");
    const [refreshing, setRefreshing] = useState(false);
    const [sort, setSort] = useState("recentPlaytime");

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
            { label: "⏱️ Nas últimas 2 semanas", value: "recent" },
        ],
        []
    );

    const sortOptions = useMemo(() => [
        { label: "⏱️ Mais recentes", value: "recentPlaytime" },
        { label: "🔥 Tempo de Jogo", value: "totalPlaytime" },
        { label: "🔤 Nome", value: "name" },
    ], []);

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

        switch (filter) {
            case "played":
                result = result.filter(g => g.playtime_forever > 0);
                break;
            case "neverPlayed":
                result = result.filter(g => g.playtime_forever === 0);
                break;
            case "recent":
                result = result.filter(g => g.playtime_2weeks > 0);
                break;
            default:
                break;
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
            default:
                break;
        }

        return result;
    }, [games, filter, sort]);

    // ---------- load jogos ----------
    const loadGames = useCallback(async () => {
        setRefreshing(true);
        try {
            const cachedGames = await getAllGames(steamId);
            let enrichedGames = [...cachedGames];

            if (cachedGames.length > 0) {
                setGames(cachedGames);
                setProgress({ current: cachedGames.length, total: cachedGames.length });
                setLoading(false);
            }

            const fresh = await getOwnedGames(steamId);
            if (fresh?.games) {
                const total = fresh.games.length;
                setProgress({ current: cachedGames.length, total });

                const cacheMap = new Map(cachedGames.map(g => [g.appid, g]));

                for (let i = 0; i < fresh.games.length; i++) {
                    const baseGame = fresh.games[i];
                    const cachedEntry = cacheMap.get(baseGame.appid);

                    let enriched = cachedEntry
                        ? { ...baseGame, schema: cachedEntry.schema, schemaStatus: cachedEntry.schemaStatus }
                        : { ...baseGame, schema: null, schemaStatus: "pending" };

                    const idx = enrichedGames.findIndex(g => g.appid === baseGame.appid);
                    let updated = false;

                    if (idx >= 0) {
                        const prev = enrichedGames[idx];
                        if (
                            prev.playtime_forever !== enriched.playtime_forever ||
                            prev.schemaStatus !== enriched.schemaStatus
                        ) {
                            enrichedGames[idx] = enriched;
                            updated = true;
                        }
                    } else {
                        enrichedGames.push(enriched);
                        updated = true;
                    }

                    if (updated) {
                        await saveGame(steamId, enriched);
                        setGames([...enrichedGames]);
                        setProgress({ current: i + 1, total });
                    }
                }

                retrySchemas(steamId, enrichedGames, setGames);
            }
        } catch (err) {
            console.error("[GameList] loadGames failed", err);
        }
        setRefreshing(false);
    }, [steamId]);

    useEffect(() => {
        if (!steamId) return;
        loadGames();
    }, [steamId, loadGames]);

    async function retrySchemas(steamId, games, setGames) {
        const queue = new PQueue({ concurrency: 1, interval: 200, intervalCap: 1 });

        games
            .filter(g => g.schemaStatus === "pending")
            .forEach(g => {
                queue.add(async () => {
                    try {
                        const schema = await GetSchemaForGame(g.appid, steamId);
                        g.schema = schema;
                        g.schemaStatus = "done";
                        await saveGame(steamId, g);

                        setGames(prev =>
                            prev.map(pg => (pg.appid === g.appid ? { ...g } : pg))
                        );
                    } catch (err) {
                        console.warn("[GameList] retry schema failed", g.appid, err);
                    }
                });
            });

        await queue.onIdle();
    }

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
        <View className={`flex-1 p-4 ${isDark ? "bg-gray-900" : "bg-white"}`}>
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
                data={sortOptions}
                labelField="label"
                valueField="value"
                value={sort}
                onChange={(item) => setSort(item.value)}
                placeholder="🎯 Selecione uma ordenação"
            />

            <FlatList
                data={filteredGames}
                keyExtractor={(item) => item.appid.toString()}
                renderItem={renderGameCard}
                initialNumToRender={10}
                windowSize={5}
                removeClippedSubviews={true}
                contentContainerStyle={{ paddingBottom: 12 }}
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
