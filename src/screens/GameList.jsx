import GameCard from "@/src/components/GameCard";
import { AppText, Button, Chip, ProgressBar, TextField } from "@/src/components/ui";
import PullToRefresh from "@/src/components/PullToRefresh";
import FilterSortSheet from "@/src/components/FilterSortSheet";
import PlatformPicker from "@/src/components/PlatformPicker";
import { RA_SITE_URL } from "@/src/api/retroachievements";
import { useSettings } from "@/src/context/SettingsContext";
import useLibrary from "@/src/hooks/useLibrary";
import { getPlatform } from "@/src/platforms";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Pressable from "@/src/components/ui/Pressable";

// Configurações de privacidade do perfil na Steam (para deixar os jogos públicos)
const STEAM_PRIVACY_URL = "https://steamcommunity.com/my/edit/settings";

// Modos de exibição da biblioteca (salvos no aparelho com esta chave)
const VIEW_MODE_KEY = "@library_view_mode";
const VIEW_MODES = ["compact", "card", "grid"];
const VIEW_MODE_OPTIONS = [
    { value: "compact", icon: "list", label: "viewCompact" },
    { value: "card", icon: "albums-outline", label: "viewCards" },
    { value: "grid", icon: "grid-outline", label: "viewGrid" },
];

/** Jogo tem conquistas e todas foram desbloqueadas. */
function isCompleted(g) {
    return g.total > 0 && g.unlocked === g.total;
}

/**
 * Definição única de cada filtro da lista (valor -> regra). Usada tanto para
 * filtrar quanto para contar, então os números do menu sempre batem com a
 * lista exibida. Para um filtro novo: a regra aqui + a opção em filterOptions.
 * As regras usam só o formato comum de jogo (LibraryGame).
 */
const GAME_FILTERS = {
    all: () => true,
    played: g => g.played,
    neverPlayed: g => !g.played,
    withAchievements: g => g.total > 0,
    withoutAchievements: g => g.total === 0,
    completed: isCompleted,
    notCompleted: g => g.total > 0 && !isCompleted(g),
    progress: g => g.total > 0 && g.unlocked > 0 && g.unlocked !== g.total,
    pinned: g => g.pinned,
};

/** Regra do filtro pelo valor; valor desconhecido = sem filtro. */
function filterRule(value) {
    return GAME_FILTERS[value] ?? GAME_FILTERS.all;
}

/**
 * Biblioteca (redesign, prancheta 04): lista de jogos do usuário com busca,
 * chips de filtro, ordenação, seções de fixados e jogados recentemente,
 * e progresso de conquistas.
 *
 * Os jogos vêm do useLibrary, já no formato comum (LibraryGame). Uma
 * plataforma por vez: com mais de uma conectada, o seletor no topo troca entre
 * elas. Filtros e ordenações disponíveis vêm da plataforma (`library` no
 * módulo dela); o RA tem ainda filtro de console e esconder hacks/subsets.
 */
export default function GameList({ navigation }) {
    const { t: tr } = useLanguage();
    const { settings, updateSettings } = useSettings();
    const {
        platforms, active, setActive,
        games, loading, progress, syncing, refreshingRecent, error, turbo, toggleTurbo,
        reload, refreshRecent, refreshGame, togglePin, reloadGame,
    } = useLibrary();
    // o que a biblioteca da plataforma ativa oferece (filtros, ordenações, turbo...)
    const libraryOptions = getPlatform(active).library;

    // ---------- hooks / state ----------
    const [filter, setFilter] = useState("all");
    const [sort, setSort] = useState("recentPlaytime");
    // console escolhido no filtro (só RA); null = todos
    const [consoleFilter, setConsoleFilter] = useState(null);

    // Ao trocar de plataforma: volta para os padrões o que ela não oferece
    useEffect(() => {
        setConsoleFilter(null);
        if (!libraryOptions.filters.includes(filter)) setFilter("all");
        if (!libraryOptions.sorts.includes(sort)) setSort("recentPlaytime");
        // eslint-disable-next-line react-hooks/exhaustive-deps -- só na troca de plataforma
    }, [active]);
    const [refreshing, setRefreshing] = useState(false);
    // painel único de filtrar e ordenar (aberto por "Mais filtros" ou pelo botão de ordenar)
    const [sheetVisible, setSheetVisible] = useState(false);

    // Modo de exibição da lista: "compact" (sem imagem), "card" ou "grid"
    // (2 colunas). Fica salvo no aparelho; se a leitura falhar, usa "card".
    const [viewMode, setViewModeState] = useState("card");
    useEffect(() => {
        AsyncStorage.getItem(VIEW_MODE_KEY)
            .then(saved => { if (VIEW_MODES.includes(saved)) setViewModeState(saved); })
            .catch(() => { });
    }, []);
    const setViewMode = useCallback((mode) => {
        setViewModeState(mode);
        AsyncStorage.setItem(VIEW_MODE_KEY, mode).catch(() => { });
    }, []);
    const [showTopButton, setShowTopButton] = useState(false);
    const listRef = useRef(null);

    // search states
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");

    // Último jogo aberto: ao voltar para a lista, ele é relido do banco para
    // refletir o que a GameScreen salvou (conquistas, detalhes, fixado).
    const lastOpenedRef = useRef(null);

    /**
     * Abre a GameScreen passando só a plataforma e o id (a tela lê o jogo do banco).
     */
    const openGame = useCallback((game) => {
        lastOpenedRef.current = game;
        navigation.navigate("GameScreen", { platform: game.platform, id: game.id });
    }, [navigation]);

    useEffect(() => {
        return navigation.addListener("focus", () => {
            const game = lastOpenedRef.current;
            if (!game) return;
            lastOpenedRef.current = null;
            reloadGame(game);
        });
    }, [navigation, reloadGame]);

    /**
     * Renderiza um card de jogo na lista virtualizada (FlashList).
     */
    const renderGameCard = useCallback(
        ({ item, index }) => {
            const card = (
                <GameCard
                    game={item}
                    navigation={navigation}
                    onOpen={openGame}
                    onLongPress={refreshGame}
                    onTogglePin={togglePin}
                    variant={viewMode}
                />
            );
            if (viewMode !== "grid") return card;
            // grade de 2 colunas: meio espaço de cada lado entre as colunas
            return (
                <View style={{ flex: 1, paddingLeft: index % 2 ? 5 : 0, paddingRight: index % 2 ? 0 : 5 }}>
                    {card}
                </View>
            );
        },
        [navigation, openGame, refreshGame, togglePin, viewMode]
    );

    const filterOptions = useMemo(() => [
        // ordem da grade do painel de filtros (prancheta 05), em pares
        { label: tr("filterAll"), value: "all" },
        { label: tr("filterBacklog"), value: "progress" },
        { label: tr("filterPlayed"), value: "played" },
        { label: tr("filterNeverPlayed"), value: "neverPlayed" },
        { label: tr("filterWithAchievements"), value: "withAchievements" },
        { label: tr("filterWithoutAchievements"), value: "withoutAchievements" },
        { label: tr("filterCompleted"), value: "completed" },
        { label: tr("filterNotCompleted"), value: "notCompleted" },
        { label: tr("filterPinned"), value: "pinned" },
    ].filter(o => libraryOptions.filters.includes(o.value)), [tr, libraryOptions]);

    const sortOptions = useMemo(() => [
        { label: tr("sortRecent"), value: "recentPlaytime" },
        { label: tr("sortPlaytime"), value: "totalPlaytime" },
        { label: tr("sortName"), value: "name" },
        { label: tr("sortProgress"), value: "progress" },
    ].filter(o => libraryOptions.sorts.includes(o.value)), [tr, libraryOptions]);

    // Consoles da biblioteca (RA), com quantos jogos cada um tem, por nome
    const consoleOptions = useMemo(() => {
        if (!libraryOptions.hasConsoleFilter) return null;
        const byId = new Map();
        for (const g of games) {
            if (!g.console) continue;
            const entry = byId.get(g.console.id) ?? { value: g.console.id, label: g.console.name, count: 0 };
            entry.count++;
            byId.set(g.console.id, entry);
        }
        return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
    }, [games, libraryOptions]);

    /** Jogos do console escolhido (todos se `consoleId` for null). */
    const gamesOfConsole = useCallback(
        (consoleId) => consoleId == null ? games : games.filter(g => g.console?.id === consoleId),
        [games]
    );

    /** Quantos jogos se encaixam em cada opção de filtro (mesma regra da lista). */
    const countFilters = useCallback((consoleId) => {
        const base = gamesOfConsole(consoleId);
        return filterOptions.reduce((acc, opt) => {
            acc[opt.value] = base.filter(filterRule(opt.value)).length;
            return acc;
        }, {});
    }, [gamesOfConsole, filterOptions]);

    const filterCounts = useMemo(() => countFilters(consoleFilter), [countFilters, consoleFilter]);

    const filteredGames = useMemo(() => {
        const base = gamesOfConsole(consoleFilter);
        let result = filter === "all" ? base : base.filter(filterRule(filter));

        // apply search by name (debounced)
        if (debouncedQuery && debouncedQuery.trim().length > 0) {
            const q = debouncedQuery.trim().toLowerCase();
            result = result.filter(g => g.name.toLowerCase().includes(q));
        }

        // tempo de jogo desconhecido (null) vai para o fim nas ordenações por tempo
        const playtimeOf = g => g.sortKeys.playtime ?? -1;

        switch (sort) {
            case "recentPlaytime":
                result = [...result].sort((a, b) => {
                    const ar = a.sortKeys.recent || 0;
                    const br = b.sortKeys.recent || 0;
                    if (br !== ar) return br - ar;
                    return playtimeOf(b) - playtimeOf(a);
                });
                break;
            case "totalPlaytime":
                result = [...result].sort((a, b) => playtimeOf(b) - playtimeOf(a));
                break;
            case "name":
                result = [...result].sort((a, b) => a.name.localeCompare(b.name));
                break;
            case "progress":
                result = [...result].sort((a, b) => {
                    const aHas = a.total > 0 ? 1 : 0;
                    const bHas = b.total > 0 ? 1 : 0;
                    if (aHas !== bHas) return bHas - aHas;
                    return b.percent - a.percent;
                });
                break;
            default: break;
        }

        return result;
    }, [gamesOfConsole, consoleFilter, filter, sort, debouncedQuery]);

    // Na ordenação padrão, separa os recentes (vão num card com borda no
    // cabeçalho) do restante (vira a lista virtualizada).
    const recentBlock = useMemo(() => {
        if (sort !== "recentPlaytime") return null;
        const recent = filteredGames.filter(g => g.recent);
        const rest = filteredGames.filter(g => !g.recent);
        return { recent, rest };
    }, [filteredGames, sort]);

    // Separa os fixados (vão num card com borda no cabeçalho) do restante.
    const pinnedBlock = useMemo(() => {
        const pinned = filteredGames.filter(g => g.pinned);
        const rest = filteredGames.filter(g => !g.pinned);
        return { pinned, rest };
    }, [filteredGames]);

    /**
     * Dispara o reload completo da lista ao puxar para atualizar (pull-to-refresh).
     */
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await reload();
        } finally {
            setRefreshing(false);
        }
    }, [reload]);

    // debounce search query
    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
        return () => clearTimeout(t);
    }, [searchQuery]);

    // ---------- UI ----------
    // Botão turbo dos cards de sincronização: liga/desliga mais jogos ao mesmo
    // tempo (só na Steam: o RA sincroniza em poucas chamadas)
    const turboButton = !libraryOptions.hasTurbo ? null : (
        <Pressable
            onPress={toggleTurbo}
            accessibilityRole="switch"
            accessibilityState={{ checked: turbo }}
            accessibilityLabel={tr("turboA11y")}
            hitSlop={{ top: 6, bottom: 6 }}
            style={({ pressed }) => [styles.turbo, turbo && styles.turboOn, { opacity: pressed ? 0.8 : 1 }]}
        >
            <Ionicons name={turbo ? "flash" : "flash-outline"} size={14} color={turbo ? COLORS.gold : COLORS.textSoft} />
            <AppText variant="muted" style={[styles.turboLabel, { color: turbo ? COLORS.gold : COLORS.textSoft }]}>
                {tr("turbo")}
            </AppText>
        </Pressable>
    );

    // Primeira sincronização (banco ainda vazio): título, card de progresso e
    // linhas-esqueleto no lugar da lista (redesign, prancheta 13).
    // Seletor de plataforma (só com mais de uma conectada)
    const platformPicker = platforms.length > 1
        ? <PlatformPicker value={active} onChange={setActive} />
        : null;

    if (loading && games.length === 0) {
        // progresso numérico só na Steam; no RA, só o indicador girando
        const pct = progress?.total ? (progress.current / progress.total) * 100 : 0;
        return (
            <View style={styles.screen}>
                <View style={[styles.header, { gap: 16 }]}>
                    <View style={{ gap: 2 }}>
                        <AppText variant="title">{tr("libraryTitle")}</AppText>
                        <AppText variant="muted">{tr("firstSync")}</AppText>
                    </View>
                    {platformPicker}
                    <View style={styles.syncCard} accessibilityRole="progressbar" accessibilityLabel={tr("syncSearching")}>
                        <View style={styles.syncTop}>
                            <AppText variant="itemName" style={{ flex: 1 }}>{tr("syncSearching")}</AppText>
                            {progress?.total > 0 ? (
                                <AppText variant="muted" color={COLORS.accent} style={{ fontFamily: FONTS.bodySemibold }}>
                                    {tr("syncCount", { current: progress.current, total: progress.total })}
                                </AppText>
                            ) : (
                                <ActivityIndicator size="small" color={COLORS.accent} />
                            )}
                        </View>
                        {progress && <ProgressBar value={pct} height={6} />}
                        <View style={styles.syncTop}>
                            <AppText variant="muted" style={{ fontSize: 12, flex: 1 }}>{tr("syncHint")}</AppText>
                            {turboButton}
                        </View>
                    </View>
                    <View style={{ gap: 8 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                        {[0.6, 0.45, 0.7].map((w, i) => (
                            <View key={i} style={styles.skeletonRow}>
                                <View style={styles.skeletonCapsule} />
                                <View style={{ flex: 1, gap: 8 }}>
                                    <View style={[styles.skeletonLine, { width: `${w * 100}%` }]} />
                                    <View style={[styles.skeletonLine, { height: 6 }]} />
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            </View>
        );
    }

    // ---------- blocos do topo da lista (redesign, prancheta 04) ----------
    // Seções do topo: fixados e jogados recentemente (só na ordenação padrão)
    const pinnedRows = pinnedBlock.pinned;
    const recentRows = recentBlock ? recentBlock.recent.filter(g => !g.pinned) : [];
    const listData = recentBlock ? recentBlock.rest.filter(g => !g.pinned) : pinnedBlock.rest;
    const hasTopBlocks = pinnedRows.length > 0 || recentRows.length > 0;

    // Chips rápidos; os outros filtros ficam em "Mais filtros"
    const QUICK_FILTERS = ["all", "progress", "completed"];
    const moreSelected = !QUICK_FILTERS.includes(filter);
    const filterLabel = (value) => filterOptions.find(o => o.value === value)?.label ?? value;
    const sortLabel = sortOptions.find(o => o.value === sort)?.label ?? "";

    const renderRow = (g) => {
        const card = (
            <GameCard
                key={g.key}
                game={g}
                navigation={navigation}
                onOpen={openGame}
                onLongPress={refreshGame}
                onTogglePin={togglePin}
                variant={viewMode}
            />
        );
        // na grade, cada card ocupa meia largura (ver styles.sectionGrid)
        return viewMode === "grid" ? <View key={g.key} style={styles.gridCell}>{card}</View> : card;
    };
    // Seção do topo (fixados/recentes) no formato do modo atual
    const renderSection = (rows) => (
        <View style={viewMode === "grid" ? styles.sectionGrid : null}>{rows.map(renderRow)}</View>
    );

    return (
        <View style={styles.screen}>
            {/* Cabeçalho fixo: título, atualizar recentes, busca, ordenação e chips */}
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <View style={{ flex: 1, gap: 2 }}>
                        <AppText variant="title">{tr("libraryTitle")}</AppText>
                        <AppText variant="muted">
                            {tr("librarySubtitle", { count: games.length, completed: filterCounts.completed ?? 0 })}
                        </AppText>
                    </View>
                    {/* Modo de exibição: lista sem imagem, cards ou grade */}
                    <View style={styles.viewToggle} accessibilityRole="radiogroup" accessibilityLabel={tr("viewModeLabel")}>
                        {VIEW_MODE_OPTIONS.map(opt => {
                            const on = viewMode === opt.value;
                            return (
                                <Pressable
                                    key={opt.value}
                                    onPress={() => setViewMode(opt.value)}
                                    accessibilityRole="radio"
                                    accessibilityState={{ checked: on }}
                                    accessibilityLabel={tr(opt.label)}
                                    hitSlop={{ top: 4, bottom: 4 }}
                                    style={[styles.viewOption, on && styles.viewOptionOn]}
                                >
                                    <Ionicons name={opt.icon} size={18} color={on ? COLORS.accent : COLORS.textMuted} />
                                </Pressable>
                            );
                        })}
                    </View>
                    <Pressable
                        onPress={() => refreshRecent(false)}
                        // desativado durante a sincronização completa, que já
                        // atualiza tudo (inclusive os recentes)
                        disabled={refreshingRecent || syncing}
                        accessibilityRole="button"
                        accessibilityLabel={tr("refreshRecentGames")}
                        accessibilityState={{ disabled: refreshingRecent || syncing, busy: refreshingRecent }}
                        style={({ pressed }) => [
                            styles.iconButton,
                            { opacity: !refreshingRecent && syncing ? 0.5 : pressed ? 0.8 : 1 },
                        ]}
                    >
                        {refreshingRecent ? (
                            <ActivityIndicator size="small" color={COLORS.accent} />
                        ) : (
                            <Ionicons name="refresh" size={20} color={COLORS.accent} />
                        )}
                    </Pressable>
                </View>

                {platformPicker}

                <View style={styles.searchRow}>
                    <TextField
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder={tr("searchGamesPlaceholder")}
                        accessibilityLabel={tr("searchGamesPlaceholder")}
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
                        onPress={() => setSheetVisible(true)}
                        accessibilityRole="button"
                        accessibilityLabel={tr("sortButton", { sort: sortLabel })}
                        style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.8 : 1 }]}
                    >
                        <Ionicons name="swap-vertical" size={20} color={COLORS.textSoft} />
                        {(sort !== "recentPlaytime" || consoleFilter != null) && <View style={styles.dot} />}
                    </Pressable>
                </View>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chips}
                    keyboardShouldPersistTaps="handled"
                >
                    {QUICK_FILTERS.map(value => (
                        <Chip
                            key={value}
                            label={filterLabel(value)}
                            count={filterCounts[value]}
                            selected={filter === value}
                            onPress={() => setFilter(value)}
                        />
                    ))}
                    <Chip
                        label={moreSelected ? filterLabel(filter) : tr("moreFilters")}
                        count={moreSelected ? filterCounts[filter] : undefined}
                        selected={moreSelected}
                        onPress={() => setSheetVisible(true)}
                    />
                </ScrollView>
            </View>

            <PullToRefresh refreshing={refreshing} onRefresh={onRefresh} enabled={!syncing}>
                <FlashList
                    key={`${active}-${filter}-${sort}-${consoleFilter}-${debouncedQuery}-${!!recentBlock}-${pinnedBlock.pinned.length}-${viewMode}`}
                    numColumns={viewMode === "grid" ? 2 : 1}
                    ref={listRef}
                    data={listData}
                    keyExtractor={(item) => item.key}
                    renderItem={renderGameCard}
                    maintainVisibleContentPosition={{ disabled: true }}
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                    onScroll={(e) => {
                        setShowTopButton(e.nativeEvent.contentOffset.y > 400);
                    }}
                    ListHeaderComponent={
                        <View style={styles.blocks}>
                            {!refreshing && syncing && (
                                <View style={styles.syncCard} accessibilityRole="progressbar">
                                    <View style={styles.syncTop}>
                                        <ActivityIndicator size="small" color={COLORS.accent} />
                                        <AppText variant="muted" style={{ flex: 1 }}>
                                            {progress
                                                ? tr("loadingGames", { current: progress.current, total: progress.total })
                                                : tr("raSyncing")}
                                        </AppText>
                                        {turboButton}
                                    </View>
                                    {progress && (
                                        <ProgressBar value={progress.total ? (progress.current / progress.total) * 100 : 0} />
                                    )}
                                </View>
                            )}

                            {pinnedRows.length > 0 && (
                                <View style={styles.section}>
                                    <AppText variant="label" color={COLORS.gold}>{tr("pinnedSeparator")}</AppText>
                                    {renderSection(pinnedRows)}
                                </View>
                            )}

                            {recentRows.length > 0 && (
                                <View style={styles.section}>
                                    <AppText variant="label">{tr("recentGamesSeparator")}</AppText>
                                    {renderSection(recentRows)}
                                </View>
                            )}

                            {hasTopBlocks && listData.length > 0 && (
                                <AppText variant="label" style={{ marginBottom: 10 }}>{tr("allGamesSeparator")}</AppText>
                            )}
                        </View>
                    }
                    ListEmptyComponent={
                        games.length === 0 ? (
                            <View style={styles.empty}>
                                <View style={styles.emptyIcon}>
                                    <Ionicons name="game-controller-outline" size={30} color={COLORS.accent} />
                                </View>
                                <AppText variant="subtitle" style={{ textAlign: "center" }}>{tr("noGamesTitle")}</AppText>
                                <AppText variant="muted" style={{ textAlign: "center", fontSize: 14, lineHeight: 21 }}>
                                    {active === "ra"
                                        ? (error ? tr("raConnectionError") : tr("raEmptyLibrary"))
                                        : tr("noGamesMessage")}
                                </AppText>
                                <Button
                                    label={tr("profileRetry")}
                                    onPress={onRefresh}
                                    loading={refreshing}
                                    style={{ marginTop: 8, paddingHorizontal: 28 }}
                                />
                                {/* ajuda: privacidade do perfil (Steam) ou o site do RA */}
                                <Pressable
                                    onPress={() => WebBrowser.openBrowserAsync(active === "ra" ? RA_SITE_URL : STEAM_PRIVACY_URL)
                                        .catch(err => console.error("Failed to open browser:", err))}
                                    accessibilityRole="link"
                                    style={styles.helpLink}
                                >
                                    <AppText variant="muted" color={COLORS.accent} style={{ fontFamily: FONTS.bodySemibold, fontSize: 14 }}>
                                        {active === "ra" ? tr("raOpenSite") : tr("publicProfileHelp")}
                                    </AppText>
                                </Pressable>
                            </View>
                        ) : null
                    }
                />
            </PullToRefresh>

            {/* Voltar ao topo: aparece depois de rolar, acima da tab bar */}
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

            <FilterSortSheet
                visible={sheetVisible}
                onClose={() => setSheetVisible(false)}
                filterOptions={filterOptions}
                counts={filterCounts}
                computeCounts={countFilters}
                filter={filter}
                sortOptions={sortOptions}
                sort={sort}
                consoleOptions={consoleOptions}
                consoleValue={consoleFilter}
                toggles={libraryOptions.hasConsoleFilter ? [
                    { key: "hideHacks", label: tr("hideHacks"), value: settings.hideHacks, onChange: v => updateSettings({ hideHacks: v }) },
                    { key: "hideSubsets", label: tr("hideSubsets"), value: settings.hideSubsets, onChange: v => updateSettings({ hideSubsets: v }) },
                ] : null}
                onApply={({ filter: f, sort: s, console: c }) => {
                    setFilter(f);
                    setSort(s);
                    setConsoleFilter(c ?? null);
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.bg },
    header: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    viewToggle: {
        flexDirection: "row",
        padding: 3,
        gap: 2,
        borderRadius: 14,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
    },
    viewOption: { width: 36, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    viewOptionOn: { backgroundColor: COLORS.accentSoft },
    // seções do topo na grade: 2 colunas com 10 px entre elas
    sectionGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
    gridCell: { width: "48.6%" },
    // 48 px: mesma altura do campo de busca, para ficarem alinhados
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
    searchRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
    clearButton: { width: 36, height: 44, marginRight: -10, alignItems: "center", justifyContent: "center" },
    chips: { gap: 8, paddingVertical: 5, paddingRight: 20 },
    // espaço no fim para a lista não ficar atrás da tab bar flutuante
    listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 110 },
    blocks: { gap: 16, paddingBottom: 4 },
    section: { gap: 10 },
    syncCard: {
        padding: 14,
        borderRadius: 16,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        gap: 10,
    },
    syncTop: { flexDirection: "row", alignItems: "center", gap: 10 },
    // botão turbo: pílula pequena, dourada quando ligada
    turbo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        height: 32,
        paddingHorizontal: 10,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    turboOn: { borderColor: COLORS.gold, backgroundColor: "rgba(255, 179, 0, 0.12)" },
    turboLabel: { fontFamily: FONTS.bodySemibold, fontSize: 12 },
    helpLink: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
    skeletonRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 16, backgroundColor: COLORS.surface },
    skeletonCapsule: { width: 92, height: 34, borderRadius: 8, backgroundColor: COLORS.surface2 },
    skeletonLine: { height: 10, borderRadius: 5, backgroundColor: COLORS.surface2 },
    empty: { alignItems: "center", paddingVertical: 80, paddingHorizontal: 12, gap: 10 },
    emptyIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: COLORS.accentSoft,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 6,
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
