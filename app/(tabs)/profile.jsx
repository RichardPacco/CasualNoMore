// app/(tabs)/perfil.js  (ou onde estiver seu arquivo)
import React, { useEffect, useState, useContext } from "react";
import { View, ScrollView, ActivityIndicator, TouchableOpacity, Text } from "react-native";
import { getPlayerSummary } from "../../src/api/steam";
import ProfileCard from "../../src/components/ProfileCard";
import { AuthContext } from "../../src/context/AuthContext";

/**
 * Componente de botão de logout (interno ao arquivo)
 */
function LogoutButton() {
    const { clearSteamId } = useContext(AuthContext);
    return (
        <TouchableOpacity
            onPress={clearSteamId}
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
export default function HomeScreen() {
    const { steamId } = useContext(AuthContext);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function loadProfile() {
            setLoading(true);
            try {
                // Chama getPlayerSummary passando steamId se disponível,
                // caso a função não precise de steamId ela deve ignorar o argumento.
                const data = steamId ? await getPlayerSummary(steamId) : await getPlayerSummary();
                console.log("[HomeScreen] player summary:", data);
                if (!mounted) return;
                setProfile(data);
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
    }, [steamId]);

    if (loading) {
        return <ActivityIndicator size="large" className="mt-10" color="#fff" />;
    }

    return (
        <ScrollView className="flex-1 bg-gray-900 p-4">
            {/* linha superior com steamId e botão Sair */}
            <View className="flex-row justify-between items-center mb-4">
                <View>
                    <Text className="text-gray-300 text-sm">Logged as</Text>
                    <Text className="text-white font-medium">{steamId || "—"}</Text>
                </View>

                <LogoutButton />
            </View>

            {/* Profile */}
            <ProfileCard data={profile} />
        </ScrollView>
    );
}
