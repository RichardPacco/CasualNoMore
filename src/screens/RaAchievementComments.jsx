import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { getComments, raBadge, raUserPic } from "@/src/api/retroachievements";
import PullToRefresh from "@/src/components/PullToRefresh";
import { AppText, Button } from "@/src/components/ui";
import Pressable from "@/src/components/ui/Pressable";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";
import { formatDateTime } from "@/src/utils/formatDate";
import { parseRaDate } from "@/src/utils/raDate";

// Comentários por página
const PAGE_SIZE = 10;

// O RA registra as edições da conquista como comentários automáticos deste
// usuário; ficam de fora (a tela mostra só o que os jogadores escreveram).
const SYSTEM_USER = "server";

/** Um comentário: avatar, autor, data e texto. */
const CommentRow = memo(function CommentRow({ item }) {
    const ms = parseRaDate(item.Submitted);
    return (
        <View style={styles.row}>
            <Image source={{ uri: raUserPic(item.User) }} style={styles.avatar} />
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <View style={styles.rowTop}>
                    <Text style={styles.user} numberOfLines={1}>{item.User}</Text>
                    {ms ? <Text style={styles.date}>{formatDateTime(ms / 1000)}</Text> : null}
                </View>
                <Text style={styles.text}>{item.CommentText}</Text>
            </View>
        </View>
    );
});

/**
 * Comentários dos jogadores numa conquista do RetroAchievements
 * (GetComments, tipo 2), mais novos primeiro, em páginas de 10 com
 * anterior/próxima. Os comentários automáticos do "Server" (edições da
 * conquista) ficam de fora. Puxar para baixo atualiza.
 * A paginação é feita aqui, depois de tirar os do "Server": a API pagina
 * junto com eles, e as páginas viriam com menos de 10.
 * Rota: { achievementId, title, badgeName }.
 */
export default function RaAchievementComments({ route, navigation }) {
    const { achievementId, title, badgeName } = route.params;
    const { t: tr } = useLanguage();
    const [comments, setComments] = useState(null);
    const [error, setError] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(0);
    const listRef = useRef(null);

    const load = useCallback(async () => {
        try {
            const all = await getComments(achievementId, 2);
            setComments(all.filter(c => (c.User || "").toLowerCase() !== SYSTEM_USER));
            setPage(0);
            setError(false);
        } catch (err) {
            console.warn("[RaComments] falhou", err?.message);
            setError(true);
        }
    }, [achievementId]);

    useEffect(() => { load(); }, [load]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try { await load(); } finally { setRefreshing(false); }
    }, [load]);

    const total = comments?.length ?? 0;
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const shown = useMemo(
        () => (comments || []).slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
        [comments, page]
    );

    /** Vai para outra página e volta ao topo da lista. */
    const goTo = (next) => {
        setPage(Math.min(pageCount - 1, Math.max(0, next)));
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
    };

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <Pressable
                    onPress={() => navigation.goBack()}
                    accessibilityRole="button"
                    accessibilityLabel={tr("back")}
                    style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.8 : 1 }]}
                >
                    <Ionicons name="chevron-back" size={22} color={COLORS.text} />
                </Pressable>
                {badgeName && <Image source={{ uri: raBadge(badgeName) }} style={styles.badge} />}
                <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="subtitle" style={{ fontSize: 20 }} numberOfLines={2}>{title}</AppText>
                    {comments && <AppText variant="muted">{tr("raCommentsCount", { count: total })}</AppText>}
                </View>
            </View>

            {!comments && !error ? (
                <ActivityIndicator size="large" color={COLORS.accent} style={{ marginTop: 40 }} />
            ) : (
                <PullToRefresh refreshing={refreshing} onRefresh={onRefresh}>
                    <FlashList
                        ref={listRef}
                        data={shown}
                        keyExtractor={(item, index) => `${page}-${index}-${item.Submitted}`}
                        renderItem={({ item }) => <CommentRow item={item} />}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <AppText variant="muted" style={{ textAlign: "center", fontSize: 15 }}>
                                    {error ? tr("raConnectionError") : tr("raNoComments")}
                                </AppText>
                                {error && <Button label={tr("profileRetry")} onPress={onRefresh} loading={refreshing} />}
                            </View>
                        }
                        ListFooterComponent={
                            pageCount > 1 ? (
                                    <View style={styles.pager}>
                                        <Pressable
                                            onPress={() => goTo(page - 1)}
                                            disabled={page === 0}
                                            accessibilityRole="button"
                                            accessibilityLabel={tr("previousPage")}
                                            style={({ pressed }) => [styles.pageButton, { opacity: page === 0 ? 0.35 : pressed ? 0.8 : 1 }]}
                                        >
                                            <Ionicons name="chevron-back" size={20} color={COLORS.text} />
                                        </Pressable>
                                        <Text style={styles.pageText}>{tr("pageOf", { page: page + 1, total: pageCount })}</Text>
                                        <Pressable
                                            onPress={() => goTo(page + 1)}
                                            disabled={page >= pageCount - 1}
                                            accessibilityRole="button"
                                            accessibilityLabel={tr("nextPage")}
                                            style={({ pressed }) => [styles.pageButton, { opacity: page >= pageCount - 1 ? 0.35 : pressed ? 0.8 : 1 }]}
                                        >
                                            <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
                                        </Pressable>
                                    </View>
                            ) : null
                        }
                    />
                </PullToRefresh>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.bg },
    header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 16 },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        backgroundColor: COLORS.surface,
        alignItems: "center",
        justifyContent: "center",
    },
    badge: { width: 44, height: 44, borderRadius: 10, backgroundColor: COLORS.surface2 },
    // espaço no fim para a lista não ficar atrás da tab bar flutuante
    listContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 110 },
    row: { flexDirection: "row", gap: 12, padding: 12, marginBottom: 8, borderRadius: 16, backgroundColor: COLORS.surface },
    avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surface2 },
    rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
    user: { flexShrink: 1, fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.text },
    date: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted },
    text: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 20, color: COLORS.textSoft },
    empty: { alignItems: "center", paddingVertical: 48, gap: 12 },
    pager: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 4 },
    pageButton: {
        width: 44,
        height: 44,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        backgroundColor: COLORS.surface,
        alignItems: "center",
        justifyContent: "center",
    },
    pageText: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.textSoft, minWidth: 110, textAlign: "center" },
});
