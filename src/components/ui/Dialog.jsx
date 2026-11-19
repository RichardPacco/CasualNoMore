import { useEffect, useRef } from "react";
import { Animated, Modal, Pressable, StyleSheet, View } from "react-native";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS } from "@/src/theme/colors";
import AppText from "./AppText";

/**
 * Diálogo centralizado do redesign (prancheta 12): fundo escurecido, card com
 * um destaque no topo (ícone ou avatar), título, mensagem e botões.
 * Tocar fora ou o botão voltar do Android chama onClose.
 *
 * Props: visible, onClose, top (elemento no topo), title, message,
 * children (os botões; use um <View> em linha para dois botões lado a lado),
 * role ("dialog" | "alertdialog").
 */
export default function Dialog({ visible, onClose, top = null, title, message, children, role = "dialog" }) {
    const { t } = useLanguage();
    const scale = useRef(new Animated.Value(0.96)).current;

    useEffect(() => {
        if (!visible) return;
        scale.setValue(0.96);
        Animated.spring(scale, { toValue: 1, speed: 24, bounciness: 4, useNativeDriver: true }).start();
    }, [visible, scale]);

    return (
        <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t("close")} />
                <Animated.View
                    accessibilityViewIsModal
                    accessibilityRole={role === "alertdialog" ? "alert" : undefined}
                    style={[styles.card, { transform: [{ scale }] }]}
                >
                    {top}
                    {title ? <AppText variant="subtitle" style={styles.title}>{title}</AppText> : null}
                    {message ? <AppText variant="body" style={styles.message}>{message}</AppText> : null}
                    <View style={styles.actions}>{children}</View>
                </Animated.View>
            </View>
        </Modal>
    );
}

/** Círculo com ícone para o topo do diálogo, na cor do tom (`color`). */
export function DialogIcon({ children, color = COLORS.accent }) {
    return (
        <View style={[styles.iconCircle, { backgroundColor: `${color}24` }]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(3, 6, 10, 0.72)",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    card: {
        width: "100%",
        maxWidth: 420,
        borderRadius: 24,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 24,
        alignItems: "center",
        gap: 12,
    },
    title: { fontSize: 22, textAlign: "center" },
    message: { textAlign: "center", fontSize: 14, lineHeight: 21, color: COLORS.textSoft },
    actions: { alignSelf: "stretch", marginTop: 8, gap: 10 },
    iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
});
