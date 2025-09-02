import { useRouter } from "expo-router";
import { useCallback, useContext, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, useColorScheme, View } from "react-native";
import { getPlayerSummary } from "../../src/api/steam";
import ProfileCard from "../../src/components/ProfileCard";
import { AuthContext } from "../../src/context/AuthContext";

// Hook customizado para carregar o perfil
function useProfile(steamId) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadProfile = useCallback(async () => {
        if (!steamId) return;
        setLoading(true);
        try {
            const data = await getPlayerSummary(steamId);
            setProfile(data ?? null);
        } catch (err) {
            console.error("[useProfile] Failed to load profile:", err);
            setProfile(null);
        } finally {
            setLoading(false);
        }
    }, [steamId]);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    return { profile, loading, loadProfile };
}

export default function Profile() {
    const router = useRouter();
    const { steamId } = useContext(AuthContext);

    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

    const pageBg = isDark ? "bg-gray-900" : "bg-gray-100";
    const placeholderBg = isDark ? "bg-gray-800" : "bg-white";
    const placeholderText = isDark ? "text-gray-300" : "text-gray-700";
    const buttonBg = isDark ? "bg-blue-600" : "bg-blue-500";
    const buttonText = "text-white";

    // Redireciona se não estiver logado
    useEffect(() => {
        if (!steamId) {
            router.replace("/(auth)/login");
        }
    }, [steamId, router]);

    const { profile, loading, loadProfile } = useProfile(steamId);

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
                <View className={`${placeholderBg} rounded-xl overflow-hidden p-6 items-center`}>
                    <Text className={`text-lg font-semibold mb-2 ${placeholderText}`}>
                        Perfil não disponível
                    </Text>
                    <Text className={`mb-4 ${placeholderText}`}>
                        Ocorreu um erro ao carregar o perfil. Verifique sua conexão.
                    </Text>
                    <Pressable
                        className={`${buttonBg} px-6 py-2 rounded-lg`}
                        onPress={loadProfile}
                    >
                        <Text className={`text-center font-bold ${buttonText}`}>Tentar novamente</Text>
                    </Pressable>
                </View>
            )}
        </View>
    );
}
