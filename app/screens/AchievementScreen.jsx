import { GetGlobalAchievementsPercentagesForApp, getPlayerAchievements, GetSchemaForGame } from "@/src/api/steam";
import { AuthContext } from "@/src/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { useContext, useEffect, useState } from "react";
import { FlatList, Image, Text, TouchableOpacity, View } from "react-native";

export default function AchievementScreen({ route }) {
    const { steamId } = useContext(AuthContext)
    const { game } = route.params || {};

    const [cheevos, setCheevos] = useState([]);
    const [schema, setSchema] = useState(null);
    const [globalPercentages, setGlobalPercentages] = useState([])
    const [mergedCheevos, setMergedCheevos] = useState([]);


    useEffect(() => {
        if (!game?.appid) return;

        async function fetchData() {
            const playerAchievements = await getPlayerAchievements(game.appid, steamId);
            setCheevos(playerAchievements.achievements);

            const schemaData = await GetSchemaForGame(game.appid, steamId);
            setSchema(schemaData);

            const globalPercentages = await GetGlobalAchievementsPercentagesForApp(game.appid);
            setGlobalPercentages(globalPercentages)
        }

        fetchData();
    }, [game?.appid, steamId]);

    async function GetMergedAchievements() {
        if (!schema || !cheevos) return [];

        const achievementsMap = {};
        cheevos.forEach((a) => {
            achievementsMap[a.apiname] = a.achieved === 1;
        });

        const percentMap = {};
        globalPercentages.forEach((p) => {
            percentMap[p.name.toLowerCase()] = p.percent;
        });

        const merged = schema.map((ach) => ({
            name: ach.displayName,
            description: ach.description,
            icon: achievementsMap[ach.name] ? ach.icon : ach.icongray,
            achieved: achievementsMap[ach.name] || false,
            globalPercent: percentMap[ach.name.toLowerCase()] || 0
        }));

        merged.sort((a, b) => b.globalPercent - a.globalPercent)
        // console.log("Merged achievements:", JSON.stringify(merged, null, 2));
        setMergedCheevos(merged)
        return merged;
    }

    useEffect(() => {
        GetMergedAchievements();
    }, [schema, cheevos, globalPercentages]);


    return (
        <View className="flex-1 bg-gray-900 p-4">
            <Text className="text-white text-xl font-bold mb-4">
                {game.name} - Achievements
            </Text>
            <FlatList
                data={mergedCheevos} // ✅ estado já resolvido
                keyExtractor={(item) => item.name}
                renderItem={({ item }) => (
                    <TouchableOpacity className="flex-row items-center bg-gray-800 p-3 rounded mb-2 justify-between">
                        {/* Left: ícone + percentual */}
                        <View className="flex-col items-center mr-3">
                            <Image
                                source={{ uri: item.icon }}
                                className="w-10 h-10 rounded mb-1"
                                resizeMode="contain"
                            />
                            <Text className="text-gray-400 text-xs">
                                {item.globalPercent}%
                            </Text>
                        </View>

                        {/* Middle: nome + descrição */}
                        <View className="flex-1">
                            <Text className="text-white font-bold">{item.name}</Text>
                            <Text className="text-gray-400 text-xs flex-shrink">
                                {item.description}
                            </Text>
                        </View>

                        {/* Right: cadeado */}
                        <Ionicons
                            name={item.achieved ? "lock-open-outline" : "lock-closed-outline"}
                            size={30}
                            color={item.achieved ? "#34D399" : "#F87171"}
                        />
                    </TouchableOpacity>

                )}
            />
        </View>
    );
}
