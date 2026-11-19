import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";

const OPTIONS = [
    { code: "pt", label: "PT", name: "Português" },
    { code: "en", label: "EN", name: "English" },
];

/**
 * Seletor de idioma segmentado (PT | EN), no estilo do redesign.
 * `inset` = fundo mais escuro, para usar dentro de um card (ex.: Perfil).
 */
export default function LanguageSelector({ inset = false }) {
    const { language, setLanguage, t } = useLanguage();

    return (
        <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t("languageLabel")}
            style={[styles.group, inset ? styles.groupInset : styles.groupDefault]}
        >
            {OPTIONS.map((opt) => {
                const active = language === opt.code;
                return (
                    <Pressable
                        key={opt.code}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                        accessibilityLabel={opt.name}
                        onPress={() => setLanguage(opt.code)}
                        style={({ pressed }) => [
                            styles.option,
                            active && styles.optionActive,
                            { opacity: pressed ? 0.8 : 1 },
                        ]}
                    >
                        <Text style={[styles.label, { color: active ? COLORS.text : COLORS.textMuted }]}>
                            {opt.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    group: { flexDirection: "row", padding: 3, borderRadius: 12, alignSelf: "flex-start" },
    groupDefault: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderSubtle },
    groupInset: { backgroundColor: COLORS.bg },
    option: { minWidth: 44, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
    optionActive: { backgroundColor: COLORS.border },
    label: { fontFamily: FONTS.bodySemibold, fontSize: 13 },
});
