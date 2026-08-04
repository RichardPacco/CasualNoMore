import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { FlatList, Image, Text, TouchableOpacity, View } from "react-native";
import SearchBar from "@/src/components/SearchBar";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { useTheme } from "@/src/theme/styles";

export default function CommonGames({ route, navigation }) {
    const { friend, mode = "common" } = route.params;
    const t = useTheme();
    const { t: tr } = useLanguage();
    const [searchQuery, setSearchQuery] = useState("");

    const isAll = mode === "all";
    const games = isAll ? (friend?.games?.games || []) : (friend?.commonGames || []);
    const friendName = friend?.profile?.personaname || tr("friendFallback");

    const filteredGames = games
        .filter(g =>
            (g.name || "").toLowerCase().includes(searchQuery.trim().toLowerCase())
        )
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    return (
        <View className={`flex-1 p-4 ${t.pageBg}`}>
            {/* Header: back + title */}
            <View className="flex-row items-center justify-between mb-4">
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="arrow-back-outline" size={25} color={t.textInline} />
                </TouchableOpacity>

                <View style={{ flex: 1, marginHorizontal: 8 }}>
                    <Text
                        className={`${t.textPrimary} text-lg font-bold`}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        {isAll
                            ? tr("friendGamesTitle", { count: games.length })
                            : tr("commonGamesTitle", { count: games.length })}
                    </Text>
                    <Text className={`${t.textSecondary} text-sm`} numberOfLines={1}>
                        {friendName}
                    </Text>
                </View>

                <View style={{ width: 25 }} />
            </View>

            <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={tr("searchGamesPlaceholder")}
            />

            <FlatList
                data={filteredGames}
                keyExtractor={(item) => item.appid.toString()}
                contentContainerStyle={{ paddingTop: 12, paddingBottom: 70 }}
                renderItem={({ item }) => (
                    <View className={`${t.cardBg} p-2 rounded-xl flex-row items-center mb-4`}>
                        <Image
                            source={{
                                uri: `https://steamcdn-a.akamaihd.net/steam/apps/${item.appid}/capsule_231x87.jpg`,
                            }}
                            className="w-40 h-20 rounded-md"
                            style={{ aspectRatio: 231 / 87 }}
                            resizeMode="cover"
                        />

                        <View className="ml-4 flex-1">
                            <Text className={`${t.textPrimary} text-lg font-bold`} numberOfLines={1}>
                                {item.name}
                            </Text>
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    <Text className={`${t.textSecondary} text-center mt-8`}>
                        {isAll ? tr("noGames") : tr("noCommonGames")}
                    </Text>
                }
            />
        </View>
    );
}
