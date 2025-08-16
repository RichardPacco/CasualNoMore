import { useState, useEffect } from "react";
import { View, FlatList } from "react-native";
import GameCard from "../../src/components/GameCard";
import { getOwnedGames } from "../../src/api/steam"; // make sure this calls Steam API correctly

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
            />
        </View>
    );
}
