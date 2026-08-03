import { computeProgress } from "@/src/utils/achievements";
import { memo, useEffect, useState } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/src/theme/styles";

const placeholderImage = require("../../assets/images/placeholder_gamelist.jpg");

function GameCardComponent({ game, navigation }) {
    const t = useTheme();
    const [imgFailed, setImgFailed] = useState(false);

    useEffect(() => {
        setImgFailed(false);
    }, [game.appid]);

    const { unlocked, total, percent } = computeProgress(game.achievements);

    return (
        <TouchableOpacity
            className={`${t.cardBg} p-2 rounded-xl flex-row items-center mb-4`}
            onPress={() => navigation.navigate("GameScreen", { game })}
        >
            <Image
                source={imgFailed
                    ? placeholderImage
                    : {
                        uri: `https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/capsule_231x87.jpg`,
                    }}
                onError={() => setImgFailed(true)}
                className="w-40 h-20 rounded-md"
                style={{ aspectRatio: 231 / 87 }}
                resizeMode="cover"
            />

            <View className="ml-4 flex-1">
                <Text className={`${t.textPrimary} text-lg font-bold`} numberOfLines={1}>
                    {game.name}
                </Text>
                <Text className={`${t.textSecondary} text-sm mt-1`}>
                    {game.playtime_forever < 60
                        ? `${game.playtime_forever} minutos`
                        : `${Math.floor(game.playtime_forever / 60)} horas ${game.playtime_forever % 60} minutos`}
                </Text>

                {total > 0 && (
                    <>
                        <View className={`w-full ${t.progressTrack} rounded-full h-2 mt-2`}>
                            <View
                                className="bg-accent h-2 rounded-full"
                                style={{ width: `${percent}%` }}
                            />
                        </View>
                        <Text className={`${t.textSecondary} text-xs mt-1`}>
                            {unlocked}/{total} conquistas ({percent.toFixed(1)}%)
                        </Text>
                    </>
                )}
            </View>
        </TouchableOpacity>
    );
}

export default memo(GameCardComponent, (prevProps, nextProps) => {
    return prevProps.game === nextProps.game && prevProps.navigation === nextProps.navigation;
});
