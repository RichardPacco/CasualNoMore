import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { memo, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { getUsersFollowingMe, getUsersIFollow, raUserPic } from "@/src/api/retroachievements";
import PullToRefresh from "@/src/components/PullToRefresh";
import { AppText, Button, Chip, TextField } from "@/src/components/ui";
import Pressable from "@/src/components/ui/Pressable";
import { AuthContext } from "@/src/context/AuthContext";
import { getRaFriends, saveRaFriends } from "@/src/database/raDb";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";

/**
 * Junta "seguindo" e "seguidores" numa lista só, por ULID, marcando a
 * relação: following (eu sigo), follower (me segue) ou mutual (os dois).
 */
function mergeRelations(following, followers) {
    const byId = new Map();
    for (const u of following) {
        byId.set(u.ULID, { ulid: u.ULID, user: u.User, points: Number(u.Points) || 0, following: true, follower: !!u.IsFollowingMe });
    }
    for (const u of followers) {
        const prev = byId.get(u.ULID);
        if (prev) prev.follower = true;
        else byId.set(u.ULID, { ulid: u.ULID, user: u.User, points: Number(u.Points) || 0, following: !!u.AmIFollowing, follower: true });
    }
    return [...byId.values()].sort((a, b) => b.points - a.points);
}

/** Linha de um usuário do RA: avatar, nome, pontos hardcore e selo "Mútuo". */
const RaFriendRow = memo(function RaFriendRow({ friend, onPress }) {
    const { t: tr } = useLanguage();
    const mutual = friend.following && friend.follower;
    return (
        <Pressable
            onPress={() => onPress(friend)}
            accessibilityRole="button"
            accessibilityLabel={[friend.user, tr("points", { n: friend.points }), mutual ? tr("mutual") : null].filter(Boolean).join(", ")}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}
        >
            <Image source={{ uri: raUserPic(friend.user) }} style={styles.avatar} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={styles.name} numberOfLines={1}>{friend.user}</Text>
                <Text style={styles.points}>{tr("points", { n: friend.points.toLocaleString() })}</Text>
            </View>
            {mutual && <Text style={styles.mutual}>{tr("mutual")}</Text>}
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </Pressable>
    );
});

/**
 * Amigos do RetroAchievements: o RA não tem lista de amigos, e sim
 * "seguindo" e "seguidores" (sempre da conta dona da key). Chips para
 * escolher entre os dois, busca por nome e o selo "Mútuo".
 * A lista salva no banco aparece na hora e é atualizada em seguida.
 * Tocar abre os jogos do amigo (RaCommonGames).
 * Props: navigation, header (elemento acima da busca, ex.: seletor de plataforma).
 */
export default function RaFriends({ navigation, header = null }) {
    const { t: tr } = useLanguage();
    const { accounts } = useContext(AuthContext);
    const ulid = accounts.ra?.ulid;
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(false);
    const [relation, setRelation] = useState("following");
    const [query, setQuery] = useState("");

    /** Busca as duas listas no RA e grava no banco. */
    const load = useCallback(async () => {
        try {
            const [following, followers] = await Promise.all([getUsersIFollow(), getUsersFollowingMe()]);
            const merged = mergeRelations(following.results, followers.results);
            setList(merged);
            setError(false);
            if (ulid) await saveRaFriends(ulid, merged);
        } catch (err) {
            console.warn("[RaFriends] falhou", err?.message);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [ulid]);

    // Primeiro o banco (aparece na hora), depois a API
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (ulid) {
                const cached = await getRaFriends(ulid);
                if (cancelled) return;
                if (cached.length > 0) {
                    setList(cached);
                    setLoading(false);
                }
            }
            if (!cancelled) load();
        })();
        return () => { cancelled = true; };
    }, [ulid, load]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try { await load(); } finally { setRefreshing(false); }
    }, [load]);

    const counts = useMemo(() => ({
        following: list.filter(f => f.following).length,
        followers: list.filter(f => f.follower).length,
    }), [list]);

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return list
            .filter(f => relation === "following" ? f.following : f.follower)
            .filter(f => !q || f.user.toLowerCase().includes(q));
    }, [list, relation, query]);

    const openFriend = useCallback((friend) => {
        navigation.navigate("RaCommonGames", { friendUlid: friend.ulid, friendUser: friend.user });
    }, [navigation]);

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <AppText variant="title">{tr("tabFriends")}</AppText>
                {header}
                <TextField
                    value={query}
                    onChangeText={setQuery}
                    placeholder={tr("searchFriendsPlaceholder")}
                    accessibilityLabel={tr("searchFriendsPlaceholder")}
                    returnKeyType="search"
                    left={<Ionicons name="search" size={18} color={COLORS.textMuted} />}
                />
                <View style={styles.chips}>
                    <Chip label={tr("following")} count={counts.following} selected={relation === "following"} onPress={() => setRelation("following")} />
                    <Chip label={tr("followers")} count={counts.followers} selected={relation === "followers"} onPress={() => setRelation("followers")} />
                </View>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={COLORS.accent} /></View>
            ) : (
                <PullToRefresh refreshing={refreshing} onRefresh={onRefresh}>
                    <FlashList
                        data={shown}
                        keyExtractor={(item) => item.ulid}
                        renderItem={({ item }) => <RaFriendRow friend={item} onPress={openFriend} />}
                        contentContainerStyle={styles.listContent}
                        keyboardShouldPersistTaps="handled"
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <AppText variant="body" style={{ textAlign: "center" }}>
                                    {error ? tr("raConnectionError") : query.trim() ? tr("friendsSearchNoResults") : tr("raNoFriends")}
                                </AppText>
                                {error && <Button label={tr("profileRetry")} onPress={onRefresh} loading={refreshing} />}
                            </View>
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
    chips: { flexDirection: "row", gap: 8 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
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
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.surface2 },
    name: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.text },
    points: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.gold },
    mutual: {
        fontFamily: FONTS.bodySemibold,
        fontSize: 11,
        color: COLORS.accent,
        backgroundColor: COLORS.accentSoft,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        overflow: "hidden",
    },
    empty: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 12, gap: 12 },
});
