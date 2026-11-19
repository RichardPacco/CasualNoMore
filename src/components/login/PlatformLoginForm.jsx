import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, StyleSheet, Text, View } from "react-native";
import RemoveAccountModal from "@/src/components/RemoveAccountModal";
import StepCard from "@/src/components/StepCard";
import { AppText, Button, TextField } from "@/src/components/ui";
import Pressable from "@/src/components/ui/Pressable";
import { loadApiKey, saveApiKey } from "@/src/config/apiKeyStore";
import { AuthContext } from "@/src/context/AuthContext";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";
import { showToast } from "@/src/utils/toast";
import { LOGIN_PLATFORMS } from "./loginPlatforms";

// Mesmo limite do AuthContext (MAX_SAVED_ACCOUNTS): espaços na grade de contas
const MAX_ACCOUNT_SLOTS = 3;

/**
 * Formulário de login de uma plataforma (Steam ou RetroAchievements), igual
 * para as duas (redesign, pranchetas 02 e 03):
 * - modo passos: 1) a API key, salva sozinha quando o formato bate;
 *   2) a conta, liberada depois da key;
 * - modo contas (key salva + contas salvas): grade para login rápido
 *   (toque entra, toque longo remove), "Entrar com outra conta" e, no fim,
 *   o cartão da key salva com "Remover".
 * O que muda de uma plataforma para outra vem de LOGIN_PLATFORMS.
 *
 * Props: platform, onConnected, ignoreSavedKey (pede key nova mesmo havendo
 * uma salva, ex.: key revogada), onLoadingChange.
 */
export default function PlatformLoginForm({ platform, onConnected, ignoreSavedKey = false, onLoadingChange }) {
    const config = LOGIN_PLATFORMS[platform];
    const txt = config.texts;
    const { t } = useLanguage();
    const { connect, savedAccounts, addSavedAccount, removeSavedAccount } = useContext(AuthContext);

    const [apiKey, setApiKey] = useState("");
    const [keyInput, setKeyInput] = useState("");
    const [showApiKey, setShowApiKey] = useState(false);
    const [input, setInput] = useState("");
    const [loading, setLoadingState] = useState(false);
    // conta salva sendo validada no login rápido (mostra o carregamento no cartão dela)
    const [pendingAccountId, setPendingAccountId] = useState(null);
    const [accountToRemove, setAccountToRemove] = useState(null);
    const otherAccountRef = useRef(null);

    const setLoading = (v) => {
        setLoadingState(v);
        onLoadingChange?.(v);
    };

    const accounts = savedAccounts.filter(a => a.platform === platform);
    // Modo contas quando há key salva e pelo menos uma conta; senão os dois passos
    const showAccounts = !!apiKey && accounts.length > 0;

    /** Carrega a key salva da plataforma na montagem. */
    useEffect(() => {
        if (ignoreSavedKey) return;
        loadApiKey(platform).then(stored => {
            if (stored) {
                setApiKey(stored);
                setKeyInput(stored);
            }
        });
    }, [platform, ignoreSavedKey]);

    /** Abre a página onde o usuário pega a key. */
    const openApiKeyPage = () => {
        WebBrowser.openBrowserAsync(config.getKeyUrl).catch(err => console.error("Failed to open browser:", err));
    };

    /** Salva a key quando o texto digitado tem o formato de uma key válida. */
    const handleApiKeyChange = async (text) => {
        setKeyInput(text);
        const trimmed = text.trim();
        if (config.keyPattern.test(trimmed)) {
            await saveApiKey(platform, trimmed);
            setApiKey(trimmed);
            showToast(t("loginApiKeySaved"), "success");
        }
    };

    /** Remove a key salva e limpa os campos. */
    const removeSavedApiKey = async () => {
        await saveApiKey(platform, "");
        setApiKey("");
        setKeyInput("");
        showToast(t("loginApiKeyRemoved"), "info");
    };

    /**
     * Valida a conta (digitada ou salva) na plataforma, salva nas contas
     * salvas, conecta e chama onConnected. Retorna true se entrou.
     */
    const signIn = async (value) => {
        const result = await config.signIn(value, { key: apiKey, t });
        if (!result) return false;
        await addSavedAccount({ platform, ...result.account });
        await connect(platform, result.connectData);
        onConnected?.();
        return true;
    };

    /** Envia a conta digitada (botão Entrar ou o "ir" do teclado). */
    const handleSubmit = async () => {
        if (!apiKey) {
            showToast(t(txt.keyMissing), "warning");
            return;
        }
        if (!input.trim()) {
            showToast(t(txt.emptyInput), "warning");
            return;
        }
        setLoading(true);
        try {
            await signIn(input);
        } catch (e) {
            // a mensagem do erro nunca tem a URL (que pode conter a key)
            console.warn("[Login]", platform, e?.message);
            showToast(t(txt.connectionError), "error");
        } finally {
            setLoading(false);
        }
    };

    /**
     * Login rápido com uma conta salva: valida de novo (o perfil pode ter
     * mudado desde que foi salvo), atualiza nome/avatar e entra.
     */
    const handleQuickLogin = async (account) => {
        if (loading) return;
        if (!apiKey) {
            showToast(t(txt.keyMissing), "warning");
            return;
        }
        setLoading(true);
        setPendingAccountId(account.id);
        try {
            await signIn(account.id);
        } catch (e) {
            console.warn("[Login]", platform, e?.message);
            showToast(t(txt.connectionError), "error");
        } finally {
            setLoading(false);
            setPendingAccountId(null);
        }
    };

    /** Remove a conta salva selecionada (confirmado no modal de remoção). */
    const doRemoveAccount = async () => {
        if (!accountToRemove) return;
        const { id } = accountToRemove;
        setAccountToRemove(null);
        try {
            await removeSavedAccount(platform, id);
        } catch (err) {
            console.error(err);
            Alert.alert(t("loginError"), t("loginDbClearFailed"));
        }
    };

    const keyField = (
        <TextField
            label={t(txt.keyHint)}
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
                    <Ionicons name={showApiKey ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.textMuted} />
                </Pressable>
            }
        />
    );

    return (
        <>
            {showAccounts ? (
                <>
                    {/* Modo contas: key salva e contas para login rápido */}
                    <View style={styles.heading}>
                        <AppText variant="title">{t("loginAccountsTitle")}</AppText>
                        <AppText variant="muted" style={{ fontSize: 14 }}>{t("loginAccountsHint")}</AppText>
                    </View>

                    <View style={styles.accountsGrid}>
                        {accounts.map((acc, index) => (
                            <AccountTile
                                key={acc.id}
                                account={acc}
                                highlighted={index === 0}
                                busy={pendingAccountId === acc.id}
                                disabled={loading}
                                onPress={() => handleQuickLogin(acc)}
                                onLongPress={() => setAccountToRemove(acc)}
                            />
                        ))}
                        {accounts.length < MAX_ACCOUNT_SLOTS && (
                            <Pressable
                                onPress={() => otherAccountRef.current?.focus()}
                                accessibilityRole="button"
                                accessibilityLabel={t("loginOtherAccount")}
                                style={({ pressed }) => [styles.accountTile, styles.addTile, { opacity: pressed ? 0.8 : 1 }]}
                            >
                                <View style={styles.addCircle}>
                                    <Ionicons name="add" size={24} color={COLORS.textMuted} />
                                </View>
                                <Text style={[styles.accountName, { color: COLORS.textMuted }]}>{t("loginAddAccount")}</Text>
                            </Pressable>
                        )}
                    </View>

                    <View style={styles.otherAccount}>
                        <TextField
                            ref={otherAccountRef}
                            label={t("loginOtherAccount")}
                            value={input}
                            onChangeText={setInput}
                            placeholder={t(txt.idLabel)}
                            autoCapitalize="none"
                            autoCorrect={false}
                            returnKeyType="go"
                            onSubmitEditing={handleSubmit}
                        />
                        <Button
                            label={t("loginEnter")}
                            onPress={handleSubmit}
                            loading={loading && !pendingAccountId}
                            disabled={loading}
                        />
                        <AppText variant="muted" style={{ fontSize: 12 }}>{t(txt.tip)}</AppText>
                    </View>
                </>
            ) : (
                <>
                    <View style={styles.heading}>
                        <AppText variant="title">{t("loginWelcomeTitle")}</AppText>
                        <AppText variant="body" color={COLORS.textSoft}>{t(txt.welcomeSubtitle)}</AppText>
                    </View>

                    {/* Passo 1: chave da API */}
                    {apiKey ? (
                        <StepCard number={1} state="done" title={t("loginApiKeySavedLabel")}>
                            <Pressable onPress={removeSavedApiKey} accessibilityRole="button" hitSlop={8} style={styles.inlineDanger}>
                                <Text style={styles.inlineDangerText}>{t("loginRemoveApiKey")}</Text>
                            </Pressable>
                        </StepCard>
                    ) : (
                        <StepCard number={1} state="active" title={t(txt.stepKeyTitle)}>
                            {keyField}
                            <Pressable onPress={openApiKeyPage} accessibilityRole="link" style={styles.linkRow}>
                                <Ionicons name="open-outline" size={18} color={COLORS.accent} />
                                <Text style={styles.linkText}>{t(txt.getKey)}</Text>
                            </Pressable>
                            {txt.keyHelp && <AppText variant="muted" style={{ fontSize: 12 }}>{t(txt.keyHelp)}</AppText>}
                            <AppText variant="muted" style={{ fontSize: 12 }}>{t("loginApiKeyPrivacy")}</AppText>
                        </StepCard>
                    )}

                    {/* Passo 2: conta (liberado depois da chave) */}
                    {apiKey ? (
                        <StepCard number={2} state="active" title={t(txt.stepAccountTitle)}>
                            <TextField
                                label={t(txt.idLabel)}
                                value={input}
                                onChangeText={setInput}
                                placeholder={config.idPlaceholder ?? t(txt.idLabel)}
                                autoCapitalize="none"
                                autoCorrect={false}
                                returnKeyType="go"
                                onSubmitEditing={handleSubmit}
                            />
                            <Button label={t("loginEnter")} onPress={handleSubmit} loading={loading} />
                            <AppText variant="muted" style={{ fontSize: 12 }}>{t(txt.tip)}</AppText>
                        </StepCard>
                    ) : (
                        <StepCard number={2} state="locked" title={t(txt.stepAccountTitle)}>
                            <AppText variant="muted" color={COLORS.textSoft} style={{ lineHeight: 19 }}>
                                {t(txt.stepAccountHint)}
                            </AppText>
                        </StepCard>
                    )}
                </>
            )}

            <View style={{ flex: 1 }} />

            {/* Modo contas: status da chave salva no rodapé */}
            {showAccounts && (
                <View style={styles.keyCard}>
                    <Ionicons name="key-outline" size={18} color={COLORS.success} />
                    <Text style={styles.keyCardText}>{t("loginApiKeySavedLabel")}</Text>
                    <Pressable
                        onPress={removeSavedApiKey}
                        accessibilityRole="button"
                        accessibilityLabel={t("loginRemoveApiKey")}
                        style={styles.inlineDanger}
                    >
                        <Text style={styles.inlineDangerText}>{t("loginRemove")}</Text>
                    </Pressable>
                </View>
            )}

            {/* Confirmar remoção de conta salva */}
            <RemoveAccountModal
                visible={!!accountToRemove}
                account={accountToRemove}
                onClose={() => setAccountToRemove(null)}
                onConfirm={doRemoveAccount}
            />
        </>
    );
}

/**
 * Cartão de uma conta salva: avatar (ou iniciais, se não houver), nome e
 * carregamento enquanto o login rápido valida o perfil.
 * Toque entra, toque longo pede para remover.
 */
function AccountTile({ account, highlighted, busy, disabled, onPress, onLongPress }) {
    const [avatarFailed, setAvatarFailed] = useState(false);
    const initials = (account.name || "?")
        .split(/\s+/)
        .map(w => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    return (
        <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={400}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={account.name}
            accessibilityState={{ busy, disabled }}
            style={({ pressed }) => [
                styles.accountTile,
                { borderColor: highlighted ? COLORS.accent : COLORS.borderSubtle, opacity: pressed ? 0.8 : 1 },
            ]}
        >
            <View style={styles.avatarWrap}>
                {account.avatar && !avatarFailed ? (
                    <Image source={{ uri: account.avatar }} onError={() => setAvatarFailed(true)} style={styles.accountAvatar} />
                ) : (
                    <View style={[styles.accountAvatar, styles.avatarFallback]}>
                        <Text style={styles.avatarInitials}>{initials}</Text>
                    </View>
                )}
                {busy && (
                    <View style={styles.avatarBusy}>
                        <ActivityIndicator size="small" color={COLORS.accent} />
                    </View>
                )}
            </View>
            <Text style={styles.accountName} numberOfLines={1}>{account.name}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    heading: { marginTop: 8, marginBottom: 14, gap: 8 },
    accountsGrid: { flexDirection: "row", gap: 12 },
    accountTile: {
        flex: 1,
        maxWidth: "33.33%",
        paddingVertical: 16,
        paddingHorizontal: 8,
        borderRadius: 20,
        borderWidth: 1,
        backgroundColor: COLORS.surface,
        alignItems: "center",
        gap: 10,
    },
    addTile: { borderStyle: "dashed", borderColor: "#364256", backgroundColor: "transparent" },
    addCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: "#364256",
        alignItems: "center",
        justifyContent: "center",
    },
    avatarWrap: { width: 64, height: 64 },
    accountAvatar: { width: 64, height: 64, borderRadius: 32 },
    avatarFallback: { backgroundColor: "#22405E", alignItems: "center", justifyContent: "center" },
    avatarInitials: { fontFamily: FONTS.display, fontSize: 20, color: COLORS.text },
    avatarBusy: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 32,
        backgroundColor: "rgba(10, 14, 21, 0.6)",
        alignItems: "center",
        justifyContent: "center",
    },
    accountName: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.text, maxWidth: "100%" },
    otherAccount: { marginTop: 14, gap: 12 },
    keyCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingLeft: 14,
        paddingRight: 10,
        borderRadius: 16,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
    },
    keyCardText: { flex: 1, fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.text },
    eyeButton: { width: 44, height: 44, marginRight: -10, alignItems: "center", justifyContent: "center" },
    linkRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" },
    linkText: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.accent },
    inlineDanger: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
    inlineDangerText: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.danger },
});
