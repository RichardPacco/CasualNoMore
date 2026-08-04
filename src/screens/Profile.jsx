import { getPlayerSummary } from "@/src/api/steam";
import LanguageSelector from "@/src/components/LanguageSelector";
import ProfileCard from "@/src/components/ProfileCard";
import PullToRefresh from "@/src/components/PullToRefresh";
import { AuthContext } from "@/src/context/AuthContext";
import { getAllGames } from "@/src/database/db";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS } from "@/src/theme/colors";
import { useTheme } from "@/src/theme/styles";
import { useRouter } from "expo-router";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

function computeCompletionStats(cachedGames) {
    const played = cachedGames.filter(g => {
        const list = g.achievements || [];
        const unlocked = list.filter(a => a.achieved).length;
        return (g.playtime_forever || 0) > 0 || unlocked > 0;
    });

    const withAchievements = played.filter(g => (g.achievements || []).length > 0);
    const perfected = withAchievements.filter(g => (g.achievements || []).every(a => a.achieved)).length;
    const avgCompletion = withAchievements.length > 0
        ? withAchievements.reduce((sum, g) => {
            const list = g.achievements || [];
            const unlocked = list.filter(a => a.achieved).length;
            return sum + (unlocked / list.length) * 100;
        }, 0) / withAchievements.length
        : 0;

    return { perfected, avgCompletion };
}

export default function Profile() {
    const router = useRouter();
    const { steamId } = useContext(AuthContext);
    const { t: tr } = useLanguage();
    const t = useTheme();
    const isDark = t.isDark;

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshingProfile, setRefreshingProfile] = useState(false);
    const [completionStats, setCompletionStats] = useState({ perfected: 0, avgCompletion: 0 });
    const cancelledRef = useRef(false);

    useEffect(() => {
        cancelledRef.current = !steamId;
    }, [steamId]);

    const loadProfile = useCallback(async () => {
        if (!steamId) return;
        setLoading(true);
        try {
            const [Profile, cachedGames] = await Promise.all([
                getPlayerSummary(steamId),
                getAllGames(steamId),
            ]);
            if (!cancelledRef.current) {
                setProfile(Profile ?? null);
                setCompletionStats(computeCompletionStats(cachedGames));
            }
        } catch (err) {
            console.error("[Profile] Failed to load:", err);
            if (!cancelledRef.current) setProfile(null);
        } finally {
            if (!cancelledRef.current) setLoading(false);
        }
    }, [steamId]);

    const refreshProfile = useCallback(async () => {
        if (!steamId) return;
        setRefreshingProfile(true);
        try {
            const [Profile, cachedGames] = await Promise.all([
                getPlayerSummary(steamId),
                getAllGames(steamId),
            ]);
            if (Profile) setProfile(Profile);
            setCompletionStats(computeCompletionStats(cachedGames));
        } catch (err) {
            console.error("[Profile] Failed to refresh profile:", err);
        } finally {
            setRefreshingProfile(false);
        }
    }, [steamId]);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    useEffect(() => {
        if (!steamId) {
            router.replace("/(auth)/login");
        }
    }, [steamId, router]);

    if (loading) {
        return (
            <View className={`flex-1 items-center justify-center ${t.pageBg}`}>
                <ActivityIndicator size="large" color={isDark ? COLORS.accent : "#000"} />
            </View>
        );
    }

    const placeholderBg = t.cardBg;
    const placeholderText = t.textSecondary;
    const buttonBg = isDark ? "bg-blue-600" : "bg-blue-500";
    const buttonText = "text-white";
    const textSecondary = t.textSecondary;

    return (
        <View className={`flex-1 ${t.pageBg}`}>
            <PullToRefresh refreshing={refreshingProfile} onRefresh={refreshProfile}>
            <ScrollView className={`flex-1 p-4 ${t.pageBg}`} contentContainerStyle={{ paddingBottom: 70 }}>
                {profile ? (
                    <>
                        <ProfileCard data={profile} />

                    {/* Completion stats */}
                    <View className="flex-row gap-3 mb-4">
                        <View className={`flex-1 ${t.cardBg} rounded-xl p-4 items-center`}>
                            <View className="w-10 h-10 rounded-full bg-warning/15 items-center justify-center mb-2">
                                <Ionicons name="trophy" size={18} color={COLORS.warning} />
                            </View>
                            <Text className={`${t.textHeader} text-2xl font-bold`}>
                                {completionStats.perfected}
                            </Text>
                            <Text className={`${textSecondary} text-xs text-center mt-1`}>
                                {tr("profilePerfectedGames")}
                            </Text>
                        </View>

                        <View className={`flex-1 ${t.cardBg} rounded-xl p-4 items-center`}>
                            <View className="w-10 h-10 rounded-full bg-accent/15 items-center justify-center mb-2">
                                <Ionicons name="stats-chart-outline" size={18} color={COLORS.accent} />
                            </View>
                            <Text className={`${t.textHeader} text-2xl font-bold`}>
                                {completionStats.avgCompletion.toFixed(1)}%
                            </Text>
                            <Text className={`${textSecondary} text-xs text-center mt-1`}>
                                {tr("profileAvgCompletion")}
                            </Text>
                        </View>
                    </View>

                    {/* Language selector */}
                    <View className={`${t.cardBg} p-3 rounded-xl flex-row items-center justify-between`}>
                        <Text className={`${t.textHeader} text-sm font-bold`}>
                            {tr("languageLabel")}
                        </Text>
                        <LanguageSelector />
                    </View>
                </>
            ) : (
                <View
                    className={`${placeholderBg} rounded-xl overflow-hidden p-6 items-center`}
                >
                    <Text className={`text-lg font-semibold mb-2 ${placeholderText}`}>
                        {tr("profileUnavailable")}
                    </Text>
                    <Text className={`mb-4 ${placeholderText}`}>
                        {tr("profileLoadError")}
                    </Text>
                    <Pressable
                        className={`${buttonBg} px-6 py-2 rounded-lg`}
                        onPress={loadProfile}
                    >
                        <Text className={`text-center font-bold ${buttonText}`}>
                            {tr("profileRetry")}
                        </Text>
                    </Pressable>
                </View>
            )}
            </ScrollView>
            </PullToRefresh>
        </View>
    );
}
