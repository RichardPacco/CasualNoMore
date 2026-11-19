import { getFriendList, getOwnedGames, getPlayerSummary } from "@/src/api/steam";
import PullToRefresh from "@/src/components/PullToRefresh";
import { AppText, ProgressBar, TextField } from "@/src/components/ui";
import { AuthContext } from "@/src/context/AuthContext";
import { loadFriend, saveFriendsBatch } from "@/src/database/db";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";
import { personaStatus } from "@/src/utils/personaStatus";
import { Ionicons } from "@expo/vector-icons";
import { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";

/** Gera uma assinatura (appids ordenados) dos jogos para detectar mudanças na lista. */
function gamesSignature(games) {
    return (games?.games ?? [])
        .map(g => g.appid)
        .sort((a, b) => a - b)
        .join(",");
}

/** Verifica se os dados do amigo mudaram (perfil, contagem ou lista de jogos). */
function friendChanged(prev, next) {
    if (prev.profile?.personaname !== next.profile?.personaname) return true;
    if (prev.profile?.avatarfull !== next.profile?.avatarfull) return true;
    if ((prev.games?.game_count ?? 0) !== (next.games?.game_count ?? 0)) return true;
    if (gamesSignature(prev.games) !== gamesSignature(next.games)) return true;
    return false;
}

/**
 * Busca perfil e jogos do amigo na Steam e calcula os jogos em comum;
 * retorna null se alguma busca falhar.
 */
async function fetchFriendData(id, myGames) {
    const [friendProfile, games] = await Promise.all([
        getPlayerSummary(id),
        getOwnedGames(id),
    ]);
    if (!friendProfile || !games) return null;

    // Set com os appids do amigo: cada consulta é O(1), então o total é
    // proporcional ao tamanho das bibliotecas (antes era meus jogos × jogos dele).
    const friendAppIds = new Set((games.games ?? []).map(g => g.appid));
    const commonGames = myGames.filter(myGame => friendAppIds.has(myGame.appid));

    return { steamId: id, profile: friendProfile, games, commonGames };
}

/**
 * Linha de um amigo (redesign, prancheta 09): avatar com bolinha de status,
 * nome, quantidade de jogos e status, e etiqueta com os jogos em comum.
 * Tocar abre os jogos do amigo.
 */
function FriendRowComponent({ friend, onPress }) {
    const { t: tr } = useLanguage();
    const name = friend.profile?.personaname || tr("friendFallback");
    const status = personaStatus(friend.profile?.personastate, tr);
    const common = friend.commonGames?.length ?? 0;
    const initials = name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();

    return (
        <Pressable
            onPress={() => onPress(friend)}
            accessibilityRole="button"
            accessibilityLabel={`${name}, ${status.text}, ${tr("friendCommonPill", { count: common })}`}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}
        >
            <View>
                {friend.profile?.avatarfull ? (
                    <Image source={{ uri: friend.profile.avatarfull }} style={styles.avatar} />
                ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                        <Text style={styles.initials}>{initials}</Text>
                    </View>
                )}
                <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            </View>

            <View style={styles.rowBody}>
                <Text style={styles.name} numberOfLines={1}>{name}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                    {tr("friendGamesStatus", { count: friend.games?.game_count ?? 0, status: status.text })}
                </Text>
            </View>

            <Text style={styles.pill}>{tr("friendCommonPill", { count: common })}</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </Pressable>
    );
}

const FriendRow = memo(FriendRowComponent);

/**
 * Lista de amigos (redesign, prancheta 09): busca e uma linha por amigo com
 * status e jogos em comum; tocar abre a tela de jogos do amigo.
 */
export default function Friends({ navigation }) {
    const { steamId } = useContext(AuthContext);
    const { t: tr } = useLanguage();

    const [friends, setFriends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [friendListError, setFriendListError] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const cancelledRef = useRef(false);
    const myGamesRef = useRef([]);
    const friendsRef = useRef([]);

    useEffect(() => {
        friendsRef.current = friends;
    }, [friends]);

    useEffect(() => {
        cancelledRef.current = !steamId;
    }, [steamId]);

    /** Abre a tela de jogos do amigo (começa em "Em comum"). */
    const openFriend = useCallback((friend) => {
        navigation.navigate("CommonGames", { friend });
    }, [navigation]);

    /**
     * Busca progressivamente dados frescos dos amigos (perfil + jogos + comuns),
     * em paralelo (poucos por vez para não estourar a API), atualizando a UI e
     * persistindo em lotes (reduz re-renders e I/O).
     */
    const refreshFriends = useCallback(async (friendIds) => {
        if (cancelledRef.current) return;
        setLoading(true);

        // Map steamid -> índice na lista: lookups O(1) no lugar do findIndex
        const friendMap = new Map();
        const friendList = [];
        for (const f of friendsRef.current) {
            if (!friendMap.has(f.steamid)) {
                friendMap.set(f.steamid, friendList.length);
                friendList.push(f);
            }
        }

        // Progresso conta só os amigos sendo buscados agora (pode ser um subconjunto)
        const total = friendIds.length;
        setProgress({ current: 0, total });

        const CONCURRENCY = 5; // quantos amigos são buscados ao mesmo tempo
        const UI_BATCH = 5;    // a cada quantos amigos a lista é re-renderizada
        let batchToSave = [];
        let updatedAny = false;

        try {
            for (let i = 0; i < friendIds.length; i += CONCURRENCY) {
                if (cancelledRef.current) return;

                const chunk = friendIds.slice(i, i + CONCURRENCY);
                const results = await Promise.all(chunk.map(async (id) => {
                    try {
                        const data = await fetchFriendData(id, myGamesRef.current);
                        return data ? { steamid: id, ...data } : null;
                    } catch (e) {
                        console.warn(`[Friends] Friend ignored: ${id}`, e.message);
                        return null;
                    }
                }));
                if (cancelledRef.current) return;

                for (const friendData of results) {
                    if (!friendData) continue;
                    const idx = friendMap.get(friendData.steamid);

                    if (idx !== undefined) {
                        const prev = friendList[idx];
                        if (!friendChanged(prev, friendData)) continue;
                        friendList[idx] = friendData;
                    } else {
                        friendMap.set(friendData.steamid, friendList.length);
                        friendList.push(friendData);
                    }

                    updatedAny = true;
                    batchToSave.push(friendData);
                }

                setProgress({ current: Math.min(i + CONCURRENCY, total), total });

                // Atualiza a lista e persiste em lotes, não a cada amigo
                if (updatedAny && (batchToSave.length >= UI_BATCH || i + CONCURRENCY >= friendIds.length)) {
                    setFriends([...friendList]);
                    await saveFriendsBatch(steamId, batchToSave);
                    batchToSave = [];
                }
            }

            // Garante o progresso final mesmo sem mudanças
            setProgress({ current: total, total });
        } catch (err) {
            console.error("[Friends] Failed to refresh friends:", err);
        } finally {
            setLoading(false);
        }
    }, [steamId]);

    /**
     * Carrega a lista de amigos: cache do banco exibido na hora e, em seguida,
     * busca na Steam os amigos que ainda não estão no cache.
     */
    const loadFriends = useCallback(async () => {
        if (!steamId) return;
        setLoading(true);
        try {
            // Jogos do usuário para calcular jogos em comum
            const own = await getOwnedGames(steamId);
            myGamesRef.current = own?.games ?? [];

            const friendList = await getFriendList(steamId);
            setFriendListError(friendList === null);
            const friendIds = (friendList ?? []).map(f => f.steamid);

            const cachedResults = await Promise.all(friendIds.map(id => loadFriend(steamId, id)));
            const cachedFriends = [];
            for (let i = 0; i < friendIds.length; i++) {
                const cached = cachedResults[i];
                if (cached) {
                    const id = friendIds[i];
                    cachedFriends.push({
                        steamid: id,
                        profile: cached.profile,
                        games: cached.games || { game_count: 0, games: [] },
                        commonGames: cached.commonGames
                    });
                }
            }
            setFriends(cachedFriends); // show immediately
            // O refreshFriends parte de friendsRef; o useEffect que o sincroniza só
            // roda depois do render, então atualiza já para não perder o cache.
            friendsRef.current = cachedFriends;

            // Busca na Steam só os amigos que ainda não estão no cache (amigos novos
            // ou nunca carregados). Os já cacheados são atualizados no pull-to-refresh.
            const missingIds = friendIds.filter((_, i) => !cachedResults[i]);
            if (missingIds.length > 0) {
                await refreshFriends(missingIds);
            }
        } catch (err) {
            console.error("[Friends] Failed to load:", err);
        } finally {
            setLoading(false);
        }
    }, [steamId, refreshFriends]);

    /** Re-fetcha a lista de amigos ao puxar para atualizar (pull-to-refresh). */
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            const own = await getOwnedGames(steamId);
            myGamesRef.current = own?.games ?? [];

            const friendList = await getFriendList(steamId);
            setFriendListError(friendList === null);
            const friendIds = (friendList ?? []).map(f => f.steamid);

            await refreshFriends(friendIds);
        } catch (err) {
            console.error("[Friends] Failed to refresh:", err);
        } finally {
            setRefreshing(false);
        }
    }, [steamId, refreshFriends]);

    useEffect(() => {
        loadFriends();
    }, [loadFriends]);

    const filteredFriends = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return friends;
        return friends.filter(f => (f.profile?.personaname || "").toLowerCase().includes(q));
    }, [friends, searchQuery]);

    const syncing = progress.current < progress.total;

    const renderRow = useCallback(
        ({ item }) => <FriendRow friend={item} onPress={openFriend} />,
        [openFriend]
    );

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <View style={{ gap: 2 }}>
                    <AppText variant="title">{tr("tabFriends")}</AppText>
                    {friends.length > 0 && (
                        <AppText variant="muted">{tr("friendsSubtitle", { count: friends.length })}</AppText>
                    )}
                </View>
                <TextField
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder={tr("searchFriendsPlaceholder")}
                    accessibilityLabel={tr("searchFriendsPlaceholder")}
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

            {loading && friends.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                    {progress.total > 0 && (
                        <AppText variant="muted">
                            {tr("searchingFriends", { current: progress.current, total: progress.total })}
                        </AppText>
                    )}
                </View>
            ) : (
                <PullToRefresh refreshing={refreshing} onRefresh={onRefresh} enabled={!syncing}>
                    <FlashList
                        data={filteredFriends}
                        keyExtractor={(item) => item.steamid}
                        renderItem={renderRow}
                        maintainVisibleContentPosition={{ disabled: true }}
                        contentContainerStyle={styles.listContent}
                        keyboardShouldPersistTaps="handled"
                        ListHeaderComponent={
                            !refreshing && syncing ? (
                                <View style={styles.syncCard} accessibilityRole="progressbar">
                                    <View style={styles.syncTop}>
                                        <ActivityIndicator size="small" color={COLORS.accent} />
                                        <AppText variant="muted" style={{ flex: 1 }}>
                                            {tr("loadingFriends", { current: progress.current, total: progress.total })}
                                        </AppText>
                                    </View>
                                    <ProgressBar value={progress.total ? (progress.current / progress.total) * 100 : 0} />
                                </View>
                            ) : null
                        }
                        ListEmptyComponent={
                            !loading ? (
                                <View style={styles.empty}>
                                    <View style={styles.emptyIcon}>
                                        <Ionicons name="people-outline" size={28} color={COLORS.accent} />
                                    </View>
                                    <AppText variant="body" style={{ textAlign: "center" }}>
                                        {searchQuery.trim()
                                            ? tr("friendsSearchNoResults")
                                            : (friendListError ? tr("profileFriendsPrivate") : tr("profileNoPublicFriends"))}
                                    </AppText>
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
    header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6, gap: 14 },
    clearButton: { width: 36, height: 44, marginRight: -10, alignItems: "center", justifyContent: "center" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
    // espaço no fim para a lista não ficar atrás da tab bar flutuante
    listContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 110 },
    syncCard: {
        padding: 14,
        marginBottom: 10,
        borderRadius: 16,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        gap: 10,
    },
    syncTop: { flexDirection: "row", alignItems: "center", gap: 10 },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        marginBottom: 8,
        borderRadius: 16,
        backgroundColor: COLORS.surface,
    },
    avatar: { width: 48, height: 48, borderRadius: 24 },
    avatarFallback: { backgroundColor: "#2B3550", alignItems: "center", justifyContent: "center" },
    initials: { fontFamily: FONTS.display, fontSize: 16, color: COLORS.text },
    statusDot: {
        position: "absolute",
        right: -1,
        bottom: -1,
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 3,
        borderColor: COLORS.surface,
    },
    rowBody: { flex: 1, minWidth: 0, gap: 3 },
    name: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.text },
    meta: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted },
    pill: {
        fontFamily: FONTS.bodySemibold,
        fontSize: 12,
        color: COLORS.accent,
        backgroundColor: COLORS.accentSoft,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        overflow: "hidden",
    },
    empty: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 12, gap: 12 },
    emptyIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: COLORS.accentSoft,
        alignItems: "center",
        justifyContent: "center",
    },
});
