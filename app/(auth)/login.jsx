// app/(auth)/login.js
import React, { useState, useContext } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { AuthContext } from "../../src/context/AuthContext";
import { resolveVanityURL } from "../../src/api/steam"; // opcional, mantenha ou remova

export default function Login() {
    const { setSteamId } = useContext(AuthContext);
    const router = useRouter();

    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!input.trim()) {
            Alert.alert("Erro", "Informe seu SteamID64 ou vanity URL.");
            return;
        }

        setLoading(true);
        console.log("[Login] submit:", input);

        const numeric = input.replace(/\s+/g, "");
        const isSteam64 = /^\d{16,20}$/.test(numeric);

        try {
            if (isSteam64) {
                console.log("[Login] detectado SteamID64, salvando direto:", numeric);
                await setSteamId(numeric);
                router.replace("/(tabs)/GameStack");
                return;
            }

            // tenta resolver vanity -> steamid (se você tiver essa função)
            console.log("[Login] tentando resolver vanity:", input);
            const res = await resolveVanityURL(input);
            console.log("[Login] resolveVanityURL:", res);
            if (res?.success === 1 && res?.steamid) {
                await setSteamId(res.steamid);
                router.replace("/(tabs)/GameStack");
            } else {
                Alert.alert("Erro", "Não foi possível resolver o vanity URL. Use o SteamID64 (número) se possível.");
            }
        } catch (e) {
            console.error("[Login] erro:", e);
            Alert.alert("Erro", "Falha ao processar. Veja o console.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: "#111", padding: 20, justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 22, marginBottom: 12 }}>Entrar com Steam</Text>

            <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="SteamID64 (ex: 7656119...) ou vanity"
                placeholderTextColor="#888"
                autoCapitalize="none"
                style={{ backgroundColor: "#222", color: "#fff", padding: 12, borderRadius: 8, marginBottom: 12 }}
            />

            <TouchableOpacity
                onPress={handleSubmit}
                disabled={loading}
                style={{ backgroundColor: "#7B6EF6", padding: 12, borderRadius: 8, alignItems: "center" }}
            >
                <Text style={{ color: "#fff" }}>{loading ? "Carregando..." : "Continuar"}</Text>
            </TouchableOpacity>
        </View>
    );
}
