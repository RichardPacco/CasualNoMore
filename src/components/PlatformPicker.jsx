import { StyleSheet, Text, View } from "react-native";
import Pressable from "@/src/components/ui/Pressable";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";

// Plataformas na ordem do seletor: [valor, chave de tradução]
const OPTIONS = [
    ["steam", "platformSteam"],
    ["ra", "platformRa"],
];

/**
 * Seletor de plataforma (Steam | RetroAchievements) no mesmo estilo
 * segmentado das abas do jogo. Props: value, onChange, disabled.
 */
export default function PlatformPicker({ value, onChange, disabled = false }) {
    const { t } = useLanguage();

    return (
        <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel={t("choosePlatform")}>
            {OPTIONS.map(([platform, label]) => {
                const on = value === platform;
                return (
                    <Pressable
                        key={platform}
                        onPress={() => !on && onChange(platform)}
                        disabled={disabled}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on, disabled }}
                        style={[styles.item, on && styles.itemOn]}
                    >
                        <Text style={[styles.label, on ? styles.labelOn : styles.labelOff]} numberOfLines={1}>
                            {t(label)}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    segment: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 14, backgroundColor: COLORS.surface },
    item: { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
    itemOn: { backgroundColor: COLORS.border },
    label: { fontSize: 14 },
    labelOn: { fontFamily: FONTS.bodySemibold, color: COLORS.text },
    labelOff: { fontFamily: FONTS.bodyMedium, color: COLORS.textSoft },
});
