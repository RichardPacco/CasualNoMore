import { Ionicons } from "@expo/vector-icons";
import { getPlayerSummary, resolveVanityURL } from "@/src/api/steam";
import { AuthContext } from "@/src/context/AuthContext";
import { clearDB } from "@/src/database/db";
import { showToast } from "@/src/utils/toast";
import { COLORS } from "@/src/theme/colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useContext, useState } from "react";
import { ActivityIndicator, Alert, ImageBackground, Modal, SafeAreaView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { TextInput } from "react-native-paper";

const loginBackground = require("../../assets/images/login_background.png");


export default function Login() {
    const { setSteamId } = useContext(AuthContext);
    const router = useRouter();

    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [confirmVisible, setConfirmVisible] = useState(false);

    const handleClearCache = async () => {
        try {
            await AsyncStorage.clear();
            showToast('All cached data has been cleared!');
        } catch (e) {
            Alert.alert('Error', 'Failed to clear cache.');
            console.error(e);
        }
    };

    const confirmClearDB = async () => {
        setConfirmVisible(false);
        try {
            await clearDB();
            showToast("Banco limpo!", "O banco de dados foi zerado.");
        } catch (err) {
            console.error(err);
            Alert.alert("Erro", "Falha ao limpar o banco de dados.");
        }
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
                <View className="flex-1 bg-black/60 p-5">
                    {/* Top corners: ações minimais */}
                    <View className="flex-row justify-between">
                        <TouchableOpacity
                            onPress={handleClearCache}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            className="flex-row items-center gap-1"
                        >
                            <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
                            <Text className="text-danger text-xs font-medium">Cache</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setConfirmVisible(true)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            className="flex-row items-center gap-1"
                        >
                            <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
                            <Text className="text-danger text-xs font-medium">DB</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Bottom section */}
                    <View className="flex-1 justify-end">
                        {/* Tip box */}
                        <View className="bg-[#1e1e1e]/90 p-2.5 rounded-md mb-4 border-l-4 border-accent">
                            <Text className="text-[#aaa] text-xs">
                                O perfil Steam deve estar público para o aplicativo funcionar
                            </Text>
                        </View>

                        {/* Input + submit arrow */}
                        <View className="mb-3">
                            <TextInput
                                label="Steam URL ou SteamID"
                                value={input}
                                onChangeText={setInput}
                                mode="outlined"
                                style={{ backgroundColor: "#222" }}
                                theme={{
                                    colors: {
                                        primary: COLORS.accent,  // label / focus color
                                    },
                                }}
                                textColor="#fff"
                                onSubmitEditing={handleSubmit}
                                right={
                                    <TextInput.Icon
                                        icon={() =>
                                            loading ? (
                                                <ActivityIndicator size="small" color={COLORS.accent} />
                                            ) : (
                                                <Ionicons name="arrow-forward" size={22} color={COLORS.accent} />
                                            )
                                        }
                                        onPress={handleSubmit}
                                        disabled={loading}
                                    />
                                }
                            />
                        </View>
                    </View>
                </View>
            </ImageBackground>

            {/* Confirmar limpeza do banco */}
            <Modal
                transparent
                animationType="fade"
                visible={confirmVisible}
                onRequestClose={() => setConfirmVisible(false)}
            >
                <View className="flex-1 bg-black/70 items-center justify-center p-6">
                    <View className="w-full bg-[#1f2937] rounded-2xl p-6 border border-gray-700">
                        <View className="items-center mb-4">
                            <View className="w-14 h-14 rounded-full bg-danger/15 items-center justify-center mb-3">
                                <Ionicons name="trash-outline" size={28} color={COLORS.danger} />
                            </View>
                            <Text className="text-white text-lg font-bold text-center">
                                Limpar Banco de Dados?
                            </Text>
                        </View>

                        <Text className="text-gray-400 text-sm text-center mb-6">
                            Isso vai apagar todos os jogos salvos e progresso local. Essa ação não pode ser desfeita.
                        </Text>

                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                onPress={() => setConfirmVisible(false)}
                                className="flex-1 py-3 rounded-lg bg-gray-700 items-center"
                            >
                                <Text className="text-white font-semibold">Cancelar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={confirmClearDB}
                                className="flex-1 py-3 rounded-lg bg-danger items-center"
                            >
                                <Text className="text-white font-semibold">Limpar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );



}
