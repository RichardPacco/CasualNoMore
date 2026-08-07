import { getGameStoreDetails } from "@/src/api/steam";
import { AuthContext } from "@/src/context/AuthContext";
import { getGame, parseJson, saveGame } from "@/src/database/db";
import { getLanguageStore } from "@/src/i18n/langStore";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS } from "@/src/theme/colors";
import { useTheme } from "@/src/theme/styles";
import { useContext, useEffect, useState } from 'react';
import { Image, Linking, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import RenderHTML from 'react-native-render-html';


export default function GameDetailsTab({ game }) {
    const { steamId } = useContext(AuthContext);
    const { t: tr, language } = useLanguage();
    const cachedDetails = parseJson(game?.details);
    const [gameDetail, setGameDetail] = useState(cachedDetails);
    const { width } = useWindowDimensions();

    const t = useTheme();

    const [showFull, setShowFull] = useState(false);

    useEffect(() => {
        if (!game) return;

        let cancelled = false;
        const currentLang = getLanguageStore();
        const details = parseJson(game?.details);
        const staleGameDetails = details && game.lang !== currentLang;

        const loadDetails = async () => {
            // 1️⃣ Detalhes já no objeto do jogo
            if (details && !staleGameDetails) {
                setGameDetail(details);
                return;
            }

            // 2️⃣ Detalhes cacheados no banco
            let cached = null;
            if (steamId) {
                cached = await getGame(steamId, game.appid);
                if (cancelled) return;
            }
            if (cached?.details && cached.lang === currentLang) {
                setGameDetail(cached.details);
                return;
            }

            // 3️⃣ Busca na loja e persiste
            try {
                const details = await getGameStoreDetails(game.appid);
                if (cancelled) return;
                setGameDetail(details);
                if (details && steamId) {
                    await saveGame(steamId, { ...game, details, detailsStatus: "done", lang: currentLang });
                }
            } catch (err) {
                console.warn(`No Details for ${game.name}`, err);
            }
        };

        loadDetails();
        return () => {
            cancelled = true;
        };
    }, [game, steamId, language]);


    const openSteamPage = () => {
        const steamUrl = `https://store.steampowered.com/app/${game.appid}`;
        Linking.openURL(steamUrl).catch(err => console.error("Failed to open URL:", err));
    };

    return (
        <ScrollView className={`flex-1 ${t.pageBg}`} contentContainerStyle={{ paddingBottom: 70 }}>
            <View className={`flex-1 py-4 ${t.pageBg}`}>
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

                <TouchableOpacity
                    onPress={openSteamPage}
                    className="rounded-lg py-3 mb-3 flex-row items-center justify-center gap-2"
                    style={{ backgroundColor: COLORS.accent }}
                >
                    <Text style={{ color: '#0B1220', fontSize: 15, fontWeight: 'bold' }}>
                        {tr("viewInStore")}
                    </Text>
                </TouchableOpacity>

                <>
                    {(gameDetail?.short_description || gameDetail?.detailed_description) && (
                        <View className={`${t.cardBg} p-3 rounded-lg mb-3`}>
                            <RenderHTML
                                contentWidth={width}
                                source={{
                                    html: showFull
                                        ? gameDetail.detailed_description
                                        : gameDetail.short_description
                                }}
                                baseStyle={{ color: t.textInline, fontSize: 16 }}
                                ignoredDomTags={["video", "iframe", "source", "picture", "object", "embed", "noscript", "style", "script", "track"]}
                            />

                            {/* Read More / Read Less button */}
                            {gameDetail.detailed_description && (
                                <TouchableOpacity
                                    onPress={() => setShowFull(!showFull)}
                                    className="mt-2"
                                >
                                    <Text style={{ color: '#60A5FA', fontSize: 14, fontWeight: 'bold' }}>
                                        {showFull ? tr("readLess") : tr("readMore")}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </>

                {gameDetail?.genres && (
                    <View className={`${t.cardBg} p-3 rounded-lg mb-3`}>
                        {/* Title */}
                        <Text style={{ color: t.textInline, fontSize: 10, fontWeight: 'bold', marginBottom: 4 }}>
                            {tr("genre")}
                        </Text>

                        {/* Genre list */}
                        <Text style={{ color: t.textInline, fontSize: 16 }}>
                            {gameDetail.genres.map((genre) => genre.description).join(", ")}
                        </Text>
                    </View>
                )}
                <View className="flex-row gap-3 mb-3">
                    {gameDetail?.release_date && (
                        <View className={`${t.cardBg} p-3 rounded-lg flex-1`}>
                            {/* Title */}
                            <Text style={{ color: t.textInline, fontSize: 10, fontWeight: 'bold', marginBottom: 4 }}>
                                {tr("release")}
                            </Text>

                            {/* Release Date */}
                            <Text style={{ color: t.textInline, fontSize: 16 }}>
                                {gameDetail.release_date.date}
                            </Text>
                        </View>
                    )}

                    <View className={`${t.cardBg} p-3 rounded-lg flex-1`}>
                        {/* Title */}
                        <Text style={{ color: t.textInline, fontSize: 10, fontWeight: 'bold', marginBottom: 4 }}>
                            MetaCritic
                        </Text>

                        {gameDetail?.metacritic?.score ? (
                            <Text style={{ color: t.textInline, fontSize: 16 }}>
                                {gameDetail.metacritic.score}
                            </Text>
                        ) : (
                            <Text style={{ color: t.textInline, fontSize: 16 }}>
                                -
                            </Text>
                        )}
                    </View>

                </View>


            </View>
        </ScrollView >
    );

}
