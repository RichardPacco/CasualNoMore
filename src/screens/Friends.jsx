import { getFriendList, getOwnedGames, getPlayerSummary } from "@/src/api/steam";
import ContextMenu from "@/src/components/ContextMenu";
import PullToRefresh from "@/src/components/PullToRefresh";
import SearchBar from "@/src/components/SearchBar";
import { AuthContext } from "@/src/context/AuthContext";
import { loadFriend, saveFriendProfile } from "@/src/database/db";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS } from "@/src/theme/colors";
import { useTheme } from "@/src/theme/styles";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from "react-native";

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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default function Friends({ navigation }) {
    const { steamId } = useContext(AuthContext);
    const { t: tr } = useLanguage();
    const t = useTheme();
    const isDark = t.isDark;

    const [friends, setFriends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
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

    // Busca progressiva dos dados frescos dos amigos (perfil + jogos + jogos em comum)
    const refreshFriends = useCallback(async (friendIds) => {
        if (cancelledRef.current) return;
        setLoading(true);
        try {
            for (const id of friendIds) {
                if (cancelledRef.current) break;

                try {
                    const [friendProfile, games] = await Promise.all([
                        getPlayerSummary(id),
                        getOwnedGames(id),
                    ]);

                    if (!friendProfile || !games) continue;

                    const commonGames = myGamesRef.current.filter(myGame =>
                        games.games?.some(friendGame => friendGame.appid === myGame.appid)
                    );

                    const friendData = { steamId: id, profile: friendProfile, games, commonGames };

                    // Só atualiza se algo mudou (espelha o comportamento da lista de jogos)
                    const existing = friendsRef.current.find(f => f.steamid === id);
                    if (existing && !friendChanged(existing, friendData)) {
                        continue; // nada de novo, pula persistência e state
                    }

                    // Persist in DB
                    await saveFriendProfile(steamId, friendData);

                    // Update state progressively
                    setFriends(prev => {
                        const index = prev.findIndex(f => f.steamid === id);
                        if (index !== -1) {
                            const copy = [...prev];
                            copy[index] = { steamid: id, ...friendData };
                            return copy;
                        } else {
                            return [...prev, { steamid: id, ...friendData }];
                        }
                    });

                    await sleep(250); // throttle API calls
                } catch (e) {
                    console.warn(`[Friends] Friend ignored: ${id}`, e.message);
                }
            }
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

            const cachedFriends = [];
            for (const id of friendIds) {
                const cached = await loadFriend(steamId, id);
                if (cached) {
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
                </View>
            ) : (
                <PullToRefresh refreshing={refreshing} onRefresh={onRefresh}>
                    <FlatList
                        data={filteredFriends}
                        keyExtractor={(item) => item.steamid}
                        contentContainerStyle={{ paddingBottom: 70 }}
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
