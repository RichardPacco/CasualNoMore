import { useRouter } from "expo-router";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, Linking, Pressable, RefreshControl, Text, useColorScheme, View } from "react-native";
import { getFriendList, getOwnedGames, getPlayerSummary } from "@/src/api/steam";
import ProfileCard from "@/src/components/ProfileCard";
import { AuthContext } from "@/src/context/AuthContext";
import { loadFriend, saveFriendProfile } from "@/src/database/db";


export default function Profile() {
    const router = useRouter();
    const { steamId } = useContext(AuthContext);

    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

    const pageBg = isDark ? "bg-gray-900" : "bg-gray-100";
    const placeholderBg = isDark ? "bg-gray-800" : "bg-white";
    const placeholderText = isDark ? "text-gray-300" : "text-gray-700";
    const buttonBg = isDark ? "bg-blue-600" : "bg-blue-500";
    const buttonText = "text-white";

    const cancelledRef = useRef(false);

    useEffect(() => {
        // Se o usuário fizer logout, marca como cancelado
        if (!steamId) {
            cancelledRef.current = true;
        } else {
            cancelledRef.current = false;
        }
    }, [steamId]);

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function useProfile(steamId) {
        const [profile, setProfile] = useState(null);
        const [friends, setFriends] = useState([]);
        const [loadingProfile, setLoadingProfile] = useState(true);
        const [loadingFriends, setLoadingFriends] = useState(false);
        const myGamesRef = useRef([]);

        // Busca progressiva dos dados frescos dos amigos (perfil + jogos + jogos em comum)
        const refreshFriends = useCallback(async (friendIds) => {
            if (cancelledRef.current) return;
            setLoadingFriends(true);
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
                    } catch (e) {
                        console.warn(`[useProfile] Friend ignored: ${id}`, e.message);
                    }

                    await sleep(250); // throttle API calls
                }
            } catch (err) {
                console.error("[useProfile] Failed to refresh friends:", err);
            } finally {
                setLoadingFriends(false);
            }
        }, [steamId]);

        const loadProfile = useCallback(async () => {
            if (!steamId) return;
            setLoadingProfile(true);

            // --- Load own profile ---
            try {
                const [Profile, Games] = await Promise.all([
                    getPlayerSummary(steamId),
                    getOwnedGames(steamId),
                ]);
                myGamesRef.current = Games?.games ?? [];
                setProfile(Profile ?? null);
            } catch (err) {
                console.error("[useProfile] Failed to load profile:", err);
                setProfile(null);
            } finally {
                setLoadingProfile(false);
            }

            // --- Load cached friends first ---
            setLoadingFriends(true);
            try {
                const friendList = await getFriendList(steamId);
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
                console.error("[useProfile] Failed to load friends:", err);
            } finally {
                setLoadingFriends(false);
            }
        }, [steamId, refreshFriends]);

        // Pull-to-refresh: re-fetcha os amigos (perfil + jogos + comuns)
        const onRefreshFriends = useCallback(async () => {
            const friendList = await getFriendList(steamId);
            const friendIds = (friendList ?? []).map(f => f.steamid);
            await refreshFriends(friendIds);
        }, [steamId, refreshFriends]);

        useEffect(() => {
            loadProfile();
        }, [loadProfile]);

        return { profile, friends, loadingProfile, loadingFriends, loadProfile, onRefreshFriends };
    }



    useEffect(() => {
        if (!steamId) {
            router.replace("/(auth)/login");
        }
    }, [steamId, router]);

    const { profile, friends, loadingProfile, loadingFriends, loadProfile, onRefreshFriends } =
        useProfile(steamId);

    if (loadingProfile) {
        return (
            <View className={`flex-1 items-center justify-center ${pageBg}`}>
                <ActivityIndicator size="large" color={isDark ? "#fff" : "#000"} />
            </View>
        );
    }

    return (
        <View className={`flex-1 p-4 ${pageBg}`}>
            {profile ? (
                <>
                    <ProfileCard data={profile} />

                    <Text className="text-xl font-bold mt-6 mb-2 text-gray-200">
                        Amigos (Lista de Jogos Pública)
                    </Text>

                    {loadingFriends && (
                        <ActivityIndicator
                            size="small"
                            color={isDark ? "#fff" : "#000"}
                            style={{ marginBottom: 10 }}
                        />
                    )}

                    <FlatList
                        data={friends}
                        keyExtractor={(item) => item.steamid}
                        renderItem={({ item }) => (                            <Pressable
                                onPress={() =>
                                    Linking.openURL(
                                        `https://steamcommunity.com/profiles/${item.steamid}`
                                    )
                                }
                                className="flex-row items-center bg-gray-800 rounded-xl p-3 mb-2"
                            >
                                <Image
                                    source={{ uri: item.profile?.avatarfull }}
                                    className="w-12 h-12 rounded-full mr-3"
                                />
                                <View className="flex-1">
                                    <Text className="text-white text-lg">
                                        {item.profile?.personaname}
                                    </Text>
                                    <Text className="text-gray-400 text-sm">
                                        Jogos: {item.games?.game_count ?? 0}
                                    </Text>
                                    <Text className="text-gray-400 text-sm">
                                        Jogos em comum: {item.commonGames?.length ?? 0}
                                    </Text>

                                </View>
                            </Pressable>
                        )}
                        ListEmptyComponent={
                            !loadingFriends && (
                                <Text className="text-gray-400 text-center mt-4">
                                    Nenhum amigo com jogos públicos encontrado
                                </Text>
                            )
                        }
                        refreshControl={
                            <RefreshControl
                                refreshing={loadingFriends}
                                onRefresh={onRefreshFriends}
                                colors={["#4ade80"]}
                                tintColor={isDark ? "#4ade80" : "#16a34a"}
                            />
                        }
                    />
                </>
            ) : (
                <View
                    className={`${placeholderBg} rounded-xl overflow-hidden p-6 items-center`}
                >
                    <Text className={`text-lg font-semibold mb-2 ${placeholderText}`}>
                        Perfil não disponível
                    </Text>
                    <Text className={`mb-4 ${placeholderText}`}>
                        Ocorreu um erro ao carregar o perfil. Verifique sua conexão.
                    </Text>
                    <Pressable
                        className={`${buttonBg} px-6 py-2 rounded-lg`}
                        onPress={loadProfile}
                    >
                        <Text className={`text-center font-bold ${buttonText}`}>
                            Tentar novamente
                        </Text>
                    </Pressable>
                </View>
            )}
        </View>
    );
}
