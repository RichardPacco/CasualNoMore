import useAchievements from "@/src/hooks/useAchievements";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS } from "@/src/theme/colors";
import { useTheme } from "@/src/theme/styles";
import { Ionicons } from "@expo/vector-icons";
import { memo, useRef } from "react";
import { ActivityIndicator, Animated, FlatList, Image, Linking, Text, TouchableOpacity, View } from "react-native";

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

function AchievementCardComponent({ item, game }) {
    const t = useTheme();
    const { t: tr } = useLanguage();
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const rare = item.globalPercent < 10;

    const searchGoogle = () => {
        const query = `${game.name} ${item.name} Guide`;
        Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(query)}`)
            .catch(err => console.error("Failed to open Google:", err));
    };

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.96,
            speed: 40,
            bounciness: 0,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            speed: 40,
            bounciness: 0,
            useNativeDriver: true,
        }).start();
    };

    const handleLongPress = () => {
        Animated.sequence([
            Animated.timing(scaleAnim, { toValue: 0.92, duration: 120, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]).start(() => searchGoogle());
    };

    return (
        <AnimatedTouchableOpacity
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onLongPress={handleLongPress}
            style={{ transform: [{ scale: scaleAnim }] }}
            className={`flex-row items-center ${t.cardBg} p-4 rounded mb-3 justify-between`}
        >
            {/* Left: icon + percent */}
            <View className="flex-col items-center mr-4">
                <View
                    style={rare ? {
                        padding: 2,
                        borderRadius: 10,
                        backgroundColor: "rgba(255,179,0,0.18)",
                        borderWidth: 1.5,
                        borderColor: COLORS.warning,
                        shadowColor: "#FFB300",
                        shadowOpacity: 0.7,
                        shadowRadius: 10,
                        shadowOffset: { width: 0, height: 0 },
                        elevation: 10,
                    } : null}
                >
                    <Image
                        source={{ uri: item.icon }}
                        className="w-12 h-12 rounded"
                        resizeMode="contain"
                    />
                </View>
                <Text className={`text-sm ${rare ? "text-warning" : t.textSecondary}`}>
                    {item.globalPercent}%
                </Text>
            </View>

            {/* Middle: name + description */}
            <View className="flex-1">
                <Text className={`${t.textPrimary} font-bold text-base`}>{item.name}</Text>
                <Text className={`${t.textSecondary} text-sm`} numberOfLines={2}>
                    {item.description || tr("hiddenDescription")}
                </Text>
            </View>

            {/* Right: lock */}
            <Ionicons
                name={item.achieved ? "lock-open-outline" : "lock-closed-outline"}
                size={32}
                color={item.achieved ? COLORS.accent : COLORS.danger}
            />
        </AnimatedTouchableOpacity>
    );
}

const AchievementCard = memo(AchievementCardComponent);

export default function AchievementsTab({ game }) {
    const { mergedCheevos, loading } = useAchievements(game);

    const t = useTheme();
    const { t: tr } = useLanguage();

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
                        {tr("noAchievements")}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={mergedCheevos}
                    keyExtractor={(item) => item.apiname}
                    contentContainerStyle={{ paddingBottom: 70 }}
                    renderItem={({ item }) => <AchievementCard item={item} game={game} />}
                />
            )}
        </View>
    );
}
