import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { COLORS, FONTS } from "@/src/theme/colors";

/**
 * Campo de texto do redesign (48 px, cantos 14) com rótulo opcional acima.
 * Props: label, left/right (elementos opcionais nas pontas, ex.: ícone de
 * busca ou botão de mostrar senha), containerStyle; o resto vai para o TextInput.
 * A borda fica azul enquanto o campo está em foco. `ref` vai para o TextInput
 * (React 19 passa ref como prop comum), para poder dar foco por código.
 */
export default function TextField({ ref, label, left = null, right = null, containerStyle, onFocus, onBlur, ...inputProps }) {
    const [focused, setFocused] = useState(false);

    return (
        <View style={[styles.wrapper, containerStyle]}>
            {label ? <Text style={styles.label}>{label}</Text> : null}
            <View style={[styles.field, { borderColor: focused ? COLORS.accent : COLORS.border }]}>
                {left}
                <TextInput
                    ref={ref}
                    accessibilityLabel={label}
                    placeholderTextColor={COLORS.textMuted}
                    selectionColor={COLORS.accent}
                    style={styles.input}
                    onFocus={(e) => { setFocused(true); onFocus?.(e); }}
                    onBlur={(e) => { setFocused(false); onBlur?.(e); }}
                    {...inputProps}
                />
                {right}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { gap: 6 },
    label: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.textSoft },
    field: {
        height: 48,
        borderRadius: 14,
        borderWidth: 1,
        backgroundColor: COLORS.surface,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    input: {
        flex: 1,
        height: "100%",
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: 15,
        paddingVertical: 0,
    },
});
