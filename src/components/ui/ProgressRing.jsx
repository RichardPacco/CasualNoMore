import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { COLORS, FONTS } from "@/src/theme/colors";

/**
 * Anel de progresso com o percentual no centro. `value` em % (0–100).
 * Em 100% fica dourado. `size` padrão 56, `stroke` padrão 6.
 * `showLabel` false esconde o número (anel pequeno decorativo).
 */
export default function ProgressRing({ value = 0, size = 56, stroke = 6, showLabel = true, color, style }) {
    const pct = Math.max(0, Math.min(100, Number(value) || 0));
    const fill = color ?? (pct >= 100 ? COLORS.gold : COLORS.accent);
    const r = (size - stroke) / 2;
    const circumference = 2 * Math.PI * r;
    const offset = circumference * (1 - pct / 100);

    return (
        <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
            style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}
        >
            {/* Gira -90° para o progresso começar no topo */}
            <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
                <Circle cx={size / 2} cy={size / 2} r={r} stroke={COLORS.border} strokeWidth={stroke} fill="none" />
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    stroke={fill}
                    strokeWidth={stroke}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={offset}
                />
            </Svg>
            {showLabel ? (
                <Text style={{ fontFamily: FONTS.display, fontSize: Math.round(size * 0.25), color: COLORS.text }}>
                    {Math.round(pct)}%
                </Text>
            ) : null}
        </View>
    );
}
