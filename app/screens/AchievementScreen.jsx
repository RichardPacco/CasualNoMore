import { getAchievements } from "@/src/api/steam";
import { View, Text, FlatList } from "react-native";
import { useState, useEffect } from "react";

export default function AchievementScreen({ route }) {
    const { game } = route.params || {};

    const [cheevos, setCheevos] = useState([]);

    useEffect(() => {
        if (!game?.appid) return;
        getAchievements(game.appid).then(data => {
            setCheevos(data);
        });
    }, []);

    return (
        <View className="flex-1 bg-gray-900 p-4">
            <Text className="text-white text-xl font-bold mb-4">
                {game.name} - Achievements
            </Text>
            <FlatList
                data={cheevos}
                keyExtractor={(item) => item.apiname}
                renderItem={({ item }) => (
                    <View className="bg-gray-800 p-3 rounded mb-2">
                        <Text className="text-white font-semibold">{item.name}</Text>
                        <Text className="text-gray-400 text-xs">{item.description}</Text>
                    </View>
                )}
            />
        </View>
    );
}
