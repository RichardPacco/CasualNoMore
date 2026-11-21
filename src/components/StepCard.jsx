import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { COLORS, FONTS } from "@/src/theme/colors";

/**
 * Card de um passo do login. `state`:
 * - "active": passo atual (borda azul, número em azul)
 * - "done": concluído (número vira check verde)
 * - "locked": ainda não liberado (apagado)
 */
export default function StepCard({ number, title, state, children }) {
    const active = state === "active";
    const done = state === "done";
    return (
        <View
            style={[
                styles.stepCard,
                { borderColor: active ? COLORS.accent : COLORS.borderSubtle, opacity: state === "locked" ? 0.6 : 1 },
            ]}
        >
            <View style={styles.stepHeader}>
                <View
                    style={[
                        styles.stepBadge,
                        { backgroundColor: active ? COLORS.accent : done ? "rgba(74, 222, 128, 0.16)" : COLORS.border },
                    ]}
                >
                    {done ? (
                        <Ionicons name="checkmark" size={16} color={COLORS.success} />
                    ) : (
                        <Text style={[styles.stepNumber, { color: active ? COLORS.onAccent : COLORS.textSoft }]}>
                            {number}
                        </Text>
                    )}
                </View>
                <Text style={styles.stepTitle} numberOfLines={1}>{title}</Text>
            </View>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    stepCard: {
        padding: 16,
        borderRadius: 20,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        gap: 12,
    },
    stepHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    stepBadge: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    stepNumber: { fontFamily: FONTS.bodySemibold, fontSize: 14 },
    stepTitle: { flex: 1, fontFamily: FONTS.bodySemibold, fontSize: 16, color: COLORS.text },
});
