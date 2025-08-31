import { GetGlobalAchievementsPercentagesForApp, getPlayerAchievements } from "@/src/api/steam";
import { AuthContext } from "@/src/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { useContext, useEffect, useState } from "react";
import { FlatList, Image, Modal, Text, TouchableOpacity, View } from "react-native";

export default function AchievementScreen({ route, navigation }) {
    const { steamId } = useContext(AuthContext)
    const { game } = route.params || {};

    const [cheevos, setCheevos] = useState([]);
    const [schema, setSchema] = useState(null);
    const [globalPercentages, setGlobalPercentages] = useState([])
    const [mergedCheevos, setMergedCheevos] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);


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
                    // console.log('PLAYERACHIEVEMENTS', playerAchievements.achievements);
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




    return (
        <View className="flex-1 bg-gray-900 p-4">

            <Modal
                transparent
                animationType="fade"
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <TouchableOpacity
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        justifyContent: 'flex-start',
                        alignItems: 'flex-end',
                    }}
                    activeOpacity={1}
                    onPressOut={() => setModalVisible(false)}
                >
                    <View
                        style={{
                            width: 150,
                            backgroundColor: '#1F2937', // dark gray
                            marginTop: 60, // adjust to appear below status bar
                            marginRight: 16,
                            borderRadius: 8,
                            paddingVertical: 8,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.25,
                            shadowRadius: 4,
                            elevation: 5,
                        }}
                    >
                        <TouchableOpacity
                            onPress={() => { console.log('Option 1'); setModalVisible(false); }}
                            style={{ padding: 12 }}
                        >
                            <Text style={{ color: 'white' }}>Option 1</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => { console.log('Option 2'); setModalVisible(false); }}
                            style={{ padding: 12 }}
                        >
                            <Text style={{ color: 'white' }}>Option 2</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Back button + Title */}
            <View className="flex-row items-center justify-between mb-4">
                {/* Back button */}
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="arrow-back-outline" size={25} color="white" style={{ marginRight: 8 }} />
                </TouchableOpacity>

                {/* Title */}
                <View style={{ flex: 1, marginHorizontal: 8 }}>
                    <Text
                        style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        {game.name} - Achievements
                    </Text>
                </View>

                {/* Three-dot menu */}
                <TouchableOpacity onPress={() => setModalVisible(true)}>
                    <Ionicons name="ellipsis-vertical" size={25} color="white" />
                </TouchableOpacity>
            </View>

            <View className="flex-row items-center bg-gray-800 p-5 rounded mb-4">
                <Image
                    source={{ uri: `https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/capsule_184x69.jpg` }}
                    className="w-40 rounded"
                    style={{ aspectRatio: 184 / 69 }}
                    resizeMode="cover"
                />
                <View className="ml-4 flex-1">
                    <Text className="text-white font-bold text-lg" numberOfLines={1} ellipsizeMode="tail">
                        {game.name}
                    </Text>
                    <Text className="text-gray-300 text-sm mt-1">
                        {game.schema?.length > 0 ?
                            `${mergedCheevos.filter(a => a.achieved).length} de ${game.schema.length} desbloqueadas (${((mergedCheevos.filter(a => a.achieved).length / game.schema.length) * 100).toFixed(1)}%)`
                            : 'Jogo não possui conquistas'}
                    </Text>
                </View>
            </View>

            {mergedCheevos.length === 0 ? (
                <View className="flex-1 justify-center items-center">
                    <Text className="text-gray-400 text-center text-lg">
                        Este jogo não possui conquistas
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={mergedCheevos}
                    keyExtractor={(item) => item.name}
                    renderItem={({ item }) => (
                        <TouchableOpacity className="flex-row items-center bg-gray-800 p-4 rounded mb-3 justify-between">
                            {/* Left: icon + percent */}
                            <View className="flex-col items-center mr-4">
                                <Image
                                    source={{ uri: item.icon }}
                                    className="w-12 h-12 rounded mb-1"
                                    resizeMode="contain"
                                />
                                <Text className="text-gray-400 text-sm">{item.globalPercent}%</Text>
                            </View>

                            {/* Middle: name + description */}
                            <View className="flex-1">
                                <Text className="text-white font-bold text-base">{item.name}</Text>
                                <Text className="text-gray-400 text-sm" numberOfLines={2}>
                                    {item.description || "Descrição Oculta"}
                                </Text>
                            </View>

                            {/* Right: lock */}
                            <Ionicons
                                name={item.achieved ? "lock-open-outline" : "lock-closed-outline"}
                                size={32}
                                color={item.achieved ? "#34D399" : "#F87171"}
                            />
                        </TouchableOpacity>

                    )}
                />
            )}
        </View>
    );


}
