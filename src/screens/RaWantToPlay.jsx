import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { memo, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { getUserWantToPlayList, raMedia } from "@/src/api/retroachievements";
import AwardMedal from "@/src/components/AwardMedal";
import FilterSortSheet from "@/src/components/FilterSortSheet";
import PullToRefresh from "@/src/components/PullToRefresh";
import RadioSheet from "@/src/components/RadioSheet";
import { AppText, Button, TextField } from "@/src/components/ui";
import Pressable from "@/src/components/ui/Pressable";
import { AuthContext } from "@/src/context/AuthContext";
import { useSettings } from "@/src/context/SettingsContext";
import { ensureRaGameRow, getAllRaGames } from "@/src/database/raDb";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { raTitleFlags, toLibraryGame, toWantToPlayRow } from "@/src/platforms/ra/adapter";
import { consoleIcon } from "@/src/platforms/ra/consoleIcons";
import { loadWantToPlay, saveWantToPlay } from "@/src/platforms/ra/wantToPlay";
import { COLORS, FONTS } from "@/src/theme/colors";
import { showToast } from "@/src/utils/toast";

// Ordenações: rótulo e direção padrão ("asc" = menor/A primeiro)
const SORTS = {
    name: { label: "sortName", dir: "asc" },
    console: { label: "console", dir: "asc" },
    achievements: { label: "achievements", dir: "desc" },
    points: { label: "raPoints", dir: "desc" },
};

/** Ordena as entradas pelo tipo e direção (desempate pelo nome). */
function sortEntries(list, type, dir) {
    const sign = dir === "desc" ? -1 : 1;
    const byName = (a, b) => a.name.localeCompare(b.name);
    const value = {
        achievements: e => e.achievements,
        points: e => e.points,
    }[type];
    return [...list].sort((a, b) => {
        let diff;
        if (type === "name") diff = byName(a, b);
        else if (type === "console") diff = (a.consoleName || "").localeCompare(b.consoleName || "");
        else diff = value(a) - value(b);
        return sign * diff || byName(a, b);
    });
}

/**
 * Linha de um jogo da lista: ícone, nome, selo do console, conquistas e
 * pontos do set (a lista é de jogos que ainda não foram jogados, então sem
 * barra de progresso).
 */
const WtpRow = memo(function WtpRow({ entry, onOpen }) {
    const { t: tr } = useLanguage();
    const icon = consoleIcon(entry.consoleId);
    return (
        <Pressable
            onPress={() => onOpen(entry)}
            accessibilityRole="button"
            accessibilityLabel={[
                entry.name,
                entry.consoleName,
                tr("wtpAchievements", { n: entry.achievements }),
                tr("points", { n: entry.points }),
            ].join(", ")}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}
        >
            <Image source={{ uri: raMedia(entry.imageIcon) }} style={styles.icon} />
            <View style={styles.body}>
                <View style={styles.titleRow}>
                    <Text style={styles.name} numberOfLines={1}>{entry.name}</Text>
                    {entry.award && <AwardMedal award={entry.award} size={20} />}
                </View>
                <View style={styles.metaRow}>
                    <View style={styles.consoleBadge}>
                        {icon && <Image source={icon} style={styles.consoleIcon} resizeMode="contain" />}
                        <Text style={styles.consoleText} numberOfLines={1}>{entry.consoleName}</Text>
                    </View>
                    <Text style={styles.meta} numberOfLines={1}>
                        {tr("wtpAchievements", { n: entry.achievements.toLocaleString() })}
                    </Text>
                </View>
                <Text style={[styles.meta, styles.points]} numberOfLines={1}>
                    {tr("points", { n: entry.points.toLocaleString() })}
                </Text>
            </View>
        </Pressable>
    );
});

/**
 * Lista "Quero jogar" do RetroAchievements (tela própria, aberta pela
 * biblioteca do RA), no espírito da página do site adaptada ao celular:
 * busca, ordenação (tipo + direção), filtros (console, só com conquistas,
 * hacks/subsets), contagem "X de Y jogos" e "Me surpreenda".
 *
 * A lista vem salva da sincronização da biblioteca (uma chamada só) e é
 * atualizada ao puxar para baixo. É uma lista de jogos ainda não jogados,
 * então não mostra progresso (só a medalha, no caso raro de um jogo dela já
 * estar masterizado ou zerado). A API da lista não traz RetroPoints,
 * RetroRatio nem data de lançamento.
 */
export default function RaWantToPlay({ navigation }) {
    const { t: tr } = useLanguage();
    const { accounts } = useContext(AuthContext);
    const { settings, updateSettings } = useSettings();
    const ulid = accounts.ra?.ulid ?? null;

    const [items, setItems] = useState(null);          // lista da API (null = carregando)
    const [rows, setRows] = useState(() => new Map());  // gameId -> linha da biblioteca
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(false);
    const [query, setQuery] = useState("");

    const [sort, setSortType] = useState("name");
    const [sortDir, setSortDir] = useState(SORTS.name.dir);
    const [sortVisible, setSortVisible] = useState(false);
    const [consoleFilter, setConsoleFilter] = useState(null);
    const [onlyWithAch, setOnlyWithAch] = useState(true);
    const [filterVisible, setFilterVisible] = useState(false);

    /** Troca o tipo de ordenação e volta a direção para a padrão dele. */
    const setSort = useCallback((type) => {
        setSortType(type);
        setSortDir(SORTS[type]?.dir ?? "asc");
    }, []);

    /** Relê a biblioteca do banco (o que já foi jogado e as medalhas). */
    const loadRows = useCallback(async () => {
        if (!ulid) return;
        const all = await getAllRaGames(ulid);
        setRows(new Map(all.map(r => [r.gameId, r])));
    }, [ulid]);

    /** Busca a lista no RA e grava. `manual` (puxar para atualizar): avisa se falhar. */
    const fetchList = useCallback(async (manual = false) => {
        if (!ulid) return;
        try {
            const { results } = await getUserWantToPlayList(ulid);
            setItems(results);
            setError(false);
            await saveWantToPlay(ulid, results);
        } catch (err) {
            console.warn("[RaWantToPlay] falhou", err?.message);
            setError(true);
            // com uma lista já na tela, o aviso de erro da lista vazia não aparece
            if (manual) showToast(tr("raConnectionError"), "error");
            setItems(prev => prev ?? []);
        }
    }, [ulid, tr]);

    // Ao abrir: lista salva e biblioteca do banco; sem lista salva, busca
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [saved] = await Promise.all([loadWantToPlay(ulid), loadRows()]);
            if (cancelled) return;
            if (saved.length > 0) setItems(saved);
            else await fetchList();
        })();
        return () => { cancelled = true; };
    }, [ulid, loadRows, fetchList]);

    // Ao voltar da tela do jogo, o progresso pode ter mudado
    useEffect(() => navigation.addListener("focus", loadRows), [navigation, loadRows]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await Promise.all([fetchList(true), loadRows()]);
        } finally {
            setRefreshing(false);
        }
    }, [fetchList, loadRows]);

    // Cada item da lista; se já estiver na biblioteca, a medalha dele
    const entries = useMemo(() => (items ?? []).map(i => {
        const id = Number(i.ID);
        const row = rows.get(id);
        const achievements = Number(i.AchievementsPublished) || 0;
        // Na biblioteca de verdade = linha com algum progresso. Só existir a
        // linha não basta: abrir um jogo nunca jogado cria uma linha
        // temporária, que fica no banco até a próxima sincronização.
        const inLibrary = !!row && (
            (row.numAwarded || 0) > 0 || (row.numAwardedHardcore || 0) > 0
            || !!row.mostRecentAwardedDate || !!row.highestAwardKind
        );
        const lib = inLibrary ? toLibraryGame(row) : null;
        return {
            key: `ra:${id}`,
            id,
            name: i.Title || "",
            imageIcon: i.ImageIcon,
            consoleId: Number(i.ConsoleID) || null,
            consoleName: i.ConsoleName || "",
            achievements,
            points: Number(i.PointsTotal) || 0,
            award: lib?.award ?? null,
            flags: raTitleFlags(i.Title),
            source: i,
            inLibrary,
        };
    }), [items, rows]);

    // Base dos filtros: hacks/subsets (preferências) e "só com conquistas"
    const base = useMemo(() => entries.filter(e =>
        !(settings.hideHacks && e.flags.hack)
        && !(settings.hideSubsets && e.flags.subset)
        && (!onlyWithAch || e.achievements > 0)
    ), [entries, settings.hideHacks, settings.hideSubsets, onlyWithAch]);

    const consoleOptions = useMemo(() => {
        const byId = new Map();
        for (const e of base) {
            if (!e.consoleId) continue;
            const entry = byId.get(e.consoleId) ?? { value: e.consoleId, label: e.consoleName, count: 0 };
            entry.count++;
            byId.set(e.consoleId, entry);
        }
        return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
    }, [base]);

    /** Quantos jogos aparecem com o console escolhido (para o botão do painel). */
    const countFilters = useCallback((consoleId) => ({
        all: consoleId == null ? base.length : base.filter(e => e.consoleId === consoleId).length,
    }), [base]);

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        const list = base
            .filter(e => consoleFilter == null || e.consoleId === consoleFilter)
            .filter(e => !q || e.name.toLowerCase().includes(q));
        return sortEntries(list, sort, sortDir);
    }, [base, consoleFilter, query, sort, sortDir]);

    /** Abre o jogo (criando a linha no banco se nunca foi jogado). */
    const openGame = useCallback(async (entry) => {
        if (!entry.inLibrary && ulid) await ensureRaGameRow(ulid, toWantToPlayRow(entry.source));
        // notInLibrary: jogo nunca jogado (sem alfinete, a linha é temporária)
        navigation.navigate("GameScreen", { platform: "ra", id: entry.id, notInLibrary: !entry.inLibrary });
    }, [navigation, ulid]);

    /** "Me surpreenda": abre um jogo sorteado da lista filtrada. */
    const surprise = useCallback(() => {
        if (shown.length === 0) return;
        openGame(shown[Math.floor(Math.random() * shown.length)]);
    }, [shown, openGame]);

    const renderItem = useCallback(({ item }) => <WtpRow entry={item} onOpen={openGame} />, [openGame]);

    const sortOptions = useMemo(
        () => Object.keys(SORTS).map(type => ({ value: type, label: tr(SORTS[type].label) })),
        [tr]
    );
    const dirOptions = useMemo(() => [
        { value: "asc", label: tr("dirAsc"), icon: "arrow-up" },
        { value: "desc", label: tr("dirDesc"), icon: "arrow-down" },
    ], [tr]);
    const sortLabel = tr(SORTS[sort].label);
    const filtersActive = consoleFilter != null || !onlyWithAch;

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <Pressable
                        onPress={() => navigation.goBack()}
                        accessibilityRole="button"
                        accessibilityLabel={tr("back")}
                        style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.8 : 1 }]}
                    >
                        <Ionicons name="chevron-back" size={22} color={COLORS.text} />
                    </Pressable>
                    <AppText variant="title" style={{ flex: 1, fontSize: 26 }}>{tr("wantToPlay")}</AppText>
                </View>

                <View style={styles.searchRow}>
                    <TextField
                        value={query}
                        onChangeText={setQuery}
                        placeholder={tr("searchGamesPlaceholder")}
                        accessibilityLabel={tr("searchGamesPlaceholder")}
                        returnKeyType="search"
                        containerStyle={{ flex: 1 }}
                        left={<Ionicons name="search" size={18} color={COLORS.textMuted} />}
                    />
                    <Pressable
                        onPress={() => setSortVisible(true)}
                        accessibilityRole="button"
                        accessibilityLabel={tr("sortButton", { sort: `${sortLabel}, ${tr(sortDir === "asc" ? "dirAsc" : "dirDesc")}` })}
                        style={({ pressed }) => [styles.iconButton48, { opacity: pressed ? 0.8 : 1 }]}
                    >
                        <Ionicons name={sortDir === "asc" ? "arrow-up" : "arrow-down"} size={20} color={COLORS.textSoft} />
                    </Pressable>
                    <Pressable
                        onPress={() => setFilterVisible(true)}
                        accessibilityRole="button"
                        accessibilityLabel={tr("moreFilters")}
                        style={({ pressed }) => [styles.iconButton48, { opacity: pressed ? 0.8 : 1 }]}
                    >
                        <Ionicons name="options-outline" size={20} color={COLORS.textSoft} />
                        {filtersActive && <View style={styles.dot} />}
                    </Pressable>
                </View>

                <View style={styles.countRow}>
                    <AppText variant="muted" style={{ flex: 1 }}>
                        {items ? tr("wtpCountOf", { shown: shown.length.toLocaleString(), total: entries.length.toLocaleString() }) : ""}
                    </AppText>
                    <Pressable
                        onPress={surprise}
                        disabled={shown.length === 0}
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.surprise, { opacity: shown.length === 0 ? 0.4 : pressed ? 0.8 : 1 }]}
                    >
                        <Ionicons name="shuffle" size={16} color={COLORS.gold} />
                        <Text style={styles.surpriseText}>{tr("surpriseMe")}</Text>
                    </Pressable>
                </View>
            </View>

            {items === null ? (
                <ActivityIndicator size="large" color={COLORS.accent} style={{ marginTop: 40 }} />
            ) : (
                <PullToRefresh refreshing={refreshing} onRefresh={onRefresh}>
                    <FlashList
                        data={shown}
                        keyExtractor={(e) => e.key}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        keyboardShouldPersistTaps="handled"
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <AppText variant="muted" style={{ textAlign: "center", fontSize: 15 }}>
                                    {error ? tr("raConnectionError") : entries.length === 0 ? tr("wantToPlayEmpty") : tr("noGamesTitle")}
                                </AppText>
                                {error && <Button label={tr("profileRetry")} onPress={onRefresh} loading={refreshing} />}
                            </View>
                        }
                    />
                </PullToRefresh>
            )}

            <RadioSheet
                visible={sortVisible}
                onClose={() => setSortVisible(false)}
                title={tr("sortTitle")}
                optionsTitle={tr("sortByTitle")}
                options={sortOptions}
                selected={sort}
                onSelect={setSort}
                secondary={{ title: tr("sortDirectionTitle"), options: dirOptions, selected: sortDir, onSelect: setSortDir }}
            />

            <FilterSortSheet
                visible={filterVisible}
                onClose={() => setFilterVisible(false)}
                filterOptions={[]}
                counts={countFilters(consoleFilter)}
                computeCounts={countFilters}
                filter="all"
                defaultFilter="all"
                sortOptions={[]}
                sort={null}
                consoleOptions={consoleOptions}
                consoleValue={consoleFilter}
                toggles={[
                    { key: "onlyWithAch", label: tr("wtpOnlyWithAch"), value: onlyWithAch, onChange: setOnlyWithAch },
                    { key: "hideHacks", label: tr("hideHacks"), value: settings.hideHacks, onChange: v => updateSettings({ hideHacks: v }) },
                    { key: "hideSubsets", label: tr("hideSubsets"), value: settings.hideSubsets, onChange: v => updateSettings({ hideSubsets: v }) },
                ]}
                onApply={({ console: c }) => setConsoleFilter(c ?? null)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.bg },
    header: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
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
    searchRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
    iconButton48: {
        width: 48,
        height: 48,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        backgroundColor: COLORS.surface,
        alignItems: "center",
        justifyContent: "center",
    },
    dot: {
        position: "absolute",
        top: 9,
        right: 9,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.gold,
        borderWidth: 1,
        borderColor: COLORS.surface,
    },
    countRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    surprise: {
        minHeight: 40,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    surpriseText: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.gold },
    // espaço no fim para a lista não ficar atrás da tab bar flutuante
    listContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 110 },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 10,
        marginBottom: 8,
        borderRadius: 16,
        backgroundColor: COLORS.surface,
    },
    icon: { width: 56, height: 56, borderRadius: 10, backgroundColor: COLORS.surface2 },
    body: { flex: 1, minWidth: 0, gap: 4 },
    name: { flex: 1, fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.text },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    consoleBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        backgroundColor: COLORS.surface2,
        maxWidth: "45%",
    },
    consoleIcon: { width: 14, height: 14 },
    consoleText: { flexShrink: 1, fontFamily: FONTS.bodyMedium, fontSize: 11, color: COLORS.textSoft },
    meta: { flexShrink: 1, fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted },
    points: { color: COLORS.gold },
    empty: { alignItems: "center", paddingVertical: 48, gap: 12 },
});
