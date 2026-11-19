import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useEffect, useMemo, useState } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { getStoreAssets } from "@/src/api/steam";
import SearchBar from "@/src/components/SearchBar";
import { useImageCdnFallback } from "@/src/hooks/useImageCdnFallback";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { useTheme } from "@/src/theme/styles";
import { capsuleUri, imageCandidates } from "@/src/utils/cdn";

const placeholderImage = require("../../assets/images/placeholder_gamelist.jpg");

/**
 * Linha de um jogo com imagem (cápsula) e nome. `capsuleUrl` = URL da loja
 * (com hash, funciona para jogos novos), quando já buscada; senão CDNs antigos.
 */
function GameRow({ item, t, capsuleUrl }) {
    const candidates = imageCandidates(capsuleUrl, fb => capsuleUri(item.appid, fb));
    const { stage, onError } = useImageCdnFallback(
        `${item.appid}|${capsuleUrl ?? ""}`,
        candidates.length
    );

    return (
        <View className={`${t.cardBg} p-2 rounded-xl flex-row items-center mb-4`}>
            <Image
                source={stage >= candidates.length
                    ? placeholderImage
                    : { uri: candidates[stage] }}
                onError={onError}
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
    );
}

/**
 * Tela com os jogos do amigo (todos ou apenas os em comum, conforme o modo),
 * com busca por nome.
 */
export default function CommonGames({ route, navigation }) {
    const { friend, mode = "common" } = route.params;
    const t = useTheme();
    const { t: tr } = useLanguage();
    const [searchQuery, setSearchQuery] = useState("");

    const isAll = mode === "all";
    const games = useMemo(
        () => isAll ? (friend?.games?.games || []) : (friend?.commonGames || []),
        [isAll, friend]
    );
    const friendName = friend?.profile?.personaname || tr("friendFallback");

    // URLs das imagens da loja dos jogos exibidos (appid -> { capsuleUrl }).
    // Esses jogos não estão no banco do usuário, então busca ao abrir a tela.
    const [assets, setAssets] = useState(() => new Map());
    useEffect(() => {
        let cancelled = false;
        getStoreAssets(games.map(g => g.appid)).then(map => {
            if (!cancelled) setAssets(map);
        });
        return () => { cancelled = true; };
    }, [games]);

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

            <FlashList
                data={filteredGames}
                keyExtractor={(item) => item.appid.toString()}
                maintainVisibleContentPosition={{ disabled: true }}
                contentContainerStyle={{ paddingTop: 12, paddingBottom: 70 }}
                extraData={assets}
                renderItem={({ item }) => (
                    <GameRow item={item} t={t} capsuleUrl={assets.get(item.appid)?.capsuleUrl} />
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
