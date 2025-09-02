import { useRouter } from "expo-router";
import { useContext, useEffect, useState } from "react";
import { ActivityIndicator, Text, View, useColorScheme } from "react-native";
import { getPlayerSummary } from "../../src/api/steam";
import ProfileCard from "../../src/components/ProfileCard";
import { AuthContext } from "../../src/context/AuthContext";


export default function Profile() {
    const router = useRouter();
    const { steamId } = useContext(AuthContext);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

    const pageBg = isDark ? "bg-gray-900" : "bg-[#f3f4f6]";
    const placeholderBg = isDark ? "bg-gray-800" : "bg-white";
    const placeholderText = isDark ? "text-gray-300" : "text-gray-700";

    useEffect(() => {
        let mounted = true;

        if (!steamId) {
            router.replace("/(auth)/login");
            setProfile(null);
            setLoading(false);
            return () => { mounted = false; };
        }

        async function loadProfile() {
            setLoading(true);
            try {
                const data = await getPlayerSummary(steamId);
                console.log("[Profile] player summary:", data);
                if (!mounted) return;
                setProfile(data ?? null);
            } catch (err) {
                console.error("[Profile] failed to load profile:", err);
                if (mounted) setProfile(null);
            } finally {
                if (mounted) setLoading(false);
            }
        }

        loadProfile();

        return () => {
            mounted = false;
        };
    }, [steamId, router]);

    if (loading) {
        return (
            <View className={`flex-1 items-center justify-center ${pageBg}`}>
                <ActivityIndicator size="large" color={isDark ? "#fff" : "#000"} />
            </View>
        );
    }

    return (
        <View className={`flex-1 p-4 ${pageBg}`}>
            {profile ? (
                <ProfileCard data={profile} />
            ) : (
                <View className={`${placeholderBg} rounded-xl overflow-hidden mb-4 p-6 items-center`}>
                    <Text className={placeholderText}>Perfil não disponível</Text>
                </View>
            )}
        </View>
    );
}
