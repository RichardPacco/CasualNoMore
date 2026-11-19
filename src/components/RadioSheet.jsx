import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/src/components/ui";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";
import { setOverlayOpen } from "@/src/utils/overlayBar";

const HIDDEN_OFFSET = 420; // deslocamento do painel fechado (fora da tela)

/**
 * Painel inferior de escolha única (redesign): título, botão fechar e uma
 * opção por linha com marcador de rádio e contagem opcional. Escolher uma
 * opção aplica e fecha. O botão voltar do Android fecha o painel.
 * Props: visible, onClose, title, options [{label,value}], selected, onSelect, counts.
 */
export default function RadioSheet({ visible, onClose, title, options, selected, onSelect, counts }) {
    const { t } = useLanguage();
    const insets = useSafeAreaInsets();
    const anim = useRef(new Animated.Value(HIDDEN_OFFSET)).current;
    const closingRef = useRef(false);

    // Esconde a tab bar enquanto o painel está aberto
    useEffect(() => {
        setOverlayOpen(visible);
        return () => setOverlayOpen(false);
    }, [visible]);

    useEffect(() => {
        if (visible) {
            closingRef.current = false;
            anim.setValue(HIDDEN_OFFSET);
            Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
        }
    }, [visible, anim]);

    /** Fecha o painel com animação de saída e chama onClose ao terminar. */
    const close = () => {
        if (closingRef.current) return;
        closingRef.current = true;
        Animated.timing(anim, { toValue: HIDDEN_OFFSET, duration: 200, useNativeDriver: true }).start(() => {
            closingRef.current = false;
            onClose();
        });
    };

    // Botão voltar do Android fecha o painel em vez de sair da tela
    useEffect(() => {
        if (!visible) return;
        const sub = BackHandler.addEventListener("hardwareBackPress", () => {
            close();
            return true;
        });
        return () => sub.remove();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- close usa refs
    }, [visible]);

    if (!visible) return null;

    return (
        <>
            <Pressable style={styles.backdrop} onPress={close} accessibilityLabel={t("close")} />
            <Animated.View
                accessibilityViewIsModal
                style={[styles.sheet, { paddingBottom: 20 + insets.bottom, transform: [{ translateY: anim }] }]}
            >
                <View style={styles.handle} />
                <View style={styles.header}>
                    <AppText variant="subtitle" style={{ fontSize: 22 }}>{title}</AppText>
                    <Pressable
                        onPress={close}
                        accessibilityRole="button"
                        accessibilityLabel={t("close")}
                        style={styles.closeButton}
                    >
                        <Ionicons name="close" size={20} color={COLORS.textSoft} />
                    </Pressable>
                </View>

                <View accessibilityRole="radiogroup">
                    {options.map((opt) => {
                        const on = selected === opt.value;
                        return (
                            <Pressable
                                key={opt.value}
                                onPress={() => {
                                    onSelect(opt.value);
                                    close();
                                }}
                                accessibilityRole="radio"
                                accessibilityState={{ checked: on }}
                                style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
                            >
                                <View style={[styles.radio, { borderColor: on ? COLORS.accent : COLORS.border }]}>
                                    {on && <View style={styles.radioDot} />}
                                </View>
                                <Text style={[styles.label, on && { fontFamily: FONTS.bodySemibold }]} numberOfLines={1}>
                                    {opt.label}
                                </Text>
                                {counts && (
                                    <Text style={[styles.count, { color: on ? COLORS.accent : COLORS.textMuted }]}>
                                        {counts[opt.value]}
                                    </Text>
                                )}
                            </Pressable>
                        );
                    })}
                </View>
            </Animated.View>
        </>
    );
}

const styles = StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(3, 6, 10, 0.72)", zIndex: 100 },
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
        gap: 12,
        zIndex: 101,
        elevation: 12,
    },
    handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#364256" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    closeButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.surface2,
        alignItems: "center",
        justifyContent: "center",
    },
    row: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12 },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.accent },
    label: { flex: 1, fontFamily: FONTS.body, fontSize: 16, color: COLORS.text },
    count: { fontFamily: FONTS.bodySemibold, fontSize: 13, minWidth: 28, textAlign: "right" },
});
