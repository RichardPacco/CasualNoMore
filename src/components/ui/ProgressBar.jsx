import { View } from "react-native";
import { COLORS } from "@/src/theme/colors";

/**
 * Barra de progresso fina. `value` em % (0–100). Em 100% fica dourada
 * (jogo completo); senão usa o azul de destaque. `height` padrão 4.
 */
export default function ProgressBar({ value = 0, height = 4, color, style }) {
    const pct = Math.max(0, Math.min(100, Number(value) || 0));
    const fill = color ?? (pct >= 100 ? COLORS.gold : COLORS.accent);

    return (
        <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
            style={[{ height, borderRadius: height / 2, backgroundColor: COLORS.border, overflow: "hidden" }, style]}
        >
            <View style={{ width: `${pct}%`, height, borderRadius: height / 2, backgroundColor: fill }} />
        </View>
    );
}
