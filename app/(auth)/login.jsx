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
import PlatformPicker from "@/src/components/PlatformPicker";
import { AppText } from "@/src/components/ui";
import Pressable from "@/src/components/ui/Pressable";
import { saveApiKey } from "@/src/config/apiKeyStore";
import { AuthContext } from "@/src/context/AuthContext";
import { clearDB } from "@/src/database/db";
import { DEFAULT_LANGUAGE, useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS } from "@/src/theme/colors";
import { showToast } from "@/src/utils/toast";

/**
 * Tela de login (redesign, pranchetas 02 e 03). No topo, idioma, manutenção e
 * a escolha da plataforma; o formulário é o mesmo para Steam e
 * RetroAchievements (PlatformLoginForm): passo da key, passo da conta e o
 * modo de contas salvas para login rápido.
 *
 * Parâmetros de rota:
 * - `platform` ("steam" | "ra"): a plataforma inicial;
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

    // Plataforma do formulário (Steam ou RetroAchievements)
    const [platform, setPlatform] = useState(params.platform === "ra" ? "ra" : "steam");
    // Conectando mais uma plataforma a partir do Perfil (já há uma conectada)
    const addMode = params.mode === "add";
    const [loading, setLoading] = useState(false);
    // muda ao limpar o cache: o formulário remonta sem a key e as contas antigas
    const [formKey, setFormKey] = useState(0);

    const [confirmVisible, setConfirmVisible] = useState(false);
    const [aboutVisible, setAboutVisible] = useState(false);
    const [maintenanceVisible, setMaintenanceVisible] = useState(false);

    /** Depois de conectar: volta ao Perfil (modo add) ou vai para as tabs. */
    const finishLogin = () => {
        if (addMode && router.canGoBack()) router.back();
        else router.replace("/(tabs)/GameStack");
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

                    {!addMode && <PlatformPicker value={platform} onChange={setPlatform} disabled={loading} />}

                    <PlatformLoginForm
                        key={`${platform}-${formKey}`}
                        platform={platform}
                        onConnected={finishLogin}
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
    aboutButton: { alignSelf: "center", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12 },
});
