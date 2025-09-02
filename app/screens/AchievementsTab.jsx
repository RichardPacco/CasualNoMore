import { GetGlobalAchievementsPercentagesForApp, getPlayerAchievements } from "@/src/api/steam";
import { AuthContext } from "@/src/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { useContext, useEffect, useState } from "react";
import { FlatList, Image, Text, TouchableOpacity, View } from "react-native";

export default function AchievementsTab({ game }) {
    const { steamId } = useContext(AuthContext)

    const [cheevos, setCheevos] = useState([]);
    const [schema, setSchema] = useState(null);
    const [globalPercentages, setGlobalPercentages] = useState([])
    const [mergedCheevos, setMergedCheevos] = useState([]);


    useEffect(() => {
        if (!game?.appid) return;
        // console.log('GAME', game)
        async function fetchAll() {
            try {
                const schemaData = game.schema || [];
                // Try fetching player achievements, fallback to empty array
                let playerAchievements = { achievements: [] };
                try {
                    playerAchievements = await getPlayerAchievements(game.appid, steamId);
                    // console.log('PLAYERACHIEVEMENTS', playerAchievements.achievements);
                } catch (err) {
                    console.warn(`No player achievements for ${game.name}`, err);
                }

                // Try fetching global percentages, fallback to empty
                let globalPerc = [];
                try {
                    globalPerc = await GetGlobalAchievementsPercentagesForApp(game.appid);
                } catch (err) {
                    console.warn(`No global percentages for ${game.name}`, err);
                }

                const achievementsList = playerAchievements?.achievements || [];
                setCheevos(achievementsList);
                setSchema(schemaData);
                setGlobalPercentages(globalPerc || []);

                // Merge achievements only if schema exists
                if (schemaData.length > 0) {
                    const achievementsMap = {};
                    achievementsList.forEach(a => {
                        achievementsMap[a.apiname] = a.achieved === 1;
                    });
                    const percentMap = {};
                    (globalPerc || []).forEach(p => {
                        percentMap[p.name] = p.percent;
                    });

                    const merged = schemaData.map(ach => ({
                        name: ach.displayName,
                        apiname: ach.apiname,
                        description: ach.description,
                        icon: achievementsMap[ach.apiname] ? ach.icon : ach.icongray,
                        achieved: achievementsMap[ach.apiname] || false,
                        globalPercent: percentMap[ach.name] || 0
                    }));

                    merged.sort((a, b) => b.globalPercent - a.globalPercent);
                    setMergedCheevos(merged);
                } else {
                    setMergedCheevos([]);
                }

            } catch (err) {
                console.error("Error fetching achievements for", game.name, err);
            }
        }

        fetchAll();
    }, [game?.appid, steamId]);


    return (
        <View className="flex-1 bg-gray-900 py-4">
            {mergedCheevos.length === 0 ? (
                <View className="flex-1 justify-center items-center">
                    <Text className="text-gray-400 text-center text-lg">
                        Este jogo não possui conquistas
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={mergedCheevos}
                    keyExtractor={(item) => item.apiname}
                    renderItem={({ item }) => (
                        <TouchableOpacity className="flex-row items-center bg-gray-800 p-4 rounded mb-3 justify-between">
                            {/* Left: icon + percent */}
                            <View className="flex-col items-center mr-4">
                                <Image
                                    source={{ uri: item.icon }}
                                    className="w-12 h-12 rounded mb-1"
                                    resizeMode="contain"
                                />
                                <Text className="text-gray-400 text-sm">{item.globalPercent}%</Text>
                            </View>

                            {/* Middle: name + description */}
                            <View className="flex-1">
                                <Text className="text-white font-bold text-base">{item.name}</Text>
                                <Text className="text-gray-400 text-sm" numberOfLines={2}>
                                    {item.description || "Descrição Oculta"}
                                </Text>
                            </View>

                            {/* Right: lock */}
                            <Ionicons
                                name={item.achieved ? "lock-open-outline" : "lock-closed-outline"}
                                size={32}
                                color={item.achieved ? "#34D399" : "#F87171"}
                            />
                        </TouchableOpacity>

                    )}
                />
            )}
        </View>
    );


}
