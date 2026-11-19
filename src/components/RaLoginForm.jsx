import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useContext, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getUserProfile, RA_SETTINGS_URL, raMedia } from "@/src/api/retroachievements";
import StepCard from "@/src/components/StepCard";
import { AppText, Button, TextField } from "@/src/components/ui";
import Pressable from "@/src/components/ui/Pressable";
import { loadApiKey, saveApiKey } from "@/src/config/apiKeyStore";
import { AuthContext } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";
import { showToast } from "@/src/utils/toast";

/**
 * Login do RetroAchievements: dois passos, a Web API Key (Settings → Keys no
 * site do RA) e o nome de usuário. "Entrar" valida os dois com o perfil do
 * usuário; só então a key é salva e a conta conectada (pelo ULID, que não
 * muda quando o usuário troca de nome).
 * Com a key já salva, o passo 1 aparece concluído e o usuário da última conta
 * vem preenchido. `onConnected` é chamado depois de conectar.
 */
export default function RaLoginForm({ onConnected }) {
    const { t } = useLanguage();
    const { connect, savedAccounts, addSavedAccount } = useContext(AuthContext);
    const lastAccount = savedAccounts.find(a => a.platform === "ra");

    const [savedKey, setSavedKey] = useState("");
    const [keyInput, setKeyInput] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [user, setUser] = useState(lastAccount?.name ?? "");
    const [loading, setLoading] = useState(false);

    /** Carrega a key salva na montagem. */
    useEffect(() => {
        loadApiKey("ra").then(key => { if (key) setSavedKey(key); });
    }, []);

    // As contas salvas podem chegar depois da montagem: preenche se vazio
    useEffect(() => {
        if (lastAccount?.name) setUser(u => u || lastAccount.name);
    }, [lastAccount?.name]);

    /** Remove a key salva (volta o passo 1 para o campo). */
    const removeKey = async () => {
        await saveApiKey("ra", "");
        setSavedKey("");
        setKeyInput("");
        showToast(t("loginApiKeyRemoved"), "info");
    };

    /** Valida key + usuário no RA, salva a key e conecta a conta. */
    const submit = async () => {
        const key = savedKey || keyInput.trim();
        const name = user.trim();
        if (!key || !name) {
            showToast(t("raEmptyInput"), "warning");
            return;
        }

        setLoading(true);
        try {
            const profile = await getUserProfile(name, { key });
            // Usuário fora do ranking: os dados podem vir incompletos, mas entra
            if (Number(profile.Untracked)) showToast(t("raUntracked"), "warning");

            if (!savedKey) {
                await saveApiKey("ra", key);
                setSavedKey(key);
            }
            await addSavedAccount({
                platform: "ra",
                id: profile.ULID,
                name: profile.User,
                avatar: raMedia(profile.UserPic),
            });
            await connect("ra", { user: profile.User, ulid: profile.ULID, userPic: profile.UserPic ?? null });
            onConnected?.();
        } catch (e) {
            // A mensagem do erro nunca tem a URL (que contém a key)
            console.warn("[RaLogin]", e?.message);
            if (e?.status === 401) showToast(t("raInvalidKey"), "error");
            else if (e?.status === 404) showToast(t("raUserNotFound"), "error");
            else showToast(t("raConnectionError"), "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <View style={styles.heading}>
                <AppText variant="title">{t("loginWelcomeTitle")}</AppText>
                <AppText variant="body" color={COLORS.textSoft}>{t("raWelcomeSubtitle")}</AppText>
            </View>

            {/* Passo 1: Web API Key */}
            {savedKey ? (
                <StepCard number={1} state="done" title={t("loginApiKeySavedLabel")}>
                    <Pressable
                        onPress={removeKey}
                        accessibilityRole="button"
                        hitSlop={8}
                        style={styles.inlineDanger}
                    >
                        <Text style={styles.inlineDangerText}>{t("loginRemoveApiKey")}</Text>
                    </Pressable>
                </StepCard>
            ) : (
                <StepCard number={1} state="active" title={t("raStepKeyTitle")}>
                    <TextField
                        label={t("raApiKey")}
                        value={keyInput}
                        onChangeText={setKeyInput}
                        placeholder={t("loginApiKeyPlaceholder")}
                        secureTextEntry={!showKey}
                        autoCapitalize="none"
                        autoCorrect={false}
                        containerStyle={{ gap: 6 }}
                        right={
                            <Pressable
                                onPress={() => setShowKey(v => !v)}
                                accessibilityRole="button"
                                accessibilityLabel={showKey ? t("loginHideKey") : t("loginShowKey")}
                                style={styles.eyeButton}
                            >
                                <Ionicons
                                    name={showKey ? "eye-off-outline" : "eye-outline"}
                                    size={20}
                                    color={COLORS.textMuted}
                                />
                            </Pressable>
                        }
                    />
                    <Pressable
                        onPress={() => WebBrowser.openBrowserAsync(RA_SETTINGS_URL)
                            .catch(err => console.error("Failed to open browser:", err))}
                        accessibilityRole="link"
                        style={styles.linkRow}
                    >
                        <Ionicons name="open-outline" size={18} color={COLORS.accent} />
                        <Text style={styles.linkText}>{t("raOpenSettings")}</Text>
                    </Pressable>
                    <AppText variant="muted" style={{ fontSize: 12 }}>{t("raKeyHelp")}</AppText>
                    <AppText variant="muted" style={{ fontSize: 12 }}>{t("loginApiKeyPrivacy")}</AppText>
                </StepCard>
            )}

            {/* Passo 2: usuário */}
            <StepCard number={2} state="active" title={t("raStepUserTitle")}>
                <TextField
                    label={t("raUsername")}
                    value={user}
                    onChangeText={setUser}
                    placeholder={t("raUsernamePlaceholder")}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="go"
                    onSubmitEditing={submit}
                />
                <Button label={t("loginEnter")} onPress={submit} loading={loading} disabled={loading} />
                <AppText variant="muted" style={{ fontSize: 12 }}>{t("raKeyOwnerTip")}</AppText>
            </StepCard>
        </>
    );
}

const styles = StyleSheet.create({
    heading: { marginTop: 8, marginBottom: 14, gap: 8 },
    eyeButton: { width: 44, height: 44, marginRight: -10, alignItems: "center", justifyContent: "center" },
    linkRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" },
    linkText: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.accent },
    inlineDanger: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
    inlineDangerText: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.danger },
});
