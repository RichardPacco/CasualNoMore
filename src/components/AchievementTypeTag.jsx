import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";

// Tipo da conquista no RA -> [ícone, cor, chave de tradução]
const TYPES = {
    progression: ["flag-outline", COLORS.accent, "typeProgression"],
    win_condition: ["trophy-outline", COLORS.gold, "typeWin"],
    missable: ["alert-circle-outline", COLORS.danger, "typeMissable"],
};

/**
 * Etiqueta do tipo de uma conquista do RetroAchievements: Progressão,
 * Vitória ou Perdível. Sem tipo (ou tipo desconhecido), não mostra nada.
 * Props: type.
 */
export default function AchievementTypeTag({ type }) {
    const { t: tr } = useLanguage();
    const def = TYPES[type];
    if (!def) return null;
    const [icon, color, label] = def;

    return (
        <View style={[styles.tag, { backgroundColor: `${color}1F` }]}>
            <Ionicons name={icon} size={11} color={color} />
            <Text style={[styles.text, { color }]} numberOfLines={1}>{tr(label)}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    tag: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        alignSelf: "flex-start",
    },
    text: { fontFamily: FONTS.bodySemibold, fontSize: 10 },
});
