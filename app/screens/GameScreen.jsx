import { useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { getOwnedGames } from "../../src/api/steam";
import GameCard from "../../src/components/GameCard";

export default function GameScreen({ navigation }) {
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getOwnedGames().then(data => {
            setGames(data);
            setLoading(false);
        });
    }, []);

    return (
        <View className="flex-1 bg-gray-900 p-4">
            <FlatList
                data={games}
                keyExtractor={(item) => item.appid.toString()}
                renderItem={({ item }) => (
                    <GameCard game={item} navigation={navigation} />
                )}
                contentContainerStyle={{ paddingBottom: 80 }}
            />
        </View>
    );

}
