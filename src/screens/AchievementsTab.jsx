import AchievementSheet from "@/src/components/AchievementSheet";
import AchievementTypeTag from "@/src/components/AchievementTypeTag";
import RadioSheet from "@/src/components/RadioSheet";
import { AppText, Button, Chip, ProgressBar, TextField, rarityColor } from "@/src/components/ui";
import useAchievements from "@/src/hooks/useAchievements";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";
import { achievementIconUri } from "@/src/utils/cdn";
import { formatDate } from "@/src/utils/formatDate";
import { formatPercent } from "@/src/utils/formatPercent";
import { showToast } from "@/src/utils/toast";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Keyboard, ScrollView, StyleSheet, Text, View } from "react-native";
import Pressable from "@/src/components/ui/Pressable";
import { AuthContext } from "@/src/context/AuthContext";
import { updateGameAchievements } from "@/src/database/db";

/** Gera a URI de fallback (CDN alternativa) do ícone da conquista. */
function iconFallbackUri(uri, appid) {
    if (!uri || !appid) return uri;
    const filename = uri.split("/").pop();
    return achievementIconUri(appid, filename, true);
}

/**
 * Linha de uma conquista (redesign, prancheta 07): ícone com borda na cor da
 * raridade (apagado e com cadeado se bloqueada), nome, descrição, data de
 * desbloqueio e etiqueta com o % global. Toque ou toque longo abre o painel
 * da conquista com os atalhos de guia.
 * Conquistas do RetroAchievements (têm `points`) mostram também os pontos e
 * o tipo (Progressão, Vitória, Perdível).
 */
function AchievementRowComponent({ item, game, onOpen }) {
    const { t: tr, language } = useLanguage();
    const [iconFailed, setIconFailed] = useState(false);
    const isRa = item.points !== undefined;
    // CDN alternativa só existe para os ícones da Steam
    const iconUri = iconFailed && !isRa ? iconFallbackUri(item.icon, game?.appid) : item.icon;

    const rarity = rarityColor(item.globalPercent);
    const percentText = formatPercent(item.globalPercent, language);
    const status = item.achieved
        ? (item.unlocktime ? tr("unlockedAt", { date: formatDate(item.unlocktime) }) : tr("achFilterUnlocked"))
        : item.softcoreUnlocktime ? tr("unlockedSoftcore") : tr("achLocked");

    return (
        <Pressable
            onPress={() => onOpen?.(item)}
            onLongPress={() => onOpen?.(item)}
            delayLongPress={350}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${status}, ${tr("achRarityA11y", { percent: percentText })}`}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}
        >
            <View style={[styles.iconFrame, { borderColor: rarity }]}>
                <Image
                    source={{ uri: iconUri }}
                    style={[styles.icon, !item.achieved && { opacity: 0.45 }]}
                    resizeMode="cover"
                    onError={() => setIconFailed(true)}
                />
                {!item.achieved && (
                    <View style={styles.lockBadge}>
                        <Ionicons name="lock-closed" size={11} color={COLORS.textSoft} />
                    </View>
                )}
            </View>

            <View style={styles.rowBody}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.desc} numberOfLines={2}>{item.description || tr("hiddenDescription")}</Text>
                <Text style={[styles.status, { color: item.achieved ? COLORS.accent : COLORS.textMuted }]}>
                    {status}
                </Text>
                {isRa && (item.type || item.points > 0) && (
                    <View style={styles.raMeta}>
                        {item.points > 0 && (
                            <Text style={styles.points}>{tr("points", { n: item.points })}</Text>
                        )}
                        <AchievementTypeTag type={item.type} />
                    </View>
                )}
            </View>

            <Text style={[styles.pill, { color: rarity, backgroundColor: `${rarity}1F` }]}>{percentText}</Text>
        </Pressable>
    );
}

const AchievementRow = memo(AchievementRowComponent);

/** Conquista perdível (RetroAchievements). */
const isMissable = (a) => a.type === "missable";

/**
 * Aba Conquistas (redesign, prancheta 07): progresso, busca, ordenação,
 * atualizar, chips de filtro e a lista; tocar numa conquista abre o painel
 * dela com os atalhos de guia (Google, ChatGPT).
 *
 * Steam: busca as conquistas aqui (useAchievements). RetroAchievements: a
 * GameScreen já buscou (useRaGame) e manda em `data`; aí aparecem os pontos,
 * o filtro "Perdíveis" e a ordem do autor do set.
 */
export default function AchievementsTab({ game, data = null }) {
    const { steamId } = useContext(AuthContext);
    const isRa = !!data;
    // sem `data` (Steam) busca aqui; com `data` o hook da Steam não faz nada
    const steamData = useAchievements(isRa ? null : game);
    const { mergedCheevos, loading, refresh, unlocked, total, percent } = data ?? steamData;
    const { t: tr } = useLanguage();

    // ---------- state ----------
    const [filter, setFilter] = useState("all");
    // RA: mostrar só as perdíveis; combina com o filtro de status (ex.: perdíveis bloqueadas)
    const [onlyMissable, setOnlyMissable] = useState(false);
    // RA: ordem do autor do set (DisplayOrder); Steam: raridade
    const [sort, setSort] = useState(isRa ? "default" : "rarity");
    const [sortVisible, setSortVisible] = useState(false);
    const [showTopButton, setShowTopButton] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    // conquista aberta no painel de detalhes/guia (null = fechado)
    const [selected, setSelected] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const listRef = useRef(null);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            const merged = await refresh();
            if (isRa) {
                // useRaGame já grava no banco
                if (!merged) showToast(tr("gameRefreshFailed"), "error");
            } else if (merged && steamId) {
                // Atualiza só as conquistas: a cópia do jogo recebida pela rota pode
                // estar desatualizada (ex.: pinned mudou) e não deve sobrescrever o resto.
                await updateGameAchievements(steamId, game.appid, merged);
            }
        } catch (err) {
            console.error("[AchievementsTab] refresh failed", err);
            showToast(tr("gameRefreshFailed"), "error");
        } finally {
            setRefreshing(false);
        }
    }, [refresh, isRa, steamId, game?.appid, tr]);

    // RA: chip "Perdíveis" só se o set tiver conquistas perdíveis
    const hasMissable = isRa && mergedCheevos.some(a => a.type === "missable");
    const missableOn = hasMissable && onlyMissable;

    // Filtro de status (um por vez); "Perdíveis" é um liga/desliga à parte
    const filterOptions = useMemo(() => [
        { label: tr("achFilterAll"), value: "all" },
        { label: tr("achFilterUnlocked"), value: "unlocked" },
        { label: tr("achFilterLocked"), value: "locked" },
    ], [tr]);

    const sortOptions = useMemo(() => isRa ? [
        { label: tr("achSortDefault"), value: "default" },
        { label: tr("achSortRarity"), value: "rarity" },
        { label: tr("achSortPoints"), value: "points" },
        { label: tr("achSortUnlock"), value: "unlock" },
        { label: tr("sortName"), value: "name" },
    ] : [
        { label: tr("achSortRarity"), value: "rarity" },
        { label: tr("achSortUnlock"), value: "unlock" },
        { label: tr("sortName"), value: "name" },
        { label: tr("achSortReverse"), value: "reverse" },
    ], [tr, isRa]);

    /** Regra do filtro de status. */
    const statusRule = useCallback((value) => {
        switch (value) {
            case "unlocked": return a => a.achieved;
            case "locked": return a => !a.achieved;
            default: return () => true;
        }
    }, []);

    // Contagens: as de status respeitam o "Perdíveis" ligado, e a de
    // "Perdíveis" respeita o status escolhido (sempre batem com a lista)
    const filterCounts = useMemo(() => {
        const base = missableOn ? mergedCheevos.filter(isMissable) : mergedCheevos;
        const counts = filterOptions.reduce((acc, opt) => {
            acc[opt.value] = base.filter(statusRule(opt.value)).length;
            return acc;
        }, {});
        counts.missable = mergedCheevos.filter(statusRule(filter)).filter(isMissable).length;
        return counts;
    }, [mergedCheevos, filterOptions, statusRule, filter, missableOn]);

    const filteredCheevos = useMemo(() => {
        let result = mergedCheevos.filter(statusRule(filter));
        if (missableOn) result = result.filter(isMissable);

        if (debouncedQuery && debouncedQuery.trim().length > 0) {
            const q = debouncedQuery.trim().toLowerCase();
            result = result.filter(a =>
                (a.name || "").toLowerCase().includes(q) ||
                (a.description || "").toLowerCase().includes(q)
            );
        }

        switch (sort) {
            case "rarity":
                result = [...result].sort((a, b) => b.globalPercent - a.globalPercent);
                break;
            case "unlock":
                result = [...result].sort((a, b) => (b.unlocktime || 0) - (a.unlocktime || 0));
                break;
            case "name":
                result = [...result].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
                break;
            case "reverse":
                result = [...result].reverse();
                break;
            case "points":
                result = [...result].sort((a, b) => (b.points || 0) - (a.points || 0));
                break;
            // "default": a ordem em que a lista já vem (RA: a do autor do set)
            default: break;
        }

        return result;
    }, [mergedCheevos, statusRule, filter, missableOn, sort, debouncedQuery]);

    // debounce search query
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    /** Renderiza uma linha de conquista na lista (FlashList). */
    const renderRow = useCallback(
        ({ item }) => <AchievementRow item={item} game={game} onOpen={setSelected} />,
        [game]
    );

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    if (mergedCheevos.length === 0) {
        // RA: a busca falhou e não há cache -> erro com "tentar de novo"
        const failed = isRa && data.error;
        return (
            <View style={styles.center}>
                <View style={styles.emptyIcon}>
                    <Ionicons name={failed ? "cloud-offline-outline" : "trophy-outline"} size={28} color={COLORS.accent} />
                </View>
                <AppText variant="body" style={{ textAlign: "center" }}>
                    {failed ? tr("raConnectionError") : tr("noAchievements")}
                </AppText>
                {failed && <Button label={tr("profileRetry")} onPress={onRefresh} loading={refreshing} />}
            </View>
        );
    }

    const sortLabel = sortOptions.find(o => o.value === sort)?.label ?? "";

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                {/* Progresso */}
                <View style={styles.progress}>
                    <View style={styles.progressTop}>
                        <View style={styles.progressCount}>
                            <Text style={styles.progressBig}>{unlocked}</Text>
                            <AppText variant="muted" style={{ fontSize: 14 }}>{tr("achProgressOf", { total })}</AppText>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                            <Text style={styles.progressPct}>{Math.round(percent)}%</Text>
                            {isRa && data.points > 0 && (
                                <AppText variant="muted" style={{ fontSize: 12 }}>
                                    {tr("pointsOf", { earned: data.pointsEarned, total: data.points })}
                                </AppText>
                            )}
                        </View>
                    </View>
                    <ProgressBar value={percent} height={6} />
                </View>

                {/* Busca, ordenação e atualizar */}
                <View style={styles.searchRow}>
                    <TextField
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder={tr("achSearchPlaceholder")}
                        accessibilityLabel={tr("achSearchPlaceholder")}
                        returnKeyType="search"
                        onSubmitEditing={() => Keyboard.dismiss()}
                        containerStyle={{ flex: 1 }}
                        left={<Ionicons name="search" size={18} color={COLORS.textMuted} />}
                        right={searchQuery ? (
                            <Pressable
                                onPress={() => { setSearchQuery(""); setDebouncedQuery(""); }}
                                accessibilityRole="button"
                                accessibilityLabel={tr("clearSearch")}
                                style={styles.clearButton}
                            >
                                <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
                            </Pressable>
                        ) : null}
                    />
                    <Pressable
                        onPress={() => setSortVisible(true)}
                        accessibilityRole="button"
                        accessibilityLabel={tr("sortButton", { sort: sortLabel })}
                        style={({ pressed }) => [styles.sortButton, { opacity: pressed ? 0.8 : 1 }]}
                    >
                        <Ionicons name="swap-vertical" size={16} color={COLORS.textSoft} />
                        <Text style={styles.sortLabel} numberOfLines={1}>{sortLabel}</Text>
                    </Pressable>
                    <Pressable
                        onPress={onRefresh}
                        disabled={refreshing}
                        accessibilityRole="button"
                        accessibilityLabel={tr("refreshAchievements")}
                        accessibilityState={{ busy: refreshing, disabled: refreshing }}
                        style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.8 : 1 }]}
                    >
                        {refreshing ? (
                            <ActivityIndicator size="small" color={COLORS.accent} />
                        ) : (
                            <Ionicons name="refresh" size={20} color={COLORS.accent} />
                        )}
                    </Pressable>
                </View>

                {/* Filtro: chips em linha com rolagem lateral, como na biblioteca */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chips}
                    keyboardShouldPersistTaps="handled"
                >
                    {filterOptions.map((opt, index) => (
                        <View key={opt.value} style={styles.chipGroup}>
                            <Chip
                                label={opt.label}
                                count={filterCounts[opt.value]}
                                selected={filter === opt.value}
                                onPress={() => setFilter(opt.value)}
                            />
                            {/* "Perdíveis" logo depois de "Todas", para aparecer sem rolar */}
                            {index === 0 && hasMissable && (
                                <Chip
                                    label={tr("filterMissable")}
                                    count={filterCounts.missable}
                                    selected={missableOn}
                                    onPress={() => setOnlyMissable(v => !v)}
                                    accessibilityRole="switch"
                                    accessibilityState={{ checked: missableOn }}
                                    style={!missableOn && styles.missableChip}
                                />
                            )}
                        </View>
                    ))}
                </ScrollView>
            </View>

            <FlashList
                ref={listRef}
                data={filteredCheevos}
                keyExtractor={(item) => item.apiname}
                renderItem={renderRow}
                maintainVisibleContentPosition={{ disabled: true }}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                onScroll={(e) => {
                    setShowTopButton(e.nativeEvent.contentOffset.y > 400);
                }}
                ListEmptyComponent={
                    <View style={{ paddingVertical: 40, alignItems: "center" }}>
                        <AppText variant="muted" style={{ fontSize: 15 }}>{tr("noAchievementsMatch")}</AppText>
                    </View>
                }
            />

            {showTopButton && (
                <Pressable
                    onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
                    accessibilityRole="button"
                    accessibilityLabel={tr("scrollToTop")}
                    style={({ pressed }) => [styles.topButton, { opacity: pressed ? 0.8 : 1 }]}
                >
                    <Ionicons name="chevron-up" size={22} color={COLORS.accent} />
                </Pressable>
            )}

            <RadioSheet
                visible={sortVisible}
                onClose={() => setSortVisible(false)}
                title={tr("sortTitle")}
                options={sortOptions}
                selected={sort}
                onSelect={setSort}
            />

            <AchievementSheet
                achievement={selected}
                game={game}
                onClose={() => setSelected(null)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32, backgroundColor: COLORS.bg },
    emptyIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: COLORS.accentSoft,
        alignItems: "center",
        justifyContent: "center",
    },
    header: { paddingHorizontal: 20, paddingTop: 14, gap: 12 },
    progress: { gap: 8 },
    progressTop: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    progressCount: { flexDirection: "row", alignItems: "baseline", gap: 6 },
    progressBig: { fontFamily: FONTS.display, fontSize: 34, lineHeight: 38, color: COLORS.text },
    progressPct: { fontFamily: FONTS.displaySemibold, fontSize: 18, color: COLORS.accent },
    searchRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
    clearButton: { width: 36, height: 44, marginRight: -10, alignItems: "center", justifyContent: "center" },
    sortButton: {
        height: 48,
        maxWidth: 120,
        paddingHorizontal: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        backgroundColor: COLORS.surface,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    sortLabel: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.textSoft, flexShrink: 1 },
    iconButton: {
        width: 48,
        height: 48,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        backgroundColor: COLORS.surface,
        alignItems: "center",
        justifyContent: "center",
    },
    // mesmo espaçamento dos chips da biblioteca
    chips: { gap: 8, paddingVertical: 5, paddingRight: 20 },
    chipGroup: { flexDirection: "row", gap: 8 },
    // "Perdíveis" desligado: borda vermelha, a cor da etiqueta de perdível
    missableChip: { borderColor: COLORS.danger },
    // espaço no fim para a lista não ficar atrás da tab bar flutuante
    listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 110 },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        marginBottom: 8,
        borderRadius: 16,
        backgroundColor: COLORS.surface,
    },
    iconFrame: { width: 48, height: 48, borderRadius: 12, borderWidth: 2, overflow: "hidden", backgroundColor: COLORS.surface2 },
    icon: { width: "100%", height: "100%" },
    lockBadge: {
        position: "absolute",
        right: 2,
        bottom: 2,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: "rgba(10, 14, 21, 0.85)",
        alignItems: "center",
        justifyContent: "center",
    },
    rowBody: { flex: 1, minWidth: 0, gap: 3 },
    name: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.text },
    desc: { fontFamily: FONTS.body, fontSize: 12, lineHeight: 17, color: COLORS.textMuted },
    status: { fontFamily: FONTS.bodyMedium, fontSize: 11 },
    raMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 1 },
    points: { fontFamily: FONTS.bodySemibold, fontSize: 11, color: COLORS.gold },
    pill: {
        fontFamily: FONTS.bodySemibold,
        fontSize: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        overflow: "hidden",
    },
    topButton: {
        position: "absolute",
        right: 20,
        bottom: 100,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.surface2,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: "center",
        justifyContent: "center",
        elevation: 6,
        shadowColor: "#000",
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },
});
