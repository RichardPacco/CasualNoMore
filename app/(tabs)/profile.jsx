import { useRouter } from "expo-router";
import { useContext, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { getPlayerSummary } from "../../src/api/steam";
import ProfileCard from "../../src/components/ProfileCard";
import { AuthContext } from "../../src/context/AuthContext";

/**
 * Componente de botão de logout (interno ao arquivo)
 */
function LogoutButton() {
    const { clearSteamId } = useContext(AuthContext);
    const router = useRouter();

    const handleLogout = async () => {
        try {
            // Limpa steamId do contexto/storage
            await clearSteamId?.();
        } catch (e) {
            console.warn("Erro ao limpar steamId:", e);
        } finally {
            // garante navegação para a tela de login (efeito pós-logout)
            router.replace("/(auth)/login");
        }
    };

    return (
        <TouchableOpacity
            onPress={handleLogout}
            className="p-2 bg-red-600 rounded"
            style={{ alignSelf: "flex-end" }}
        >
            <Text className="text-white">Sair</Text>
        </TouchableOpacity>
    );
}

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

    return (
        <ScrollView className="flex-1 bg-gray-900 p-4">
            {/* linha superior com steamId e botão Sair */}
            <View className="flex-row justify-between items-center mb-4">
                <View>
                    <Text className="text-gray-300 text-sm">Logged as</Text>
                    <Text className="text-white font-medium">{steamId ?? "—"}</Text>
                </View>

                <LogoutButton />
            </View>

            {/* Profile: renderiza um placeholder caso profile seja null */}
            {profile ? (
                <ProfileCard data={profile} />
            ) : (
                <View className="bg-gray-800 rounded-xl overflow-hidden mb-4 p-6 items-center">
                    <Text className="text-gray-300">Perfil não disponível</Text>
                </View>
            )}
        </ScrollView>
    );
}
