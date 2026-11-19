import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { memo, useContext, useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Pressable from "@/src/components/ui/Pressable";
import { getStoreAssets } from "@/src/api/steam";
import { AppText, ProgressBar, TextField } from "@/src/components/ui";
import { AuthContext } from "@/src/context/AuthContext";
import { getGamesProgress } from "@/src/database/db";
import { useImageCdnFallback } from "@/src/hooks/useImageCdnFallback";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";
import { capsuleUri, imageCandidates } from "@/src/utils/cdn";
import { personaStatus } from "@/src/utils/personaStatus";

const placeholderImage = require("../../assets/images/placeholder_gamelist.jpg");

/**
 * Linha de um jogo do amigo: cápsula, nome e, se você também tem o jogo com
 * conquistas, o seu progresso ("você 64%"). `capsuleUrl` = URL da loja (com
 * hash, funciona para jogos novos), quando já buscada; senão CDNs antigos.
 */
function GameRowComponent({ item, capsuleUrl, mine }) {
    const { t: tr } = useLanguage();
    const candidates = imageCandidates(capsuleUrl, fb => capsuleUri(item.appid, fb));
    const { stage, onError } = useImageCdnFallback(
        `${item.appid}|${capsuleUrl ?? ""}`,
        candidates.length
    );
    const pct = mine && mine.total > 0 ? (mine.unlocked / mine.total) * 100 : null;

    return (
        <View style={styles.row}>
            <Image
                source={stage >= candidates.length ? placeholderImage : { uri: candidates[stage] }}
                onError={onError}
                style={styles.capsule}
                resizeMode="cover"
            />
            <View style={styles.rowBody}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                {pct != null && (
                    <View style={styles.progressRow}>
                        <ProgressBar value={pct} style={{ flex: 1 }} />
                        <Text style={styles.youText}>{tr("youProgress", { percent: `${Math.round(pct)}%` })}</Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const GameRow = memo(GameRowComponent);

/**
 * Jogos de um amigo (redesign, prancheta 10): cabeçalho com avatar e status,
 * seletor "Em comum | Todos do amigo", busca e a lista com o seu progresso
 * nos jogos que vocês dois têm.
 */
export default function CommonGames({ route, navigation }) {
    const { friend } = route.params;
    const { steamId } = useContext(AuthContext);
    const { t: tr } = useLanguage();
    const [mode, setMode] = useState(route.params?.mode === "all" ? "all" : "common");
    const [searchQuery, setSearchQuery] = useState("");

    const commonGames = useMemo(() => friend?.commonGames || [], [friend]);
    const allGames = useMemo(() => friend?.games?.games || [], [friend]);
    const games = mode === "all" ? allGames : commonGames;

    const friendName = friend?.profile?.personaname || tr("friendFallback");
    const status = personaStatus(friend?.profile?.personastate, tr);
    const gameCount = friend?.games?.game_count ?? allGames.length;

    // Seu progresso por jogo (appid -> { unlocked, total }), lido do banco
    const [myProgress, setMyProgress] = useState(() => new Map());
    useEffect(() => {
        if (!steamId) return;
        let cancelled = false;
        getGamesProgress(steamId).then(map => { if (!cancelled) setMyProgress(map); });
        return () => { cancelled = true; };
    }, [steamId]);

    // URLs das imagens da loja dos jogos exibidos (appid -> { capsuleUrl }).
    // Esses jogos não estão no banco do usuário, então busca ao trocar de lista;
    // o que já foi buscado fica guardado.
    const [assets, setAssets] = useState(() => new Map());
    useEffect(() => {
        let cancelled = false;
        const missing = games.map(g => g.appid).filter(id => !assets.has(id));
        if (missing.length === 0) return;
        getStoreAssets(missing).then(map => {
            if (!cancelled && map.size > 0) setAssets(prev => new Map([...prev, ...map]));
        });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- assets só serve para pular o que já foi buscado
    }, [games]);

    const filteredGames = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return games
            .filter(g => (g.name || "").toLowerCase().includes(q))
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }, [games, searchQuery]);

    const initials = friendName.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();

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

                <View style={styles.friendRow}>
                    <View>
                        {friend?.profile?.avatarfull ? (
                            <Image source={{ uri: friend.profile.avatarfull }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarFallback]}>
                                <Text style={styles.initials}>{initials}</Text>
                            </View>
                        )}
                        <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                        <AppText variant="title" style={{ fontSize: 26 }} numberOfLines={1}>{friendName}</AppText>
                        <AppText variant="muted">
                            {tr("friendGamesStatus", { count: gameCount, status: status.text })}
                        </AppText>
                    </View>
                </View>

                <View style={styles.segment} accessibilityRole="tablist" accessibilityLabel={tr("friendGamesFilter")}>
                    {[
                        { value: "common", label: tr("friendTabCommon", { count: commonGames.length }) },
                        { value: "all", label: tr("friendTabAll", { count: gameCount }) },
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
                                <Text
                                    style={[styles.segmentLabel, on ? styles.segmentLabelOn : styles.segmentLabelOff]}
                                    numberOfLines={1}
                                >
                                    {opt.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                <TextField
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder={tr("searchGamesPlaceholder")}
                    accessibilityLabel={tr("searchGamesPlaceholder")}
                    returnKeyType="search"
                    left={<Ionicons name="search" size={18} color={COLORS.textMuted} />}
                    right={searchQuery ? (
                        <Pressable
                            onPress={() => setSearchQuery("")}
                            accessibilityRole="button"
                            accessibilityLabel={tr("clearSearch")}
                            style={styles.clearButton}
                        >
                            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
                        </Pressable>
                    ) : null}
                />
            </View>

            <FlashList
                key={mode}
                data={filteredGames}
                keyExtractor={(item) => item.appid.toString()}
                maintainVisibleContentPosition={{ disabled: true }}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                extraData={{ assets, myProgress }}
                renderItem={({ item }) => (
                    <GameRow
                        item={item}
                        capsuleUrl={assets.get(item.appid)?.capsuleUrl}
                        mine={myProgress.get(item.appid)}
                    />
                )}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <AppText variant="muted" style={{ fontSize: 15, textAlign: "center" }}>
                            {mode === "all" ? tr("noGames") : tr("noCommonGames")}
                        </AppText>
                    </View>
                }
            />
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
    avatar: { width: 64, height: 64, borderRadius: 32 },
    avatarFallback: { backgroundColor: "#2B3550", alignItems: "center", justifyContent: "center" },
    initials: { fontFamily: FONTS.display, fontSize: 22, color: COLORS.text },
    statusDot: {
        position: "absolute",
        right: 0,
        bottom: 0,
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 3,
        borderColor: COLORS.bg,
    },
    segment: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 14, backgroundColor: COLORS.surface },
    segmentItem: { flex: 1, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
    segmentItemOn: { backgroundColor: COLORS.border },
    segmentLabel: { fontSize: 14 },
    segmentLabelOn: { fontFamily: FONTS.bodySemibold, color: COLORS.text },
    segmentLabelOff: { fontFamily: FONTS.bodyMedium, color: COLORS.textSoft },
    clearButton: { width: 36, height: 44, marginRight: -10, alignItems: "center", justifyContent: "center" },
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
    capsule: { width: 92, height: 34, borderRadius: 8, backgroundColor: COLORS.surface2 },
    rowBody: { flex: 1, minWidth: 0, gap: 6 },
    name: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.text },
    progressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    youText: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted },
    empty: { paddingVertical: 48, alignItems: "center" },
});
