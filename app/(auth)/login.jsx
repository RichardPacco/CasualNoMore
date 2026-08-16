import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { getPlayerSummary, resolveVanityURL } from "@/src/api/steam";
import { loadApiKey, saveApiKeyStore } from "@/src/config/apiKeyStore";
import LanguageSelector from "@/src/components/LanguageSelector";
import ClearDbModal from "@/src/components/ClearDbModal";
import RemoveAccountModal from "@/src/components/RemoveAccountModal";
import AboutModal from "@/src/components/AboutModal";
import { AuthContext } from "@/src/context/AuthContext";
import { clearDB } from "@/src/database/db";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { showToast } from "@/src/utils/toast";
import { COLORS } from "@/src/theme/colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useContext, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, ImageBackground, SafeAreaView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { TextInput } from "react-native-paper";

const loginBackground = require("../../assets/images/login_background.png");


/**
 * Tela de login: entrada de SteamID/vanity e API key, com contas salvas para login rápido.
 */
export default function Login() {
    const { setSteamId, savedAccounts, addSavedAccount, removeSavedAccount } = useContext(AuthContext);
    const router = useRouter();
    const { t } = useLanguage();

    const [input, setInput] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [keyInput, setKeyInput] = useState("");
    const [showApiKey, setShowApiKey] = useState(false);
    const [loading, setLoading] = useState(false);
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [accountToRemove, setAccountToRemove] = useState(null);
    const [aboutVisible, setAboutVisible] = useState(false);

    /** Carrega a API key salva do armazenamento na montagem. */
    useEffect(() => {
        (async () => {
            const stored = await loadApiKey();
            if (stored) {
                setApiKey(stored);
                setKeyInput(stored);
            }
        })();
    }, []);

    /** Abre a página da Steam para obter uma API key (disparado pelo link "Obter API Key"). */
    const openApiKeyPage = () => {
        WebBrowser.openBrowserAsync("https://steamcommunity.com/dev/apikey");
    };

    /** Salva a API key quando o texto digitado corresponde a uma chave válida (32 hex). */
    const handleApiKeyChange = async (text) => {
        setKeyInput(text);
        const trimmed = text.trim();
        if (/^[0-9A-Fa-f]{32}$/.test(trimmed)) {
            await saveApiKeyStore(trimmed);
            setApiKey(trimmed);
            showToast(t("loginApiKeySaved"), "success");
        }
    };

    /** Remove a API key salva e limpa os campos. */
    const removeSavedApiKey = async () => {
        await saveApiKeyStore("");
        setApiKey("");
        setKeyInput("");
        showToast(t("loginApiKeyRemoved"), "info");
    };

    /** Limpa o cache (AsyncStorage), disparado pelo botão de limpar cache. */
    const handleClearCache = async () => {
        try {
            await AsyncStorage.clear();
            showToast(t("loginCacheCleared"));
        } catch (e) {
            Alert.alert(t("loginError"), t("loginClearCacheFailed"));
            console.error(e);
        }
    };

    /** Confirma e executa a limpeza total do banco local (disparado pelo modal de confirmação). */
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


    /**
     * Valida o perfil Steam: busca o resumo do jogador e exige perfil público.
     * Retorna o playerSummary se válido, senão null.
     */
    async function validateSteamProfile(steamid) {
        try {
            const playerSummary = await getPlayerSummary(steamid);

            if (!playerSummary) {
                showToast(
                    t("loginInvalidProfile"),
                    "error"
                );
                return null;
            }

            // Steam public profile state is 3
            if (Number(playerSummary.communityvisibilitystate) !== 3) {
                showToast(t("loginPrivateProfile"), "warning");
                return null;
            }

            return playerSummary;

        } catch (e) {
            console.error("[Profile] erro:", e);
            showToast(
                t("loginFetchFailed"),
                "error"
            );
            return null;
        }
    }


    /** Salva uma conta na lista de contas salvas. */
    const saveAccount = async (playerSummary, steamid) => {
        await addSavedAccount({
            steamId: steamid,
            name: playerSummary?.personaname || steamid,
            avatar: playerSummary?.avatarfull || null,
        });
    };

    /** Login rápido com uma conta salva (toque no avatar): define o steamId e vai para as tabs. */
    const handleQuickLogin = async (account) => {
        if (!apiKey) {
            showToast(t("loginApiKeyMissing"), "warning");
            return;
        }

        setLoading(true);
        await addSavedAccount(account);
        await setSteamId(account.steamId);
        router.replace("/(tabs)/GameStack");
    };

    /** Marca a conta para remoção (disparado pelo toque longo no avatar). */
    const confirmRemoveAccount = (account) => {
        setAccountToRemove(account);
    };

    /** Remove a conta salva selecionada (confirmado no modal de remoção). */
    const doRemoveAccount = async () => {
        if (!accountToRemove) return;
        const id = accountToRemove.steamId;
        setAccountToRemove(null);
        try {
            await removeSavedAccount(id);
        } catch (err) {
            console.error(err);
            Alert.alert(t("loginError"), t("loginDbClearFailed"));
        }
    };


    /**
     * Envia o SteamID64 ou vanity digitado: valida o perfil, salva a conta e navega para as tabs.
     * Disparado pelo botão de envio ou submit do teclado.
     */
    const handleSubmit = async () => {
        if (!apiKey) {
            showToast(t("loginApiKeyMissing"), "warning");
            return;
        }

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
                const playerSummary = await validateSteamProfile(numeric);
                if (!playerSummary) return;

                console.log("[Login] detectado SteamID64, salvando direto:", numeric);
                await saveAccount(playerSummary, numeric);
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

            const playerSummary = await validateSteamProfile(res.steamid);
            if (!playerSummary) return;

            // se for público, segue normalmente
            await saveAccount(playerSummary, res.steamid);
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
                        {/* Saved accounts */}
                        <View className="mb-4">
                            <Text className="text-gray-400 text-xs font-semibold mb-2 text-center">
                                {t("loginAccountsLabel")}
                            </Text>
                            <View className="flex-row justify-center gap-5">
                                {[0, 1, 2].map((i) => {
                                    const acc = savedAccounts[i];
                                    if (!acc) {
                                        return (
                                            <View key={i} className="items-center">
                                                <View className="w-14 h-14 rounded-full border-2 border-dashed border-gray-600 items-center justify-center">
                                                    <Ionicons name="add" size={22} color="#6b7280" />
                                                </View>
                                                <Text className="text-gray-600 text-xs mt-1">-</Text>
                                            </View>
                                        );
                                    }
                                    return (
                                        <TouchableOpacity
                                            key={acc.steamId}
                                            onPress={() => handleQuickLogin(acc)}
                                            onLongPress={() => confirmRemoveAccount(acc)}
                                            className="items-center"
                                        >
                                            <Image
                                                source={{ uri: acc.avatar }}
                                                className="w-14 h-14 rounded-full border-2 border-accent"
                                            />
                                            <Text className="text-white text-xs mt-1 max-w-[70px] text-center" numberOfLines={1}>
                                                {acc.name}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Tip box */}
                        <View className="bg-[#1e1e1e]/90 p-2.5 rounded-md mb-4 border-l-4 border-accent">
                            <Text className="text-[#aaa] text-xs">
                                {t("loginPublicTip")}
                            </Text>
                        </View>

                        {/* API Key */}
                        <View className="mb-3">
                            {apiKey ? (
                                <View className="bg-[#1e1e1e]/90 p-3 rounded-md border border-accent/40 flex-row items-center justify-between">
                                    <View className="flex-row items-center gap-2 flex-1">
                                        <Ionicons name="key" size={18} color={COLORS.accent} />
                                        <Text className="text-white text-xs font-semibold" numberOfLines={1}>
                                            {t("loginApiKeySavedLabel")}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={removeSavedApiKey}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        className="flex-row items-center gap-1"
                                    >
                                        <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                                        <Text className="text-danger text-xs font-medium">{t("loginRemoveApiKey")}</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <>
                                    <View className="flex-row justify-between items-center mb-1">
                                        <Text className="text-gray-400 text-xs font-semibold">
                                            {t("loginApiKeyLabel")}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={openApiKeyPage}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            className="flex-row items-center gap-1"
                                        >
                                            <Ionicons name="key-outline" size={14} color={COLORS.accent} />
                                            <Text className="text-accent text-xs font-medium">{t("loginGetApiKey")}</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <TextInput
                                        label={t("loginApiKeyLabel")}
                                        value={keyInput}
                                        onChangeText={handleApiKeyChange}
                                        mode="outlined"
                                        secureTextEntry={!showApiKey}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        style={{ backgroundColor: "#222" }}
                                        theme={{
                                            colors: {
                                                primary: COLORS.accent,
                                            },
                                        }}
                                        textColor="#fff"
                                        right={
                                            <TextInput.Icon
                                                icon={() => (
                                                    <Ionicons
                                                        name={showApiKey ? "eye-off-outline" : "eye-outline"}
                                                        size={20}
                                                        color="#9ca3af"
                                                    />
                                                )}
                                                onPress={() => setShowApiKey(v => !v)}
                                            />
                                        }
                                    />
                                </>
                            )}
                        </View>

                        {/* Input + submit arrow */}
                        {apiKey && (
                            <View className="mb-3">
                                <TextInput
                                    label={t("loginSteamIdLabel")}
                                    value={input}
                                    onChangeText={setInput}
                                    mode="outlined"
                                    style={{ backgroundColor: "#222" }}
                                    theme={{
                                        colors: {
                                        primary: COLORS.accent,
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
                        )}

                        <TouchableOpacity
                            onPress={() => setAboutVisible(true)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            className="flex-row items-center justify-center gap-1"
                        >
                            <Ionicons name="information-circle-outline" size={14} color="#9ca3af" />
                            <Text className="text-gray-400 text-[10px] text-center mb-0.5">
                                © 2026 Richard Pacco
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ImageBackground>

            {/* Confirmar limpeza do banco */}
            <ClearDbModal
                visible={confirmVisible}
                onClose={() => setConfirmVisible(false)}
                onConfirm={confirmClearDB}
            />

            {/* Confirmar remoção de conta salva */}
            <RemoveAccountModal
                visible={!!accountToRemove}
                account={accountToRemove}
                onClose={() => setAccountToRemove(null)}
                onConfirm={doRemoveAccount}
            />

            {/* Sobre o app */}
            <AboutModal
                visible={aboutVisible}
                onClose={() => setAboutVisible(false)}
            />
        </SafeAreaView>
    );



}
