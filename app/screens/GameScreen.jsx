import { useContext, useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { getOwnedGames } from "../../src/api/steam";
import GameCard from "../../src/components/GameCard";
import { AuthContext } from "../../src/context/AuthContext";


export default function GameScreen({ navigation }) {
    const { steamId } = useContext(AuthContext)
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getOwnedGames(steamId).then(data => {
            console.log(data.games.filter(game => game.playtime_forever = 0));
            setGames(data.games.filter(game => game.playtime_forever = 0));
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
