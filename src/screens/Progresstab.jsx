import useAchievements from "@/src/hooks/useAchievements";
import { Image, Text, View } from "react-native";

export default function ProgressTab({ game }) {
    const { unlocked, total, percent } = useAchievements(game);

    return (
        <View className="flex-1 bg-gray-900 py-4">
            {/* Row with image + text */}
            <View className="flex-row items-center bg-gray-800 p-1 rounded-t mb-0">
                <Image
                    source={{
                        uri: `https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/header.jpg`,
                    }}
                    className="w-40 rounded"
                    style={{ aspectRatio: 460 / 215 }}
                    resizeMode="cover"
                />

                <View className="ml-4 flex-1">
                    <Text
                        className="text-white font-bold text-lg"
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        {game.name}
                    </Text>

                    {total > 0 ? (
                        <Text className="text-gray-300 text-sm mt-1">
                            {unlocked} de {total} desbloqueadas ({percent.toFixed(1)}%)
                        </Text>
                    ) : (
                        <Text className="text-gray-300 text-sm mt-1">
                            Jogo não possui conquistas
                        </Text>
                    )}
                </View>
            </View>

            {/* Progress Bar BELOW the image + text */}
            {total > 0 && (
                <View className="bg-gray-800 rounded-b px-1 pb-1">
                    <View className="w-full bg-gray-700 rounded-full h-2 mt-2">
                        <View
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${percent}%` }}
                        />
                    </View>
                </View>
            )}
        </View>
    );
}
