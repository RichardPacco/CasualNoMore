import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";
import { getOwnedGames } from "../../src/api/steam";
import GameCard from "../../src/components/GameCard";
import { AuthContext } from "../../src/context/AuthContext";

export default function GameList({ navigation }) {
    const { steamId } = useContext(AuthContext);
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");

    const renderGameCard = useCallback(
        ({ item }) => <GameCard game={item} navigation={navigation} />,
        [navigation] // only re-create if navigation changes
    );

    useEffect(() => {
        if (!steamId) return; // ✅ exit early if no steamId

        async function loadGames() {
            const cacheKey = `games_${steamId}`;

            try {
                // load from cache
                const cached = await AsyncStorage.getItem(cacheKey);
                if (cached) {
                    setGames(JSON.parse(cached));
                    setLoading(false);
                }

                // fetch fresh data
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

    const filteredGames = useMemo(() => {
        let result = games;

        if (filter === "played") {
            result = result.filter(game => game.playtime_forever > 0);
        } else if (filter === "neverPlayed") {
            result = result.filter(game => game.playtime_forever === 0);
        } else if (filter === "mostRecent") {
            result = [...result].sort((a, b) => {
                const playA = a.playtime_2weeks || 0;
                const playB = b.playtime_2weeks || 0;

                if (playB !== playA) {
                    // primeiro ordena pelo tempo jogado nas últimas 2 semanas (desc)
                    return playB - playA;
                }
                // se forem iguais, ordena pelo total jogado (desc)
                const totalA = a.playtime_forever || 0;
                const totalB = b.playtime_forever || 0;
                return totalB - totalA;
            });
        }

        return result;
    }, [games, filter]);


    if (loading && games.length === 0) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-900">
                <ActivityIndicator size="large" color="#4ade80" />
                <Text className="text-gray-400 mt-2">Carregando seus jogos...</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-900 p-4">
            {/* filtros */}
            <View className="flex-row justify-around mb-4">
                <TouchableOpacity onPress={() => setFilter("all")}>
                    <Text className={filter === "all" ? "text-green-400 font-bold" : "text-gray-400"}>
                        Todos
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setFilter("neverPlayed")}>
                    <Text className={filter === "neverPlayed" ? "text-green-400 font-bold" : "text-gray-400"}>
                        Nunca Jogados
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setFilter("played")}>
                    <Text className={filter === "played" ? "text-green-400 font-bold" : "text-gray-400"}>
                        Jogados
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setFilter("mostRecent")}>
                    <Text className={filter === "recent" ? "text-green-400 font-bold" : "text-gray-400"}>
                        Recentes
                    </Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={filteredGames}
                keyExtractor={(item) => item.appid.toString()}
                renderItem={renderGameCard}
                initialNumToRender={10}
                windowSize={5}
                removeClippedSubviews={true}
            />
        </View>
    );
}
