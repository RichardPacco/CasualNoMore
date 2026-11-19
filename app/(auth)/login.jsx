import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useContext, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, View } from "react-native";
import AboutModal from "@/src/components/AboutModal";
import ClearDbModal from "@/src/components/ClearDbModal";
import LanguageSelector from "@/src/components/LanguageSelector";
import PlatformLoginForm from "@/src/components/login/PlatformLoginForm";
import MaintenanceSheet from "@/src/components/MaintenanceSheet";
import { AppText } from "@/src/components/ui";
import Pressable from "@/src/components/ui/Pressable";
import { saveApiKey } from "@/src/config/apiKeyStore";
import { AuthContext } from "@/src/context/AuthContext";
import { clearDB } from "@/src/database/db";
import { DEFAULT_LANGUAGE, useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS } from "@/src/theme/colors";
import { showToast } from "@/src/utils/toast";

// Ordem das plataformas no fluxo de login
const PIPELINE = [
    { id: "steam", label: "platformSteam" },
    { id: "ra", label: "platformRa" },
];

/**
 * Tela de login (redesign, pranchetas 02 e 03): um fluxo único que passa por
 * cada plataforma (Steam, depois RetroAchievements). Em cada etapa dá para
 * conectar ou pular; ao terminar a última, entra no app (é preciso conectar
 * pelo menos uma). O formulário é o mesmo para as duas (PlatformLoginForm):
 * passo da key, passo da conta e o modo de contas salvas para login rápido.
 *
 * Parâmetros de rota:
 * - `platform` ("steam" | "ra"): começa por essa etapa;
 * - `mode=add` (aberto pelo Perfil para conectar mais uma plataforma):
 *   plataforma fixa, botão de voltar, sem idioma nem manutenção, e ao conectar
 *   volta para o Perfil;
 * - `resetKey=1`: pede uma key nova mesmo havendo uma salva (key revogada).
 */
export default function Login() {
    const { clearSteamId, disconnect, clearSavedAccounts } = useContext(AuthContext);
    const router = useRouter();
    const params = useLocalSearchParams();
    const { t, setLanguage } = useLanguage();

    // Conectando mais uma plataforma a partir do Perfil (já há uma conectada)
    const addMode = params.mode === "add";
    // Etapa atual do fluxo e o resultado de cada plataforma ("connected" | "skipped")
    const [step, setStep] = useState(params.platform === "ra" ? 1 : 0);
    const [results, setResults] = useState({});
    const platform = PIPELINE[step].id;
    const isLastStep = step === PIPELINE.length - 1;
    const [loading, setLoading] = useState(false);
    // muda ao limpar o cache: o formulário remonta sem a key e as contas antigas
    const [formKey, setFormKey] = useState(0);

    const [confirmVisible, setConfirmVisible] = useState(false);
    const [aboutVisible, setAboutVisible] = useState(false);
    const [maintenanceVisible, setMaintenanceVisible] = useState(false);

    /** Fim do fluxo: volta ao Perfil (modo add) ou vai para as tabs. */
    const finishLogin = () => {
        if (addMode && router.canGoBack()) router.back();
        else router.replace("/(tabs)/GameStack");
    };

    /** Marca o resultado da etapa e segue para a próxima (ou termina). */
    const advance = (result) => {
        const next = { ...results, [platform]: result };
        setResults(next);
        if (addMode) {
            finishLogin();
            return;
        }
        if (!isLastStep) {
            setStep(step + 1);
            return;
        }
        // Última etapa: precisa de pelo menos uma plataforma conectada
        if (Object.values(next).includes("connected")) finishLogin();
        else showToast(t("loginNeedOne"), "warning");
    };

    /** Conectou a plataforma da etapa atual. */
    const onConnected = () => {
        showToast(t("loginPlatformConnected", { platform: t(PIPELINE[step].label) }), "success");
        advance("connected");
    };

    /**
     * Limpa o cache (AsyncStorage), como numa instalação nova: contas salvas,
     * contas conectadas e idioma. As API keys ficam no SecureStore, que o
     * AsyncStorage.clear() não alcança, então são apagadas à parte.
     */
    const handleClearCache = async () => {
        try {
            await AsyncStorage.clear();
            await saveApiKey("steam", "");
            await saveApiKey("ra", "");
            await clearSavedAccounts();
            await clearSteamId();
            await disconnect("ra");
            await setLanguage(DEFAULT_LANGUAGE);
            setFormKey(k => k + 1);
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
            showToast(`${t("loginDbCleared")} ${t("loginDbClearedDesc")}`, "success");
        } catch (err) {
            console.error(err);
            Alert.alert(t("loginError"), t("loginDbClearFailed"));
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

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    {/* Topo: idioma e manutenção, ou voltar no modo add */}
                    <View style={styles.topBar}>
                        {addMode ? (
                            <Pressable
                                onPress={() => router.back()}
                                accessibilityRole="button"
                                accessibilityLabel={t("back")}
                                style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.8 : 1 }]}
                            >
                                <Ionicons name="chevron-back" size={22} color={COLORS.text} />
                            </Pressable>
                        ) : (
                            <LanguageSelector />
                        )}
                        {!addMode && (
                            <Pressable
                                onPress={() => setMaintenanceVisible(true)}
                                accessibilityRole="button"
                                accessibilityLabel={t("maintenanceButton")}
                                style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.8 : 1 }]}
                            >
                                <Ionicons name="settings-outline" size={20} color={COLORS.textMuted} />
                            </Pressable>
                        )}
                    </View>

                    {!addMode && (
                        <PipelineHeader
                            step={step}
                            results={results}
                            disabled={loading}
                            onBack={() => setStep(step - 1)}
                            onSkip={() => advance("skipped")}
                        />
                    )}

                    <PlatformLoginForm
                        key={`${platform}-${formKey}`}
                        platform={platform}
                        onConnected={onConnected}
                        ignoreSavedKey={params.resetKey === "1"}
                        onLoadingChange={setLoading}
                    />

                    <Pressable onPress={() => setAboutVisible(true)} accessibilityRole="button" style={styles.aboutButton}>
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
            <ClearDbModal visible={confirmVisible} onClose={() => setConfirmVisible(false)} onConfirm={confirmClearDB} />

            {/* Sobre o app */}
            <AboutModal visible={aboutVisible} onClose={() => setAboutVisible(false)} />
        </View>
    );
}

/**
 * Topo do fluxo de login: as etapas (Steam -> RetroAchievements) com o estado
 * de cada uma (conectada, atual, pulada ou pendente), "Voltar" (da segunda
 * etapa em diante) e "Pular <plataforma>".
 */
function PipelineHeader({ step, results, disabled, onBack, onSkip }) {
    const { t } = useLanguage();
    const current = PIPELINE[step];

    return (
        <View style={styles.pipeline}>
            <View
                style={styles.stepsRow}
                accessibilityRole="progressbar"
                accessibilityLabel={t("loginStepOf", { current: step + 1, total: PIPELINE.length })}
            >
                {PIPELINE.map((p, index) => {
                    const result = results[p.id];
                    const active = index === step;
                    const icon = result === "connected" ? "checkmark-circle"
                        : result === "skipped" ? "remove-circle-outline"
                            : active ? "ellipse" : "ellipse-outline";
                    const color = result === "connected" ? COLORS.success
                        : active ? COLORS.accent : COLORS.textMuted;
                    return (
                        <View key={p.id} style={styles.stepItem}>
                            {index > 0 && <View style={styles.stepLine} />}
                            <Ionicons name={icon} size={16} color={color} />
                            <AppText
                                variant="muted"
                                style={[styles.stepLabel, { color: active ? COLORS.text : color }, result === "skipped" && styles.stepSkipped]}
                            >
                                {t(p.label)}
                            </AppText>
                        </View>
                    );
                })}
            </View>
            <View style={styles.pipelineActions}>
                {step > 0 ? (
                    <Pressable onPress={onBack} disabled={disabled} accessibilityRole="button" style={styles.pipelineLink}>
                        <Ionicons name="chevron-back" size={16} color={COLORS.textSoft} />
                        <AppText variant="muted" style={{ color: COLORS.textSoft }}>{t("back")}</AppText>
                    </Pressable>
                ) : <View />}
                <Pressable onPress={onSkip} disabled={disabled} accessibilityRole="button" style={styles.pipelineLink}>
                    <AppText variant="muted" style={{ color: COLORS.accent }}>
                        {t("loginSkipPlatform", { platform: t(current.label) })}
                    </AppText>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.accent} />
                </Pressable>
            </View>
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
    pipeline: { gap: 6 },
    stepsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    stepItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    stepLine: { width: 20, height: 1, backgroundColor: COLORS.border },
    stepLabel: { fontSize: 13 },
    stepSkipped: { textDecorationLine: "line-through" },
    pipelineActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    pipelineLink: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4 },
    aboutButton: { alignSelf: "center", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12 },
});
