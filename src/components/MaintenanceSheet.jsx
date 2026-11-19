import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/src/components/ui";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";

/**
 * Painel inferior de manutenção (redesign, prancheta 12): substitui os botões
 * "Cache" e "DB" da tela de login.
 * Props: visible, onClose, onClearCache, onClearDb (abre a confirmação).
 */
export default function MaintenanceSheet({ visible, onClose, onClearCache, onClearDb }) {
    const { t } = useLanguage();
    const insets = useSafeAreaInsets();

    return (
        <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t("close")} />
            <View
                accessibilityViewIsModal
                style={[styles.sheet, { paddingBottom: 28 + insets.bottom }]}
            >
                <View style={styles.handle} />

                <View style={styles.header}>
                    <AppText variant="subtitle" style={styles.title}>{t("maintenanceTitle")}</AppText>
                    <Pressable
                        onPress={onClose}
                        accessibilityRole="button"
                        accessibilityLabel={t("close")}
                        style={styles.closeButton}
                    >
                        <Ionicons name="close" size={20} color={COLORS.textSoft} />
                    </Pressable>
                </View>

                <Pressable
                    accessibilityRole="button"
                    onPress={onClearCache}
                    style={({ pressed }) => [styles.option, styles.optionNeutral, { opacity: pressed ? 0.8 : 1 }]}
                >
                    <Text style={[styles.optionTitle, { color: COLORS.text }]}>{t("maintenanceClearCache")}</Text>
                    <Text style={[styles.optionDesc, { color: COLORS.textMuted }]}>{t("maintenanceClearCacheDesc")}</Text>
                </Pressable>

                <Pressable
                    accessibilityRole="button"
                    onPress={onClearDb}
                    style={({ pressed }) => [styles.option, styles.optionDanger, { opacity: pressed ? 0.8 : 1 }]}
                >
                    <Text style={[styles.optionTitle, { color: COLORS.danger }]}>{t("maintenanceClearDb")}</Text>
                    <Text style={[styles.optionDesc, { color: "#D9A3A3" }]}>{t("maintenanceClearDbDesc")}</Text>
                </Pressable>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(3, 6, 10, 0.72)" },
    sheet: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderTopWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 20,
        paddingTop: 10,
        gap: 16,
    },
    handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#364256" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    title: { fontSize: 22 },
    closeButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.surface2,
        alignItems: "center",
        justifyContent: "center",
    },
    option: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, gap: 4 },
    optionNeutral: { backgroundColor: COLORS.surface2 },
    optionDanger: {
        backgroundColor: "rgba(248, 113, 113, 0.08)",
        borderWidth: 1,
        borderColor: "rgba(248, 113, 113, 0.35)",
    },
    optionTitle: { fontFamily: FONTS.bodySemibold, fontSize: 15 },
    optionDesc: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 19 },
});
