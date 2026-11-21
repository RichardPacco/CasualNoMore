import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Pressable from "./Pressable";
import { COLORS, FONTS } from "@/src/theme/colors";

const VARIANTS = {
    // ação principal: azul de destaque com texto escuro
    primary: { bg: COLORS.accent, fg: COLORS.onAccent, border: "transparent" },
    // ação secundária: superfície com borda
    secondary: { bg: COLORS.surface, fg: COLORS.text, border: COLORS.border },
    // ação destrutiva leve (ex.: "Limpar" num menu)
    danger: { bg: "rgba(248, 113, 113, 0.14)", fg: COLORS.danger, border: "transparent" },
    // confirmação destrutiva (botão cheio, ex.: "Remover" num diálogo)
    dangerSolid: { bg: COLORS.danger, fg: "#1A0606", border: "transparent" },
};

/**
 * Botão do redesign (48 px de altura, cantos 14).
 * Props: label, onPress, variant (primary|secondary|danger|dangerSolid),
 * icon (elemento opcional à esquerda), loading, disabled, style.
 */
export default function Button({
    label,
    onPress,
    variant = "primary",
    icon = null,
    loading = false,
    disabled = false,
    style,
    ...rest
}) {
    const v = VARIANTS[variant] ?? VARIANTS.primary;
    const inactive = disabled || loading;

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: inactive, busy: loading }}
            onPress={onPress}
            disabled={inactive}
            style={({ pressed }) => [
                styles.base,
                { backgroundColor: v.bg, borderColor: v.border, opacity: inactive ? 0.5 : pressed ? 0.8 : 1 },
                style,
            ]}
            {...rest}
        >
            {loading ? (
                <ActivityIndicator size="small" color={v.fg} />
            ) : (
                <View style={styles.content}>
                    {icon}
                    <Text style={[styles.label, { color: v.fg }]}>{label}</Text>
                </View>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {
        height: 48,
        paddingHorizontal: 20,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    content: { flexDirection: "row", alignItems: "center", gap: 8 },
    label: { fontFamily: FONTS.bodySemibold, fontSize: 15 },
});
