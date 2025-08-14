import { View, Text, Image, TouchableOpacity, Linking } from "react-native";

export default function GameCard({ game, navigation }) {
    return (
        <TouchableOpacity
            className="bg-gray-800 p-3 rounded-lg flex-row mb-3"
            onPress={() =>
                navigation.navigate("Achievements", { game }) // send game as param
            }
        >
            <Image
                source={{
                    uri: `https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/capsule_184x69.jpg`,
                }}
                className="w-24 h-10 rounded"
            />
            <View className="ml-3">
                <Text className="text-white font-semibold">{game.name}</Text>
                <Text className="text-gray-400 text-xs">
                    {Math.round(game.playtime_forever / 60)} horas
                </Text>
            </View>
        </TouchableOpacity>
    );
}