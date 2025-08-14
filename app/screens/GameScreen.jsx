import { useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator } from "react-native";
import { getOwnedGames } from "../../src/api/steam";
import GameCard from "../../src/components/GameCard";

export default function GamesScreen() {
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getOwnedGames().then(data => {
            setGames(data);
            setLoading(false);
        });
    }, []);

    if (loading) return <ActivityIndicator size="large" className="mt-10" />;

    return (
        <ScrollView className="flex-1 bg-gray-900 p-4">
            {games.map(game => <GameCard key={game.appid} game={game} />)}
        </ScrollView>
    );
}
