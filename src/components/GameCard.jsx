import { computeProgress } from "@/src/utils/achievements";
import { memo, useEffect, useState } from "react";
import { Image, Text, TouchableOpacity, View, useColorScheme } from "react-native";

const placeholderImage = require("../../assets/images/placeholder_gamelist.jpg");

function GameCardComponent({ game, navigation }) {
    const colorScheme = useColorScheme();
    const [imgFailed, setImgFailed] = useState(false);

    useEffect(() => {
        setImgFailed(false);
    }, [game.appid]);

    const styles = {
        cardBg: colorScheme === "dark" ? "bg-gray-800" : "bg-gray-100",
        titleText: colorScheme === "dark" ? "text-white" : "text-black",
        subtitleText: colorScheme === "dark" ? "text-gray-400" : "text-gray-600",
    };

    const { unlocked, total, percent } = computeProgress(game.achievements);

    return (
        <TouchableOpacity
            className={`${styles.cardBg} p-2 rounded-xl flex-row items-center mb-4`}
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
                <Text className={`${styles.titleText} text-lg font-bold`} numberOfLines={1}>
                    {game.name}
                </Text>
                <Text className={`${styles.subtitleText} text-sm mt-1`}>
                    {game.playtime_forever < 60
                        ? `${game.playtime_forever} minutos`
                        : `${Math.floor(game.playtime_forever / 60)} horas ${game.playtime_forever % 60} minutos`}
                </Text>

                {total > 0 && (
                    <>
                        <View className="w-full bg-gray-700 rounded-full h-2 mt-2">
                            <View
                                className="bg-green-500 h-2 rounded-full"
                                style={{ width: `${percent}%` }}
                            />
                        </View>
                        <Text className={`${styles.subtitleText} text-xs mt-1`}>
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
