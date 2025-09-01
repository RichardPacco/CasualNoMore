import { GetGlobalAchievementsPercentagesForApp, getPlayerAchievements } from "@/src/api/steam";
import { useContext, useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { AuthContext } from "../../src/context/AuthContext";


export default function ProgressTab({ game }) {

    const { steamId } = useContext(AuthContext)

    const [cheevos, setCheevos] = useState([]);
    const [schema, setSchema] = useState(null);
    const [globalPercentages, setGlobalPercentages] = useState([])
    const [mergedCheevos, setMergedCheevos] = useState([]);


    useEffect(() => {
        if (!game?.appid) return;
        // console.log('GAME', game)
        async function fetchAll() {
            try {
                const schemaData = game.schema || [];
                // Try fetching player achievements, fallback to empty array
                let playerAchievements = { achievements: [] };
                try {
                    playerAchievements = await getPlayerAchievements(game.appid, steamId);
                } catch (err) {
                    console.warn(`No player achievements for ${game.name}`, err);
                }

                // Try fetching global percentages, fallback to empty
                let globalPerc = [];
                try {
                    globalPerc = await GetGlobalAchievementsPercentagesForApp(game.appid);
                } catch (err) {
                    console.warn(`No global percentages for ${game.name}`, err);
                }

                const achievementsList = playerAchievements?.achievements || [];
                setCheevos(achievementsList);
                setSchema(schemaData);
                setGlobalPercentages(globalPerc || []);

                // Merge achievements only if schema exists
                if (schemaData.length > 0) {
                    const achievementsMap = {};
                    achievementsList.forEach(a => {
                        achievementsMap[a.apiname] = a.achieved === 1;
                    });

                    const percentMap = {};
                    (globalPerc || []).forEach(p => {
                        percentMap[p.name.toLowerCase()] = p.percent;
                    });

                    const merged = schemaData.map(ach => ({
                        name: ach.displayName,
                        description: ach.description,
                        icon: achievementsMap[ach.name] ? ach.icon : ach.icongray,
                        achieved: achievementsMap[ach.name] || false,
                        globalPercent: percentMap[ach.name.toLowerCase()] || 0
                    }));

                    merged.sort((a, b) => b.globalPercent - a.globalPercent);
                    setMergedCheevos(merged);
                } else {
                    setMergedCheevos([]); // No achievements
                }

            } catch (err) {
                console.error("Error fetching achievements for", game.name, err);
            }
        }

        fetchAll();
    }, [game?.appid, steamId]);

    const total = game.schema?.length ?? 0;
    const unlocked = mergedCheevos.filter(a => a.achieved).length;
    const percent = total > 0 ? (unlocked / total) * 100 : 0;

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
