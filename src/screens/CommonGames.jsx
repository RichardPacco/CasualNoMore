import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { FlatList, Image, Text, TextInput, TouchableOpacity, useColorScheme, View } from "react-native";

export default function CommonGames({ route, navigation }) {
    const { friend } = route.params;
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";
    const [searchQuery, setSearchQuery] = useState("");

    const games = friend?.commonGames || [];
    const friendName = friend?.profile?.personaname || "Amigo";

    const filteredGames = games.filter(g =>
        (g.name || "").toLowerCase().includes(searchQuery.trim().toLowerCase())
    );

    const textPrimary = isDark ? "text-white" : "text-black";
    const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
    const cardBg = isDark ? "bg-gray-800" : "bg-gray-100";
    const pageBg = isDark ? "bg-gray-900" : "bg-white";

    return (
        <View className={`flex-1 p-4 ${pageBg}`}>
            {/* Header: back + title */}
            <View className="flex-row items-center justify-between mb-4">
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="arrow-back-outline" size={25} color={isDark ? "white" : "black"} />
                </TouchableOpacity>

                <View style={{ flex: 1, marginHorizontal: 8 }}>
                    <Text
                        className={`${textPrimary} text-lg font-bold`}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        Jogos em comum ({games.length})
                    </Text>
                    <Text className={`${textSecondary} text-sm`} numberOfLines={1}>
                        {friendName}
                    </Text>
                </View>

                <View style={{ width: 25 }} />
            </View>

            <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Pesquisar jogos..."
                placeholderTextColor={isDark ? "#9ca3af" : "#6b7280"}
                className={`rounded-xl px-4 py-2 border mb-2 ${
                    isDark
                        ? "bg-slate-800 border-green-400 text-white"
                        : "bg-slate-100 border-gray-300 text-black"
                }`}
                style={{ fontSize: 16 }}
            />

            <FlatList
                data={filteredGames}
                keyExtractor={(item) => item.appid.toString()}
                contentContainerStyle={{ paddingTop: 12 }}
                renderItem={({ item }) => (
                    <View className={`${cardBg} p-2 rounded-xl flex-row items-center mb-4`}>
                        <Image
                            source={{
                                uri: `https://steamcdn-a.akamaihd.net/steam/apps/${item.appid}/capsule_231x87.jpg`,
                            }}
                            className="w-40 h-20 rounded-md"
                            style={{ aspectRatio: 231 / 87 }}
                            resizeMode="cover"
                        />

                        <View className="ml-4 flex-1">
                            <Text className={`${textPrimary} text-lg font-bold`} numberOfLines={1}>
                                {item.name}
                            </Text>
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    <Text className={`${textSecondary} text-center mt-8`}>
                        Nenhum jogo em comum
                    </Text>
                }
            />
        </View>
    );
}
