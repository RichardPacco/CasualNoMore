import { useContext, useEffect, useState } from 'react';
import { Image, Linking, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import RenderHTML from 'react-native-render-html';
import { getGameStoreDetails } from "@/src/api/steam";
import { AuthContext } from "@/src/context/AuthContext";
import { getGame, saveGame } from "@/src/database/db";


export default function GameDetailsTab({ game }) {
    const { steamId } = useContext(AuthContext);
    const [gameDetail, setGameDetail] = useState(game?.details ?? null);
    const { width } = useWindowDimensions();

    const [showFull, setShowFull] = useState(false);

    useEffect(() => {
        if (!game) return;

        let cancelled = false;

        const loadDetails = async () => {
            // 1️⃣ Detalhes já no objeto do jogo
            if (game.details) {
                setGameDetail(game.details);
                return;
            }

            // 2️⃣ Detalhes cacheados no banco
            let cached = null;
            if (steamId) {
                cached = await getGame(steamId, game.appid);
                if (cancelled) return;
            }
            if (cached?.details) {
                setGameDetail(cached.details);
                return;
            }

            // 3️⃣ Busca na loja e persiste
            try {
                const details = await getGameStoreDetails(game.appid);
                if (cancelled) return;
                setGameDetail(details);
                if (details && steamId) {
                    await saveGame(steamId, { ...game, details, detailsStatus: "done" });
                }
            } catch (err) {
                console.warn(`No Details for ${game.name}`, err);
            }
        };

        loadDetails();
        return () => {
            cancelled = true;
        };
    }, [game, steamId]);


    const openSteamPage = () => {
        const steamUrl = `https://store.steampowered.com/app/${game.appid}`;
        Linking.openURL(steamUrl).catch(err => console.error("Failed to open URL:", err));
    };

    return (
        <ScrollView className="flex-1 bg-gray-900">
            <View className="flex-1 py-4 bg-gray-900">
                <TouchableOpacity onPress={openSteamPage}>

                    <Image
                        source={{ uri: `https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/header.jpg` }}
                        style={{
                            width: "100%",
                            aspectRatio: 460 / 215,
                            borderRadius: 12,
                            marginBottom: 16,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.5,
                            shadowRadius: 4,
                            elevation: 5,
                        }}
                        resizeMode="cover"
                    />
                </TouchableOpacity>

                <>
                    {(gameDetail?.short_description || gameDetail?.detailed_description) && (
                        <View className="bg-gray-800 p-3 rounded-lg mb-3">
                            <RenderHTML
                                contentWidth={width}
                                source={{
                                    html: showFull
                                        ? gameDetail.detailed_description
                                        : gameDetail.short_description
                                }}
                                baseStyle={{ color: 'white', fontSize: 16 }}
                            />

                            {/* Read More / Read Less button */}
                            {gameDetail.detailed_description && (
                                <TouchableOpacity
                                    onPress={() => setShowFull(!showFull)}
                                    className="mt-2"
                                >
                                    <Text style={{ color: '#60A5FA', fontSize: 14, fontWeight: 'bold' }}>
                                        {showFull ? "Minimizar" : "Ler Mais"}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </>

                {gameDetail?.genres && (
                    <View className="bg-gray-800 p-3 rounded-lg mb-3">
                        {/* Title */}
                        <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold', marginBottom: 4 }}>
                            Gênero
                        </Text>

                        {/* Genre list */}
                        <Text style={{ color: 'white', fontSize: 16 }}>
                            {gameDetail.genres.map((genre) => genre.description).join(", ")}
                        </Text>
                    </View>
                )}
                <View className="flex-row gap-3 mb-3">
                    {gameDetail?.release_date && (
                        <View className="bg-gray-800 p-3 rounded-lg flex-1">
                            {/* Title */}
                            <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold', marginBottom: 4 }}>
                                Lançamento
                            </Text>

                            {/* Release Date */}
                            <Text style={{ color: 'white', fontSize: 16 }}>
                                {gameDetail.release_date.date}
                            </Text>
                        </View>
                    )}

                    <View className="bg-gray-800 p-3 rounded-lg flex-1">
                        {/* Title */}
                        <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold', marginBottom: 4 }}>
                            MetaCritic
                        </Text>

                        {gameDetail?.metacritic?.score ? (
                            <Text style={{ color: 'white', fontSize: 16 }}>
                                {gameDetail.metacritic.score}
                            </Text>
                        ) : (
                            <Text style={{ color: 'white', fontSize: 16 }}>
                                -
                            </Text>
                        )}
                    </View>

                </View>


            </View>
        </ScrollView >
    );

}
