import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, View } from "react-native";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS } from "@/src/theme/colors";

// medalha de jogo completo, a mesma de antes do redesign
const completionIcon = require("../../assets/images/completion_icon.png");

// prata para o "completo" do RA (100% em softcore)
const SILVER = "#C9D3E0";

/**
 * Medalha do card pelo nível (`award` do LibraryGame):
 * - "complete" (Steam, 100%) e "mastered" (RA, 100% hardcore): a medalha dourada;
 * - "completed" (100% softcore): a mesma medalha em prata (sem uso hoje: só
 *   hardcore conta no RA, decisão D2);
 * - "beaten" (RA, zerou): bandeira.
 * Props: award, size.
 */
export default function AwardMedal({ award, size = 24 }) {
    const { t: tr } = useLanguage();
    if (!award) return null;

    if (award === "beaten") {
        return (
            <View
                style={[styles.flag, { width: size, height: size, borderRadius: size / 2 }]}
                accessibilityLabel={tr("awardBeaten")}
            >
                <Ionicons name="flag" size={Math.round(size * 0.6)} color={COLORS.accent} />
            </View>
        );
    }

    const label = award === "mastered" ? tr("awardMastered")
        : award === "completed" ? tr("awardCompleted")
            : tr("filterCompleted");
    return (
        <Image
            source={completionIcon}
            style={[{ width: size, height: size }, award === "completed" && { tintColor: SILVER }]}
            resizeMode="contain"
            accessibilityLabel={label}
        />
    );
}

const styles = StyleSheet.create({
    flag: { backgroundColor: COLORS.accentSoft, alignItems: "center", justifyContent: "center" },
});
