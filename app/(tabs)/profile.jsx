import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from "expo-router";
import { useContext, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Button, Text, View } from "react-native";
import { getPlayerSummary } from "../../src/api/steam";
import ProfileCard from "../../src/components/ProfileCard";
import { AuthContext } from "../../src/context/AuthContext";


/**
 * Tela principal de perfil — export default
 */
export default function Profile() {
    const router = useRouter();
    const { steamId } = useContext(AuthContext);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        // Se não houver steamId, redireciona para login — faz isso como efeito
        if (!steamId) {
            // se não quiser redirecionar imediatamente, remova esta linha
            router.replace("/(auth)/login");
            // também garante que não tentamos buscar o profile
            setProfile(null);
            setLoading(false);
            return () => { mounted = false; };
        }

        async function loadProfile() {
            setLoading(true);
            try {
                // chama somente com steamId válido
                const data = await getPlayerSummary(steamId);
                console.log("[HomeScreen] player summary:", data);
                if (!mounted) return;
                setProfile(data ?? null);
            } catch (err) {
                console.error("[HomeScreen] failed to load profile:", err);
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
            <View className="flex-1 items-center justify-center bg-gray-900">
                <ActivityIndicator size="large" color="#fff" />
            </View>
        );
    }

    const clearCache = async () => {
        try {
            await AsyncStorage.clear();
            Alert.alert('Success', 'All cached data has been cleared!');
        } catch (e) {
            Alert.alert('Error', 'Failed to clear cache.');
            console.error(e);
        }
    };

    return (
        <View className="flex-1 bg-gray-900 p-4">
            <Button title="Clear Cache" onPress={clearCache} color="#f87171" />
            {/* Profile: renderiza um placeholder caso profile seja null */}
            {profile ? (
                <ProfileCard data={profile} />
            ) : (
                <View className="bg-gray-800 rounded-xl overflow-hidden mb-4 p-6 items-center">
                    <Text className="text-gray-300">Perfil não disponível</Text>
                </View>
            )}
        </View>
    );
}
