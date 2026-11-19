import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText, Button } from "@/src/components/ui";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";
import { setOverlayOpen } from "@/src/utils/overlayBar";

const HIDDEN_OFFSET = 700; // deslocamento do painel fechado (fora da tela)

/**
 * Painel "Filtrar e ordenar" (redesign, prancheta 05): junta o filtro e a
 * ordenação num só painel inferior. As escolhas ficam num rascunho e só valem
 * ao tocar em "Ver N jogos"; "Limpar" volta para os padrões.
 *
 * Props: visible, onClose, filterOptions [{label,value}], counts {value: n},
 * filter, sortOptions [{label,value}], sort, onApply({ filter, sort }),
 * defaultFilter, defaultSort.
 */
export default function FilterSortSheet({
    visible,
    onClose,
    filterOptions,
    counts = {},
    filter,
    sortOptions,
    sort,
    onApply,
    defaultFilter = "all",
    defaultSort = "recentPlaytime",
}) {
    const { t } = useLanguage();
    const insets = useSafeAreaInsets();
    const anim = useRef(new Animated.Value(HIDDEN_OFFSET)).current;
    const closingRef = useRef(false);

    const [draftFilter, setDraftFilter] = useState(filter);
    const [draftSort, setDraftSort] = useState(sort);

    // Esconde a tab bar enquanto o painel está aberto
    useEffect(() => {
        setOverlayOpen(visible);
        return () => setOverlayOpen(false);
    }, [visible]);

    // Ao abrir: rascunho = valores atuais, e anima a entrada
    useEffect(() => {
        if (!visible) return;
        setDraftFilter(filter);
        setDraftSort(sort);
        closingRef.current = false;
        anim.setValue(HIDDEN_OFFSET);
        Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir
    }, [visible]);

    /** Fecha com animação de saída e chama onClose ao terminar. */
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

    const apply = () => {
        onApply({ filter: draftFilter, sort: draftSort });
        close();
    };

    const reset = () => {
        setDraftFilter(defaultFilter);
        setDraftSort(defaultSort);
    };

    const resultCount = counts[draftFilter] ?? 0;

    return (
        <>
            <Pressable style={styles.backdrop} onPress={close} accessibilityLabel={t("close")} />
            <Animated.View
                accessibilityViewIsModal
                style={[styles.sheet, { paddingBottom: 24 + insets.bottom, transform: [{ translateY: anim }] }]}
            >
                <View style={styles.handle} />

                <View style={styles.header}>
                    <AppText variant="subtitle" style={{ fontSize: 22 }}>{t("filterSortTitle")}</AppText>
                    <Pressable
                        onPress={close}
                        accessibilityRole="button"
                        accessibilityLabel={t("close")}
                        style={styles.closeButton}
                    >
                        <Ionicons name="close" size={20} color={COLORS.textSoft} />
                    </Pressable>
                </View>

                <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 18 }} showsVerticalScrollIndicator={false}>
                    <View style={styles.section}>
                        <AppText variant="label">{t("filterShowLabel")}</AppText>
                        <View style={styles.grid}>
                            {filterOptions.map(opt => {
                                const on = draftFilter === opt.value;
                                return (
                                    <Pressable
                                        key={opt.value}
                                        onPress={() => setDraftFilter(opt.value)}
                                        accessibilityRole="radio"
                                        accessibilityState={{ checked: on }}
                                        style={({ pressed }) => [
                                            styles.option,
                                            on ? styles.optionOn : styles.optionOff,
                                            { opacity: pressed ? 0.8 : 1 },
                                        ]}
                                    >
                                        <Text style={styles.optionLabel} numberOfLines={1}>{opt.label}</Text>
                                        <Text style={[styles.optionCount, { color: on ? COLORS.accent : COLORS.textMuted }]}>
                                            {counts[opt.value] ?? 0}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <AppText variant="label">{t("sortTitle")}</AppText>
                        <View accessibilityRole="radiogroup" style={styles.segment}>
                            {sortOptions.map(opt => {
                                const on = draftSort === opt.value;
                                return (
                                    <Pressable
                                        key={opt.value}
                                        onPress={() => setDraftSort(opt.value)}
                                        accessibilityRole="radio"
                                        accessibilityState={{ checked: on }}
                                        style={[styles.segmentItem, on && styles.segmentItemOn]}
                                    >
                                        <Text style={[styles.segmentLabel, { color: on ? COLORS.text : COLORS.textSoft }]} numberOfLines={1}>
                                            {opt.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <Button label={t("clear")} variant="secondary" onPress={reset} style={{ flex: 1 }} />
                    <Button label={t("filterApplyCount", { count: resultCount })} onPress={apply} style={{ flex: 1 }} />
                </View>
            </Animated.View>
        </>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(3, 6, 10, 0.72)",
        zIndex: 100,
    },
    sheet: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: "88%",
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderTopWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 20,
        paddingTop: 10,
        gap: 18,
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
    section: { gap: 10 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    option: {
        width: "48.8%",
        minHeight: 48,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
    },
    optionOn: { backgroundColor: COLORS.accentSoft, borderColor: COLORS.accent },
    optionOff: { backgroundColor: COLORS.bg, borderColor: COLORS.border },
    optionLabel: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.text },
    optionCount: { fontFamily: FONTS.bodySemibold, fontSize: 12 },
    segment: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 4,
        padding: 4,
        borderRadius: 14,
        backgroundColor: COLORS.bg,
    },
    segmentItem: {
        width: "49.2%",
        height: 40,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 6,
    },
    segmentItemOn: { backgroundColor: COLORS.border },
    segmentLabel: { fontFamily: FONTS.bodySemibold, fontSize: 13 },
    footer: { flexDirection: "row", gap: 10 },
});
