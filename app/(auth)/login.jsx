import { getPlayerSummary, resolveVanityURL } from "@/src/api/steam";
import { AuthContext } from "@/src/context/AuthContext";
import { clearDB } from "@/src/database/db";
import { showToast } from "@/src/utils/toast";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useContext, useState } from "react";
import { Alert, ImageBackground, SafeAreaView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { TextInput } from "react-native-paper";

const loginBackground = require("../../assets/images/login_background.png");


export default function Login() {
    const { setSteamId } = useContext(AuthContext);
    const router = useRouter();

    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);

    const handleClearCache = async () => {
        try {
            await AsyncStorage.clear();
            showToast('All cached data has been cleared!');
        } catch (e) {
            Alert.alert('Error', 'Failed to clear cache.');
            console.error(e);
        }
    };

    const handleClearDB = async () => {
        Alert.alert(
            "Confirmação",
            "Tem certeza que quer limpar todo o banco de dados?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Sim",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await clearDB();
                            showToast("Banco limpo!", "O banco de dados foi zerado.");
                        } catch (err) {
                            console.error(err);
                            Alert.alert("Erro", "Falha ao limpar o banco de dados.");
                        }
                    },
                },
            ]
        );
    };


    async function validateSteamProfile(steamid) {
        try {
            const playerSummary = await getPlayerSummary(steamid);

            if (!playerSummary) {
                showToast(
                    "Perfil Steam incorreto — confira o número ou a conexão com a internet.",
                    "error"
                );
                return false;
            }

            // Steam public profile state is 3
            if (Number(playerSummary.communityvisibilitystate) !== 3) {
                showToast("Seu perfil Steam é privado. Torne-o público para continuar.", "warning");
                return false;
            }

            return true;

        } catch (e) {
            console.error("[Profile] erro:", e);
            showToast(
                "Falha ao buscar perfil. Veja o console.",
                "error"
            );
            return false;
        }
    }


    const handleSubmit = async () => {
        if (!input.trim()) {
            showToast("Informe seu SteamID64 ou vanity URL.", "warning");
            return;
        }

        setLoading(true);
        console.log("[Login] submit:", input);

        const numeric = input.replace(/\s+/g, "");
        const isSteam64 = /^\d{16,20}$/.test(numeric);

        try {
            if (isSteam64) {
                const isValid = await validateSteamProfile(numeric); // ✅ await here
                if (!isValid) return;

                console.log("[Login] detectado SteamID64, salvando direto:", numeric);
                await setSteamId(numeric);
                router.replace("/(tabs)/GameStack");
                return;
            }

            // tenta resolver vanity -> steamid
            console.log("[Login] tentando resolver vanity:", input);
            const res = await resolveVanityURL(input);
            console.log("[Login] resolveVanityURL:", res);

            if (res?.success !== 1 || !res?.steamid) {
                showToast("Não foi possível resolver o vanity URL. Use o SteamID64 (número) se possível.", "error");
                return;
            }

            const isValid = await validateSteamProfile(res.steamid); // ✅ await here
            if (!isValid) return;

            // se for público, segue normalmente
            await setSteamId(res.steamid);
            router.replace("/(tabs)/GameStack");

        } catch (e) {
            console.error("[Login] erro:", e);
            showToast(`Verifique conexão com a internet ou reinicie o app. ${e}`, "warning");
        } finally {
            setLoading(false);
        }
    };



    return (
        <SafeAreaView className="flex-1">
            <StatusBar barStyle="light-content" backgroundColor="transparent" />

            <ImageBackground source={loginBackground} className="flex-1" resizeMode="cover">
                {/* Overlay escura para garantir legibilidade */}
                <View className="flex-1 bg-black/60 p-5 justify-between">
                    {/* Top section */}
                    <View>
                        <Text className="text-[#4ade80] text-2xl font-bold text-center mb-3 shadow-[2px_2px_4px_#b4a6a6ff]">
                            CasualNoMore
                        </Text>
                    </View>

                    {/* Bottom section */}
                    <View>
                        {/* Buttons */}
                        <View className="flex-row justify-between mb-4">
                            <TouchableOpacity
                                onPress={handleClearCache}
                                className="px-3 py-2 rounded-md border border-[#F87171] items-center bg-transparent"
                            >
                                <Text className="text-[#F87171] font-medium">Limpar Cache</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleClearDB}
                                className="px-3 py-2 rounded-md border border-[#F87171] items-center bg-transparent"
                            >
                                <Text className="text-[#F87171] font-medium">Limpar DB</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Tip box */}
                        <View className="bg-[#1e1e1e]/90 p-2.5 rounded-md mb-4 border-l-4 border-[#4ade80]">
                            <Text className="text-[#aaa] text-xs">
                                O perfil Steam deve estar público para o aplicativo funcionar
                            </Text>
                        </View>

                        {/* Input */}
                        <View className="mb-3">
                            <TextInput
                                label="Steam URL ou SteamID"
                                value={input}
                                onChangeText={setInput}
                                mode="outlined"
                                style={{ backgroundColor: "#222" }}
                                theme={{
                                    colors: {
                                        primary: "#4ade80",  // label / focus color
                                    },
                                }}
                                textColor="#fff"
                            />
                        </View>

                        {/* Continuar button */}
                        <TouchableOpacity
                            onPress={handleSubmit}
                            disabled={loading}
                            className="bg-[#4ade80] py-3 rounded-md items-center"
                        >
                            <Text className="text-white">{loading ? "Carregando..." : "Continuar"}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ImageBackground>
        </SafeAreaView>
    );



}
