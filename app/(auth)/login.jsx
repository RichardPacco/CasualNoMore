import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { getPlayerSummary, resolveVanityURL } from "@/src/api/steam";
import { loadApiKey, saveApiKeyStore } from "@/src/config/apiKeyStore";
import LanguageSelector from "@/src/components/LanguageSelector";
import MaintenanceSheet from "@/src/components/MaintenanceSheet";
import { AppText, Button, TextField } from "@/src/components/ui";
import ClearDbModal from "@/src/components/ClearDbModal";
import RemoveAccountModal from "@/src/components/RemoveAccountModal";
import AboutModal from "@/src/components/AboutModal";
import { AuthContext } from "@/src/context/AuthContext";
import { clearDB } from "@/src/database/db";
import { DEFAULT_LANGUAGE, useLanguage } from "@/src/i18n/LanguageContext";
import { showToast } from "@/src/utils/toast";
import { COLORS, FONTS } from "@/src/theme/colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useContext, useEffect, useState } from "react";
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";


/**
 * Tela de login (redesign, prancheta 02): dois passos guiados, primeiro a
 * API key e depois o SteamID/vanity, com contas salvas para login rápido.
 * Cache e banco ficam no painel de manutenção (ícone de engrenagem).
 */
export default function Login() {
    const { setSteamId, clearSteamId, savedAccounts, addSavedAccount, removeSavedAccount, clearSavedAccounts } = useContext(AuthContext);
    const router = useRouter();
    const { t, setLanguage } = useLanguage();

    const [input, setInput] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [keyInput, setKeyInput] = useState("");
    const [showApiKey, setShowApiKey] = useState(false);
    const [loading, setLoading] = useState(false);
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [accountToRemove, setAccountToRemove] = useState(null);
    const [aboutVisible, setAboutVisible] = useState(false);
    const [maintenanceVisible, setMaintenanceVisible] = useState(false);

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

    /**
     * Limpa o cache (AsyncStorage), disparado pelo botão de limpar cache.
     * Também zera as cópias em memória (API key, contas salvas, steamId), senão a
     * tela continuaria mostrando dados que já não existem no armazenamento.
     * O idioma também volta ao padrão, como numa instalação nova.
     * A API key fica no SecureStore, que o AsyncStorage.clear() não alcança,
     * então é apagada à parte (memória + armazenamento seguro).
     */
    const handleClearCache = async () => {
        try {
            await AsyncStorage.clear();
            await saveApiKeyStore("");
            setApiKey("");
            setKeyInput("");
            await clearSavedAccounts();
            await clearSteamId();
            await setLanguage(DEFAULT_LANGUAGE);
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

    /**
     * Login rápido com uma conta salva (toque no avatar): valida o perfil como
     * no login normal (o perfil pode ter ficado privado desde que foi salvo),
     * atualiza nome/avatar salvos e vai para as tabs.
     */
    const handleQuickLogin = async (account) => {
        if (loading) return;
        if (!apiKey) {
            showToast(t("loginApiKeyMissing"), "warning");
            return;
        }

        setLoading(true);
        try {
            // validateSteamProfile já mostra o toast de erro/privado
            const playerSummary = await validateSteamProfile(account.steamId);
            if (!playerSummary) return;

            await saveAccount(playerSummary, account.steamId);
            await setSteamId(account.steamId);
            router.replace("/(tabs)/GameStack");
        } finally {
            setLoading(false);
        }
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



    /** Abre a confirmação de limpar o banco a partir do painel de manutenção. */
    const openClearDbFromMaintenance = () => {
        setMaintenanceVisible(false);
        // espera o painel fechar antes de abrir o próximo modal (iOS não empilha modais)
        setTimeout(() => setConfirmVisible(true), 250);
    };

    /** Limpa o cache a partir do painel de manutenção. */
    const clearCacheFromMaintenance = async () => {
        setMaintenanceVisible(false);
        await handleClearCache();
    };

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Topo: idioma e manutenção (substitui os botões Cache/DB) */}
                    <View style={styles.topBar}>
                        <LanguageSelector />
                        <Pressable
                            onPress={() => setMaintenanceVisible(true)}
                            accessibilityRole="button"
                            accessibilityLabel={t("maintenanceButton")}
                            style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.8 : 1 }]}
                        >
                            <Ionicons name="settings-outline" size={20} color={COLORS.textMuted} />
                        </Pressable>
                    </View>

                    <View style={styles.heading}>
                        <AppText variant="title">{t("loginWelcomeTitle")}</AppText>
                        <AppText variant="body" color={COLORS.textSoft}>{t("loginWelcomeSubtitle")}</AppText>
                    </View>

                    {/* Contas salvas: visual atualizado no passo 3 do redesign */}
                    {savedAccounts.length > 0 && (
                        <View style={styles.accounts}>
                            <AppText variant="muted" style={{ textAlign: "center" }}>
                                {t("loginAccountsLabel")}
                            </AppText>
                            <View style={styles.accountsRow}>
                                {savedAccounts.map((acc) => (
                                    <TouchableOpacity
                                        key={acc.steamId}
                                        onPress={() => handleQuickLogin(acc)}
                                        onLongPress={() => confirmRemoveAccount(acc)}
                                        accessibilityRole="button"
                                        accessibilityLabel={acc.name}
                                        style={{ alignItems: "center", gap: 4 }}
                                    >
                                        <Image source={{ uri: acc.avatar }} style={styles.accountAvatar} />
                                        <AppText variant="muted" numberOfLines={1} style={{ maxWidth: 70 }}>
                                            {acc.name}
                                        </AppText>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Passo 1: chave da API */}
                    {apiKey ? (
                        <StepCard number={1} state="done" title={t("loginApiKeySavedLabel")}>
                            <Pressable
                                onPress={removeSavedApiKey}
                                accessibilityRole="button"
                                hitSlop={8}
                                style={styles.inlineDanger}
                            >
                                <Text style={styles.inlineDangerText}>{t("loginRemoveApiKey")}</Text>
                            </Pressable>
                        </StepCard>
                    ) : (
                        <StepCard number={1} state="active" title={t("loginStepKeyTitle")}>
                            <TextField
                                label={t("loginApiKeyHint")}
                                value={keyInput}
                                onChangeText={handleApiKeyChange}
                                placeholder={t("loginApiKeyPlaceholder")}
                                secureTextEntry={!showApiKey}
                                autoCapitalize="none"
                                autoCorrect={false}
                                containerStyle={{ gap: 6 }}
                                right={
                                    <Pressable
                                        onPress={() => setShowApiKey(v => !v)}
                                        accessibilityRole="button"
                                        accessibilityLabel={showApiKey ? t("loginHideKey") : t("loginShowKey")}
                                        style={styles.eyeButton}
                                    >
                                        <Ionicons
                                            name={showApiKey ? "eye-off-outline" : "eye-outline"}
                                            size={20}
                                            color={COLORS.textMuted}
                                        />
                                    </Pressable>
                                }
                            />
                            <Pressable
                                onPress={openApiKeyPage}
                                accessibilityRole="link"
                                style={styles.linkRow}
                            >
                                <Ionicons name="open-outline" size={18} color={COLORS.accent} />
                                <Text style={styles.linkText}>{t("loginGetApiKeySteam")}</Text>
                            </Pressable>
                            <AppText variant="muted" style={{ fontSize: 12 }}>{t("loginApiKeyPrivacy")}</AppText>
                        </StepCard>
                    )}

                    {/* Passo 2: perfil Steam (liberado depois da chave) */}
                    {apiKey ? (
                        <StepCard number={2} state="active" title={t("loginStepProfileTitle")}>
                            <TextField
                                label={t("loginSteamIdLabel")}
                                value={input}
                                onChangeText={setInput}
                                placeholder="76561198000000000"
                                autoCapitalize="none"
                                autoCorrect={false}
                                returnKeyType="go"
                                onSubmitEditing={handleSubmit}
                            />
                            <Button label={t("loginEnter")} onPress={handleSubmit} loading={loading} />
                            <AppText variant="muted" style={{ fontSize: 12 }}>{t("loginPublicTip")}</AppText>
                        </StepCard>
                    ) : (
                        <StepCard number={2} state="locked" title={t("loginStepProfileTitle")}>
                            <AppText variant="muted" color={COLORS.textSoft} style={{ lineHeight: 19 }}>
                                {t("loginStepProfileHint")}
                            </AppText>
                        </StepCard>
                    )}

                    <View style={{ flex: 1 }} />

                    <Pressable
                        onPress={() => setAboutVisible(true)}
                        accessibilityRole="button"
                        style={styles.aboutButton}
                    >
                        <Ionicons name="information-circle-outline" size={16} color={COLORS.textMuted} />
                        <AppText variant="muted">{t("aboutApp")}</AppText>
                    </Pressable>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Manutenção: limpar cache ou banco */}
            <MaintenanceSheet
                visible={maintenanceVisible}
                onClose={() => setMaintenanceVisible(false)}
                onClearCache={clearCacheFromMaintenance}
                onClearDb={openClearDbFromMaintenance}
            />

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
        </View>
    );
}

/**
 * Card de um passo do login. `state`:
 * - "active": passo atual (borda azul, número em azul)
 * - "done": concluído (número vira check verde)
 * - "locked": ainda não liberado (apagado)
 */
function StepCard({ number, title, state, children }) {
    const active = state === "active";
    const done = state === "done";
    return (
        <View
            style={[
                styles.stepCard,
                { borderColor: active ? COLORS.accent : COLORS.borderSubtle, opacity: state === "locked" ? 0.6 : 1 },
            ]}
        >
            <View style={styles.stepHeader}>
                <View
                    style={[
                        styles.stepBadge,
                        { backgroundColor: active ? COLORS.accent : done ? "rgba(74, 222, 128, 0.16)" : COLORS.border },
                    ]}
                >
                    {done ? (
                        <Ionicons name="checkmark" size={16} color={COLORS.success} />
                    ) : (
                        <Text style={[styles.stepNumber, { color: active ? COLORS.onAccent : COLORS.textSoft }]}>
                            {number}
                        </Text>
                    )}
                </View>
                <Text style={styles.stepTitle} numberOfLines={1}>{title}</Text>
            </View>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.bg },
    content: { flexGrow: 1, padding: 20, gap: 14 },
    topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        backgroundColor: COLORS.surface,
        alignItems: "center",
        justifyContent: "center",
    },
    heading: { marginTop: 22, marginBottom: 14, gap: 8 },
    accounts: { gap: 8, marginBottom: 6 },
    accountsRow: { flexDirection: "row", justifyContent: "center", gap: 20 },
    accountAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: COLORS.accent },
    stepCard: {
        padding: 16,
        borderRadius: 20,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        gap: 12,
    },
    stepHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    stepBadge: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    stepNumber: { fontFamily: FONTS.bodySemibold, fontSize: 14 },
    stepTitle: { flex: 1, fontFamily: FONTS.bodySemibold, fontSize: 16, color: COLORS.text },
    eyeButton: { width: 44, height: 44, marginRight: -10, alignItems: "center", justifyContent: "center" },
    linkRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" },
    linkText: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.accent },
    inlineDanger: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
    inlineDangerText: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.danger },
    aboutButton: { alignSelf: "center", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12 },
});
