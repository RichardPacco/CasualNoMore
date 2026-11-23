import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { memo, useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Linking, StyleSheet, Text, View } from "react-native";
import { getUserCompletionProgress, raMedia, raUserPic, raUserUrl } from "@/src/api/retroachievements";
import AwardMedal from "@/src/components/AwardMedal";
import { AppText, ProgressBar, TextField } from "@/src/components/ui";
import Pressable from "@/src/components/ui/Pressable";
import { AuthContext } from "@/src/context/AuthContext";
import { useSettings } from "@/src/context/SettingsContext";
import { getAllRaGames, getRaFriend, saveRaFriendGames } from "@/src/database/raDb";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { raTitleFlags } from "@/src/platforms/ra/adapter";
import { COLORS, FONTS } from "@/src/theme/colors";
import { parseRaDate } from "@/src/utils/raDate";

// Consoles que não são jogos (Hubs, Events), como na biblioteca
const NON_GAME_CONSOLES = new Set([100, 101]);

/** Progresso em hardcore (só hardcore conta, decisão D2) e medalha de um item da biblioteca do RA. */
function progressOf(unlocked, total, kind) {
    const pct = total > 0 ? (Math.min(unlocked, total) / total) * 100 : 0;
    const award = kind === "mastered" ? "mastered" : kind === "beaten-hardcore" ? "beaten" : null;
    return { pct, award };
}

/**
 * Uma barra de progresso com rótulo (você / o amigo) e a medalha, se houver.
 * `softcore`: texto em cinza embaixo quando há desbloqueios só em softcore
 * (o % é só hardcore, então um jogo jogado em softcore aparece como 0%).
 */
function ProgressLine({ label, pct, award, softcore }) {
    return (
        <View style={{ gap: 2 }}>
            <View style={styles.progressRow}>
                <Text style={styles.progressLabel} numberOfLines={1}>{label}</Text>
                <ProgressBar value={pct} style={{ flex: 1 }} />
                <Text style={styles.progressPct}>{Math.round(pct)}%</Text>
                <View style={styles.medalSlot}>{award && <AwardMedal award={award} size={16} />}</View>
            </View>
            {softcore ? <Text style={styles.softcore}>{softcore}</Text> : null}
        </View>
    );
}

/**
 * "15/40 em softcore" quando a pessoa tem mais desbloqueios no total (casual +
 * hardcore) do que em hardcore; null se não tiver nada só em softcore.
 */
function softcoreText(awarded, awardedHardcore, total, tr) {
    const all = Number(awarded) || 0;
    if (!(Number(total) > 0) || all <= (Number(awardedHardcore) || 0)) return null;
    return tr("softcoreProgress", { n: Math.min(all, total), total });
}

/** Linha de um jogo do amigo: ícone, nome, console e o progresso dos dois. */
const GameRow = memo(function GameRow({ item, mine, friendName }) {
    const { t: tr } = useLanguage();
    const friend = progressOf(item.NumAwardedHardcore, item.MaxPossible, item.HighestAwardKind);
    const me = mine ? progressOf(mine.numAwardedHardcore, mine.maxPossible, mine.highestAwardKind) : null;

    return (
        <View style={styles.row}>
            <Image source={{ uri: raMedia(item.ImageIcon) }} style={styles.icon} />
            <View style={styles.rowBody}>
                <Text style={styles.name} numberOfLines={1}>{item.Title}</Text>
                <Text style={styles.console} numberOfLines={1}>{item.ConsoleName}</Text>
                {Number(item.MaxPossible) > 0 && (
                    <>
                        <ProgressLine
                            label={friendName}
                            pct={friend.pct}
                            award={friend.award}
                            softcore={softcoreText(item.NumAwarded, item.NumAwardedHardcore, Number(item.MaxPossible), tr)}
                        />
                        {me && (
                            <ProgressLine
                                label={tr("you")}
                                pct={me.pct}
                                award={me.award}
                                softcore={softcoreText(mine.numAwarded, mine.numAwardedHardcore, mine.maxPossible, tr)}
                            />
                        )}
                    </>
                )}
            </View>
        </View>
    );
});

/**
 * Jogos de um amigo do RetroAchievements: cabeçalho com avatar e pontos,
 * seletor "Em comum | Todos do amigo", busca e a lista com o progresso
 * hardcore dos dois (e as medalhas). Os jogos do amigo ficam salvos no banco:
 * aparecem na hora e são atualizados ao abrir.
 * Recebe pela rota `friendUlid` e `friendUser` (nome, para mostrar na hora).
 */
export default function RaCommonGames({ route, navigation }) {
    const { friendUlid, friendUser } = route.params;
    const { accounts } = useContext(AuthContext);
    const { settings } = useSettings();
    const { t: tr } = useLanguage();
    const myUlid = accounts.ra?.ulid;

    const [mode, setMode] = useState("common");
    const [query, setQuery] = useState("");
    const [friend, setFriend] = useState(null);
    const [games, setGames] = useState(null);
    const [error, setError] = useState(false);
    // minha biblioteca do RA: gameId -> linha do banco
    const [mine, setMine] = useState(() => new Map());

    useEffect(() => {
        if (!myUlid) return;
        let cancelled = false;
        (async () => {
            // 1️⃣ banco: minha biblioteca e o que já foi salvo do amigo
            const [myRows, saved] = await Promise.all([getAllRaGames(myUlid), getRaFriend(myUlid, friendUlid)]);
            if (cancelled) return;
            setMine(new Map(myRows.map(r => [r.gameId, r])));
            setFriend(saved);
            if (saved?.games) setGames(saved.games);

            // 2️⃣ biblioteca do amigo no RA
            try {
                const { results } = await getUserCompletionProgress(friendUlid);
                if (cancelled) return;
                const list = results.filter(r => !NON_GAME_CONSOLES.has(Number(r.ConsoleID)));
                setGames(list);
                setError(false);
                saveRaFriendGames(myUlid, friendUlid, list);
            } catch (err) {
                console.warn("[RaCommonGames] falhou", err?.message);
                if (!cancelled) setError(true);
            }
        })();
        return () => { cancelled = true; };
    }, [myUlid, friendUlid]);

    // hacks/subsets escondidos como na biblioteca
    const visible = useMemo(() => (games || []).filter(g => {
        const flags = raTitleFlags(g.Title);
        return !(settings.hideHacks && flags.hack) && !(settings.hideSubsets && flags.subset);
    }), [games, settings.hideHacks, settings.hideSubsets]);

    const common = useMemo(() => visible.filter(g => mine.has(Number(g.GameID))), [visible, mine]);

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return (mode === "all" ? visible : common)
            .filter(g => !q || (g.Title || "").toLowerCase().includes(q))
            // o que o amigo jogou mais recentemente primeiro
            .sort((a, b) => (parseRaDate(b.MostRecentAwardedDate) ?? 0) - (parseRaDate(a.MostRecentAwardedDate) ?? 0));
    }, [mode, visible, common, query]);

    const name = friend?.user || friendUser || tr("friendFallback");
    const pointsText = friend?.points ? tr("points", { n: Number(friend.points).toLocaleString() }) : null;
    const subtitle = [tr("raGamesCount", { count: visible.length }), pointsText].filter(Boolean).join(" · ");

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <Pressable
                    onPress={() => navigation.goBack()}
                    accessibilityRole="button"
                    accessibilityLabel={tr("back")}
                    style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.8 : 1 }]}
                >
                    <Ionicons name="chevron-back" size={22} color={COLORS.text} />
                </Pressable>

                {/* avatar e nome abrem o perfil da pessoa no RetroAchievements */}
                <Pressable
                    onPress={() => Linking.openURL(raUserUrl(name)).catch(err => console.error("Failed to open URL:", err))}
                    accessibilityRole="link"
                    accessibilityLabel={`${name}, ${tr("viewOnRa")}`}
                    style={({ pressed }) => [styles.friendRow, { opacity: pressed ? 0.8 : 1 }]}
                >
                    <Image source={{ uri: raUserPic(name) }} style={styles.avatar} />
                    <View style={{ flex: 1, gap: 2 }}>
                        <AppText variant="title" style={{ fontSize: 26 }} numberOfLines={1}>{name}</AppText>
                        {games && <AppText variant="muted">{subtitle}</AppText>}
                    </View>
                </Pressable>

                <View style={styles.segment} accessibilityRole="tablist" accessibilityLabel={tr("friendGamesFilter")}>
                    {[
                        { value: "common", label: tr("friendTabCommon", { count: common.length }) },
                        { value: "all", label: tr("friendTabAll", { count: visible.length }) },
                    ].map(opt => {
                        const on = mode === opt.value;
                        return (
                            <Pressable
                                key={opt.value}
                                onPress={() => setMode(opt.value)}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: on }}
                                style={[styles.segmentItem, on && styles.segmentItemOn]}
                            >
                                <Text style={[styles.segmentLabel, on ? styles.segmentLabelOn : styles.segmentLabelOff]} numberOfLines={1}>
                                    {opt.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                <TextField
                    value={query}
                    onChangeText={setQuery}
                    placeholder={tr("searchGamesPlaceholder")}
                    accessibilityLabel={tr("searchGamesPlaceholder")}
                    returnKeyType="search"
                    left={<Ionicons name="search" size={18} color={COLORS.textMuted} />}
                />
            </View>

            {!games && !error ? (
                <ActivityIndicator size="large" color={COLORS.accent} style={{ marginTop: 40 }} />
            ) : (
                <FlashList
                    key={mode}
                    data={shown}
                    keyExtractor={(item) => String(item.GameID)}
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                    extraData={mine}
                    renderItem={({ item }) => (
                        <GameRow item={item} mine={mine.get(Number(item.GameID))} friendName={name} />
                    )}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <AppText variant="muted" style={{ fontSize: 15, textAlign: "center" }}>
                                {error && !games ? tr("raConnectionError") : mode === "all" ? tr("noGames") : tr("noCommonGames")}
                            </AppText>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.bg },
    header: { paddingHorizontal: 20, paddingTop: 16, gap: 16 },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        backgroundColor: COLORS.surface,
        alignItems: "center",
        justifyContent: "center",
    },
    friendRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.surface2 },
    segment: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 14, backgroundColor: COLORS.surface },
    segmentItem: { flex: 1, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
    segmentItemOn: { backgroundColor: COLORS.border },
    segmentLabel: { fontSize: 14 },
    segmentLabelOn: { fontFamily: FONTS.bodySemibold, color: COLORS.text },
    segmentLabelOff: { fontFamily: FONTS.bodyMedium, color: COLORS.textSoft },
    // espaço no fim para a lista não ficar atrás da tab bar flutuante
    listContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 110 },
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
    rowBody: { flex: 1, minWidth: 0, gap: 4 },
    name: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.text },
    console: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted },
    progressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    progressLabel: { width: 64, fontFamily: FONTS.bodyMedium, fontSize: 11, color: COLORS.textSoft },
    progressPct: { width: 34, textAlign: "right", fontFamily: FONTS.bodySemibold, fontSize: 11, color: COLORS.textSoft },
    // desbloqueios só em softcore: alinhado com a barra, em cinza
    softcore: { marginLeft: 72, fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted },
    medalSlot: { width: 16, alignItems: "center" },
    empty: { paddingVertical: 48, alignItems: "center" },
});
