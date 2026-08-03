import useAchievements from "@/src/hooks/useAchievements";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, FlatList, Image, Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "@/src/theme/colors";
import { useTheme } from "@/src/theme/styles";

export default function AchievementsTab({ game }) {
    const { mergedCheevos, loading } = useAchievements(game);

    const t = useTheme();

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    return (
        <View className={`flex-1 ${t.pageBg} py-4`}>
            {mergedCheevos.length === 0 ? (
                <View className="flex-1 justify-center items-center">
                    <Text className={`${t.textSecondary} text-center text-lg`}>
                        Este jogo não possui conquistas
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={mergedCheevos}
                    keyExtractor={(item) => item.apiname}
                    renderItem={({ item }) => (
                        <TouchableOpacity className={`flex-row items-center ${t.cardBg} p-4 rounded mb-3 justify-between`}>
                            {/* Left: icon + percent */}
                            <View className="flex-col items-center mr-4">
                                <Image
                                    source={{ uri: item.icon }}
                                    className="w-12 h-12 rounded mb-1"
                                    resizeMode="contain"
                                />
                                <Text className={`${t.textSecondary} text-sm`}>{item.globalPercent}%</Text>
                            </View>

                            {/* Middle: name + description */}
                            <View className="flex-1">
                                <Text className={`${t.textPrimary} font-bold text-base`}>{item.name}</Text>
                                <Text className={`${t.textSecondary} text-sm`} numberOfLines={2}>
                                    {item.description || "Descrição Oculta"}
                                </Text>
                            </View>

                            {/* Right: lock */}
                            <Ionicons
                                name={item.achieved ? "lock-open-outline" : "lock-closed-outline"}
                                size={32}
                                color={item.achieved ? COLORS.accent : COLORS.danger}
                            />
                        </TouchableOpacity>
                    )}
                />
            )}
        </View>
    );
}
