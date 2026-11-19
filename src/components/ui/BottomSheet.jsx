import { Ionicons } from "@expo/vector-icons";
import { useEffect, useImperativeHandle, useRef } from "react";
import { Animated, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS } from "@/src/theme/colors";
import AppText from "./AppText";

const HIDDEN_OFFSET = 700; // deslocamento do painel fechado (fora da tela)

/**
 * Painel inferior base do redesign, num Modal: cobre a tela inteira (inclusive
 * capas e a tab bar), fundo escurecido, entrada e saída deslizando, alça,
 * título opcional com botão fechar. O botão voltar do Android fecha.
 *
 * Props: visible, onClose, title (opcional), children, maxHeight ("88%").
 * `ref.close()` fecha com animação (útil depois de uma ação dentro do painel).
 */
export default function BottomSheet({ ref, visible, onClose, title, maxHeight = "88%", children }) {
    const { t } = useLanguage();
    const insets = useSafeAreaInsets();
    const anim = useRef(new Animated.Value(HIDDEN_OFFSET)).current;
    const backdrop = useRef(new Animated.Value(0)).current;
    const closingRef = useRef(false);

    useEffect(() => {
        if (!visible) return;
        closingRef.current = false;
        anim.setValue(HIDDEN_OFFSET);
        backdrop.setValue(0);
        Animated.parallel([
            Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }),
            Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();
    }, [visible, anim, backdrop]);

    /** Fecha com animação de saída e chama onClose ao terminar. */
    const close = () => {
        if (closingRef.current) return;
        closingRef.current = true;
        Animated.parallel([
            Animated.timing(anim, { toValue: HIDDEN_OFFSET, duration: 200, useNativeDriver: true }),
            Animated.timing(backdrop, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => {
            closingRef.current = false;
            onClose();
        });
    };

    useImperativeHandle(ref, () => ({ close }));

    return (
        <Modal transparent visible={visible} animationType="none" statusBarTranslucent onRequestClose={close}>
            <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={t("close")} />
            </Animated.View>
            <Animated.View
                accessibilityViewIsModal
                style={[
                    styles.sheet,
                    { maxHeight, paddingBottom: 24 + insets.bottom, transform: [{ translateY: anim }] },
                ]}
            >
                <View style={styles.handle} />
                {title ? (
                    <View style={styles.header}>
                        <AppText variant="subtitle" style={{ flex: 1, fontSize: 22 }} numberOfLines={1}>{title}</AppText>
                        <Pressable
                            onPress={close}
                            accessibilityRole="button"
                            accessibilityLabel={t("close")}
                            style={styles.closeButton}
                        >
                            <Ionicons name="close" size={20} color={COLORS.textSoft} />
                        </Pressable>
                    </View>
                ) : null}
                {children}
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(3, 6, 10, 0.72)" },
    sheet: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderTopWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 20,
        paddingTop: 10,
        gap: 18,
        elevation: 12,
    },
    handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#364256" },
    header: { flexDirection: "row", alignItems: "center", gap: 12 },
    closeButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.surface2,
        alignItems: "center",
        justifyContent: "center",
    },
});
