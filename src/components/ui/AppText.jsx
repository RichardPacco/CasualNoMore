import { StyleSheet, Text } from "react-native";
import { COLORS, FONTS } from "@/src/theme/colors";

/**
 * Texto com a tipografia do redesign. `variant`:
 * - "title": título de tela (Space Grotesk 30)
 * - "subtitle": título de card/seção grande (Space Grotesk 20)
 * - "itemName": nome de item em lista (Inter 15 semibold)
 * - "body": corpo de texto (Inter 15)
 * - "muted": texto de apoio (Inter 13, cinza)
 * - "label": rótulo de seção em caixa alta (Inter 12)
 * - "stat": número em destaque (Space Grotesk 28)
 * `color` sobrescreve a cor padrão da variante; demais props vão para o Text.
 */
export default function AppText({ variant = "body", color, style, children, ...rest }) {
    const base = styles[variant] ?? styles.body;
    return (
        <Text style={[base, color ? { color } : null, style]} {...rest}>
            {children}
        </Text>
    );
}

const styles = StyleSheet.create({
    title: { fontFamily: FONTS.display, fontSize: 30, letterSpacing: -0.5, color: COLORS.text },
    subtitle: { fontFamily: FONTS.displaySemibold, fontSize: 20, color: COLORS.text },
    itemName: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.text },
    body: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 23, color: COLORS.textSoft },
    muted: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted },
    label: {
        fontFamily: FONTS.bodySemibold,
        fontSize: 12,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        color: COLORS.textMuted,
    },
    stat: { fontFamily: FONTS.display, fontSize: 28, color: COLORS.text },
});
