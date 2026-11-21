import { Image, StyleSheet, Text, View } from "react-native";
import Pressable from "@/src/components/ui/Pressable";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";

const OPTIONS = [
    { code: "pt", label: "PT", name: "Português", flag: require("../../assets/images/Brazil_flag.png") },
    { code: "en", label: "EN", name: "English", flag: require("../../assets/images/Flag_of_the_United_States.png") },
];

/**
 * Seletor de idioma segmentado (🇧🇷 PT | 🇺🇸 EN), no estilo do redesign: a
 * bandeira de cada idioma ao lado da sigla (apagada quando não está ativo).
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
                        <Image
                            source={opt.flag}
                            style={[styles.flag, !active && { opacity: 0.5 }]}
                            resizeMode="cover"
                        />
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
    option: { minWidth: 44, height: 36, borderRadius: 9, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 10 },
    optionActive: { backgroundColor: COLORS.border },
    label: { fontFamily: FONTS.bodySemibold, fontSize: 13 },
    flag: { width: 20, height: 14, borderRadius: 3 },
});
