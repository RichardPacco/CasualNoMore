import useAchievements from "@/src/hooks/useAchievements";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, FlatList, Image, Text, TouchableOpacity, View } from "react-native";

export default function AchievementsTab({ game }) {
    const { mergedCheevos, loading } = useAchievements(game);

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#4ade80" />
            </View>
        );
    }

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
