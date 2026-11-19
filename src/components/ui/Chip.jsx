import { StyleSheet, Text } from "react-native";
import Pressable from "./Pressable";
import { COLORS, FONTS } from "@/src/theme/colors";

/**
 * Chip de filtro em formato pílula (34 px, área de toque estendida a 44 px).
 * Props: label, count (opcional, mostrado depois do rótulo), selected, onPress.
 */
export default function Chip({ label, count, selected = false, onPress, style, ...rest }) {
    const text = count != null ? `${label} ${count}` : label;
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={onPress}
            hitSlop={{ top: 5, bottom: 5 }}
            style={({ pressed }) => [
                styles.base,
                selected ? styles.selected : styles.idle,
                { opacity: pressed ? 0.8 : 1 },
                style,
            ]}
            {...rest}
        >
            <Text style={[styles.label, selected ? styles.labelSelected : styles.labelIdle]}>{text}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {
        height: 34,
        paddingHorizontal: 14,
        borderRadius: 17,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    selected: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
    idle: { backgroundColor: "transparent", borderColor: COLORS.border },
    label: { fontSize: 13 },
    labelSelected: { fontFamily: FONTS.bodySemibold, color: COLORS.onAccent },
    labelIdle: { fontFamily: FONTS.bodyMedium, color: COLORS.textSoft },
});
