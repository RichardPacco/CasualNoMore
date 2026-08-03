import { Ionicons } from "@expo/vector-icons";
import { getPlayerSummary, resolveVanityURL } from "@/src/api/steam";
import LanguageSelector from "@/src/components/LanguageSelector";
import { AuthContext } from "@/src/context/AuthContext";
import { clearDB } from "@/src/database/db";
import { useLanguage } from "@/src/i18n/LanguageContext";
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
    const { t } = useLanguage();

    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [confirmVisible, setConfirmVisible] = useState(false);

    const handleClearCache = async () => {
        try {
            await AsyncStorage.clear();
            showToast(t("loginCacheCleared"));
        } catch (e) {
            Alert.alert(t("loginError"), t("loginClearCacheFailed"));
            console.error(e);
        }
    };

    const confirmClearDB = async () => {
        setConfirmVisible(false);
        try {
            await clearDB();
            showToast(t("loginDbCleared"), t("loginDbClearedDesc"));
        } catch (err) {
            console.error(err);
            Alert.alert(t("loginError"), t("loginDbClearFailed"));
        }
    };


    async function validateSteamProfile(steamid) {
        try {
            const playerSummary = await getPlayerSummary(steamid);

            if (!playerSummary) {
                showToast(
                    t("loginInvalidProfile"),
                    "error"
                );
                return false;
            }

            // Steam public profile state is 3
            if (Number(playerSummary.communityvisibilitystate) !== 3) {
                showToast(t("loginPrivateProfile"), "warning");
                return false;
            }

            return true;

        } catch (e) {
            console.error("[Profile] erro:", e);
            showToast(
                t("loginFetchFailed"),
                "error"
            );
            return false;
        }
    }


    const handleSubmit = async () => {
        if (!input.trim()) {
            showToast(t("loginEmptyInput"), "warning");
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
                showToast(t("loginVanityFailed"), "error");
                return;
            }

            const isValid = await validateSteamProfile(res.steamid); // ✅ await here
            if (!isValid) return;

            // se for público, segue normalmente
            await setSteamId(res.steamid);
            router.replace("/(tabs)/GameStack");

        } catch (e) {
            console.error("[Login] erro:", e);
            showToast(t("loginConnectionError", { err: e }), "warning");
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
                            <Text className="text-danger text-xs font-medium">{t("loginCacheLabel")}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setConfirmVisible(true)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            className="flex-row items-center gap-1"
                        >
                            <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
                            <Text className="text-danger text-xs font-medium">{t("loginDbLabel")}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Language selector */}
                    <View className="mt-4 items-center flex-row justify-center gap-3">
                        <Text className="text-gray-300 text-sm font-semibold">{t("languageLabel")}</Text>
                        <LanguageSelector overlay />
                    </View>

                    {/* Bottom section */}
                    <View className="flex-1 justify-end">
                        {/* Tip box */}
                        <View className="bg-[#1e1e1e]/90 p-2.5 rounded-md mb-4 border-l-4 border-accent">
                            <Text className="text-[#aaa] text-xs">
                                {t("loginPublicTip")}
                            </Text>
                        </View>

                        {/* Input + submit arrow */}
                        <View className="mb-3">
                            <TextInput
                                label={t("loginSteamIdLabel")}
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
                                {t("loginClearDbTitle")}
                            </Text>
                        </View>

                        <Text className="text-gray-400 text-sm text-center mb-6">
                            {t("loginClearDbMessage")}
                        </Text>

                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                onPress={() => setConfirmVisible(false)}
                                className="flex-1 py-3 rounded-lg bg-gray-700 items-center"
                            >
                                <Text className="text-white font-semibold">{t("loginCancel")}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={confirmClearDB}
                                className="flex-1 py-3 rounded-lg bg-danger items-center"
                            >
                                <Text className="text-white font-semibold">{t("loginClear")}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );



}
