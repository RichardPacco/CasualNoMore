import { getFriendList, getOwnedGames, getPlayerSummary } from "@/src/api/steam";
import ContextMenu from "@/src/components/ContextMenu";
import PullToRefresh from "@/src/components/PullToRefresh";
import SearchBar from "@/src/components/SearchBar";
import { AuthContext } from "@/src/context/AuthContext";
import { loadFriend, saveFriendsBatch } from "@/src/database/db";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS } from "@/src/theme/colors";
import { useTheme } from "@/src/theme/styles";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";

function gamesSignature(games) {
    return (games?.games ?? [])
        .map(g => g.appid)
        .sort((a, b) => a - b)
        .join(",");
}

function friendChanged(prev, next) {
    if (prev.profile?.personaname !== next.profile?.personaname) return true;
    if (prev.profile?.avatarfull !== next.profile?.avatarfull) return true;
    if ((prev.games?.game_count ?? 0) !== (next.games?.game_count ?? 0)) return true;
    if (gamesSignature(prev.games) !== gamesSignature(next.games)) return true;
    return false;
}

// Busca um amigo por completo (perfil + jogos + jogos em comum)
async function fetchFriendData(id, myGames) {
    const [friendProfile, games] = await Promise.all([
        getPlayerSummary(id),
        getOwnedGames(id),
    ]);
    if (!friendProfile || !games) return null;

    const commonGames = myGames.filter(myGame =>
        games.games?.some(friendGame => friendGame.appid === myGame.appid)
    );

    return { steamId: id, profile: friendProfile, games, commonGames };
}

export default function Friends({ navigation }) {
    const { steamId } = useContext(AuthContext);
    const { t: tr } = useLanguage();
    const t = useTheme();
    const isDark = t.isDark;

    const [friends, setFriends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [friendListError, setFriendListError] = useState(false);
    const [menu, setMenu] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");

    const cancelledRef = useRef(false);
    const containerRef = useRef(null);
    const myGamesRef = useRef([]);
    const friendsRef = useRef([]);

    useEffect(() => {
        friendsRef.current = friends;
    }, [friends]);

    useEffect(() => {
        cancelledRef.current = !steamId;
    }, [steamId]);

    const openContextMenu = (e, item) => {
        const { pageX, pageY } = e.nativeEvent;
        // Converte coordenadas da janela (pageX/pageY) para o sistema de
        // coordenadas do container (leva em conta safe area / status bar).
        containerRef.current?.measureInWindow((cx, cy, cw, ch) => {
            setMenu({ x: pageX - cx, y: pageY - cy, width: cw, height: ch, friend: item, });
        });
    };

    const closeContextMenu = () => {
        setMenu(null);
    };

    // Busca progressiva dos dados frescos dos amigos (perfil + jogos + jogos em comum).
    // Busca em paralelo (poucos por vez) e atualiza a UI + persistência em lotes
    // (reduz re-renders e I/O), espelhando o padrão da lista de jogos.
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

        const total = friendIds.length;
        setProgress({ current: friendList.length, total });

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

            // Só faz o fetch completo quando não há cache (evita refazer tudo ao reentrar)
            if (cachedFriends.length === 0) {
                await refreshFriends(friendIds);
            }
        } catch (err) {
            console.error("[Friends] Failed to load:", err);
        } finally {
            setLoading(false);
        }
    }, [steamId, refreshFriends]);

    // Pull-to-refresh: re-fetcha amigos (jogos + comuns)
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

    const textPrimary = t.textPrimary;
    const textSecondary = t.textSecondary;
    const friendCardBg = t.elevatedCardBg;
    const friendCardBorder = t.cardBorder;

    return (
        <View ref={containerRef} className={`flex-1 p-4 ${t.pageBg}`}>
            <Text className={`text-xl font-bold mb-4 ${t.textHeader}`}>
                {tr("profileFriendsTitle")}
            </Text>

            <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={tr("searchFriendsPlaceholder")}
            />

            {loading && friends.length === 0 ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color={isDark ? COLORS.accent : "#000"} />
                    {progress.total > 0 && (
                        <Text className={`${t.textSecondary} mt-2`}>
                            {tr("searchingFriends", { current: progress.current, total: progress.total })}
                        </Text>
                    )}
                </View>
            ) : (
                <PullToRefresh refreshing={refreshing} onRefresh={onRefresh} enabled={progress.current >= progress.total}>
                    <FlashList
                        data={filteredFriends}
                        keyExtractor={(item) => item.steamid}
                        maintainVisibleContentPosition={{ disabled: true }}
                        contentContainerStyle={{ paddingBottom: 70 }}
                        ListHeaderComponent={
                            !refreshing && progress.current < progress.total && (
                                <View className="py-4 items-center">
                                    <ActivityIndicator size="small" color={COLORS.accent} />
                                    <Text className={`${t.textSecondary} mt-2`}>
                                        {tr("loadingFriends", { current: progress.current, total: progress.total })}
                                    </Text>
                                </View>
                            )
                        }
                        renderItem={({ item }) => (
                            <Pressable
                                onPress={(e) => openContextMenu(e, item)}
                                className={`flex-row items-center ${friendCardBg} ${friendCardBorder} border rounded-xl p-3 mb-2`}
                            >
                                <Image
                                    source={{ uri: item.profile?.avatarfull }}
                                    className="w-12 h-12 rounded-full mr-3"
                                />
                                <View className="flex-1">
                                    <Text className={`${textPrimary} text-lg`}>
                                        {item.profile?.personaname}
                                    </Text>
                                    <Text className={`${textSecondary} text-sm`}>
                                        {tr("profileGamesCount", { count: item.games?.game_count ?? 0 })}
                                    </Text>
                                    <Text className={`${textSecondary} text-sm`}>
                                        {tr("profileCommonGamesCount", { count: item.commonGames?.length ?? 0 })}
                                    </Text>
                                </View>
                            </Pressable>
                        )}
                        ListEmptyComponent={
                            !loading && (
                                <Text className={`${textSecondary} text-center mt-4`}>
                                    {searchQuery.trim()
                                        ? tr("friendsSearchNoResults")
                                        : (friendListError ? tr("profileFriendsPrivate") : tr("profileNoPublicFriends"))}
                                </Text>
                            )
                        }
                    />
                </PullToRefresh>
            )}

            <ContextMenu
                visible={!!menu}
                x={menu?.x ?? 0}
                y={menu?.y ?? 0}
                bounds={{ width: menu?.width, height: menu?.height }}
                title={menu?.friend?.profile?.personaname}
                onClose={closeContextMenu}
                options={[
                    {
                        label: tr("friendCommonGames"),
                        icon: "people-outline",
                        onPress: () => {
                            if (menu) navigation.navigate("CommonGames", { friend: menu.friend, mode: "common" });
                        },
                    },
                    {
                        label: tr("friendOwnGames"),
                        icon: "game-controller-outline",
                        onPress: () => {
                            if (menu) navigation.navigate("CommonGames", { friend: menu.friend, mode: "all" });
                        },
                    },
                ]}
            />
        </View>
    );
}
