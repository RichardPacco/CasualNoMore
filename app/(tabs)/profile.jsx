import { useRouter } from "expo-router";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, Linking, Pressable, Text, useColorScheme, View } from "react-native";
import { getFriendList, getOwnedGames, getPlayerSummary } from "../../src/api/steam";
import ProfileCard from "../../src/components/ProfileCard";
import { AuthContext } from "../../src/context/AuthContext";


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

        const loadProfile = useCallback(async () => {
            if (!steamId) {
                console.warn("[useProfile] No steamId provided");
                return;
            }

            // --- Load user profile ---
            console.log("[useProfile] Starting profile load...");
            setLoadingProfile(true);
            try {
                const data = await getPlayerSummary(steamId);
                console.log("[useProfile] Profile loaded:", data?.personaname);
                setProfile(data ?? null);
            } catch (err) {
                console.error("[useProfile] Failed to load profile:", err);
                setProfile(null);
            } finally {
                setLoadingProfile(false);
            }

            // --- Load friends progressively ---
            console.log("[useProfile] Starting friends load...");
            setLoadingFriends(true);
            try {
                const friendList = await getFriendList(steamId);
                console.log("[useProfile] Raw friend list:", friendList);

                const ids = friendList.map((f) => f.steamid) ?? [];
                console.log("[useProfile] Friend IDs:", ids);

                for (const id of ids) {
                    console.log(`[useProfile] Loading friend ${id}...`);
                    if (cancelledRef.current) {
                        console.log("[useProfile] Friends loading cancelled");
                        break;
                    }
                    try {
                        const [friendProfile, games] = await Promise.all([
                            getPlayerSummary(id),
                            getOwnedGames(id),
                        ]);

                        if (!friendProfile) {
                            console.warn(`[useProfile] Friend profile missing for ${id}`);
                            continue;
                        }

                        if (!games) {
                            console.warn(`[useProfile] Friend ${id} has no public games`);
                            continue;
                        }

                        console.log(`[useProfile] Friend loaded: ${friendProfile.personaname}, Games: ${games.game_count}`);

                        setFriends((prev) => [...prev, { steamid: id, profile: friendProfile, games }]);
                    } catch (e) {
                        console.warn(`[useProfile] Amigo ignorado: ${id}`, e.message);
                    }
                    await sleep(500)
                }
            } catch (err) {
                console.error("[useProfile] Failed to load friends:", err);
                setFriends([]);
            } finally {
                console.log("[useProfile] Friends load finished");
                setLoadingFriends(false);
            }
        }, [steamId]);

        useEffect(() => {
            loadProfile();
        }, [loadProfile]);

        return { profile, friends, loadingProfile, loadingFriends, loadProfile };
    }



    useEffect(() => {
        if (!steamId) {
            router.replace("/(auth)/login");
        }
    }, [steamId, router]);

    const { profile, friends, loadingProfile, loadingFriends, loadProfile } =
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
                        renderItem={({ item }) => (
                            <Pressable
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
