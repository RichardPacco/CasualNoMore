import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { Image, StyleSheet, View } from "react-native";
import { AppText, Button, Dialog } from "@/src/components/ui";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS } from "@/src/theme/colors";

const GITHUB_URL = "https://github.com/RichardPacco/CasualNoMore";
const appIcon = require("../../assets/images/app_icon.png");

/**
 * Diálogo "Sobre o app" (redesign, prancheta 12): ícone, nome, versão,
 * autor, aviso de não afiliação e link para o GitHub.
 * Props: visible, onClose.
 */
export default function AboutModal({ visible, onClose }) {
    const { t } = useLanguage();
    const version = Constants.expoConfig?.version ?? "";

    return (
        <Dialog
            visible={visible}
            onClose={onClose}
            top={(
                <View style={styles.logoBox}>
                    <Image source={appIcon} style={styles.logo} resizeMode="contain" accessibilityLabel="CasualNoMore" />
                </View>
            )}
            title="CasualNoMore"
        >
            <View style={{ gap: 6, marginTop: -8, marginBottom: 6 }}>
                <AppText variant="muted" style={styles.center}>
                    {t("aboutVersionBy", { version, name: "Richard Pacco" })}
                </AppText>
                <AppText variant="muted" style={[styles.center, { color: COLORS.textSoft }]}>
                    {t("aboutDisclaimer")}
                </AppText>
                <AppText variant="muted" style={[styles.center, { color: COLORS.textSoft }]}>
                    {t("raCredit")}
                </AppText>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
                <Button
                    label={t("aboutGitHub")}
                    variant="secondary"
                    onPress={() => WebBrowser.openBrowserAsync(GITHUB_URL).catch(err => console.error("Failed to open browser:", err))}
                    icon={<Ionicons name="logo-github" size={18} color={COLORS.text} />}
                    accessibilityRole="link"
                    style={{ flex: 1 }}
                />
                <Button label={t("close")} onPress={onClose} style={{ flex: 1 }} />
            </View>
        </Dialog>
    );
}

const styles = StyleSheet.create({
    logoBox: {
        width: 72,
        height: 72,
        borderRadius: 22,
        backgroundColor: COLORS.bg,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    logo: { width: 54, height: 54, borderRadius: 12 },
    center: { textAlign: "center", lineHeight: 19 },
});
