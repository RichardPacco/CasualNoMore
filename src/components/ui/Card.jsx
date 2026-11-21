import { View } from "react-native";
import { COLORS } from "@/src/theme/colors";

/**
 * Superfície do redesign. `variant`:
 * - "card": cantos 20, com borda discreta (blocos de conteúdo)
 * - "row": cantos 16, sem borda (linhas de lista)
 * `padding` padrão 16 (card) / 10 (row).
 */
export default function Card({ variant = "card", padding, style, children, ...rest }) {
    const isRow = variant === "row";
    return (
        <View
            style={[
                {
                    backgroundColor: COLORS.surface,
                    borderRadius: isRow ? 16 : 20,
                    borderWidth: isRow ? 0 : 1,
                    borderColor: COLORS.borderSubtle,
                    padding: padding ?? (isRow ? 10 : 16),
                },
                style,
            ]}
            {...rest}
        >
            {children}
        </View>
    );
}
