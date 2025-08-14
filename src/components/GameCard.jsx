import { View, Text, Image } from "react-native";

export default function GameCard({ game }) {
    return (
        <View className="bg-gray-800 p-3 rounded-lg flex-row mb-3">
            <Image source={{ uri: `https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/capsule_184x69.jpg` }} className="w-24 h-10 rounded" />
            <View className="ml-3">
                <Text className="text-white font-semibold">{game.name}</Text>
                <Text className="text-gray-400 text-xs">{Math.round(game.playtime_forever / 60)} horas</Text>
            </View>
        </View>
    );
}
