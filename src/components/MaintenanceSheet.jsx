import { StyleSheet, Text, View } from "react-native";
import Pressable from "@/src/components/ui/Pressable";
import { BottomSheet } from "@/src/components/ui";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";

/**
 * Painel de manutenção (redesign, prancheta 12): substitui os botões
 * "Cache" e "DB" da tela de login. Usa o BottomSheet base.
 * Props: visible, onClose, onClearCache, onClearDb (abre a confirmação).
 */
export default function MaintenanceSheet({ visible, onClose, onClearCache, onClearDb }) {
    const { t } = useLanguage();

    return (
        <BottomSheet visible={visible} onClose={onClose} title={t("maintenanceTitle")}>
            <View style={{ gap: 12 }}>
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
        </BottomSheet>
    );
}

const styles = StyleSheet.create({
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
