import { getGameCounts } from "@/src/utils/achievements";
import { capsuleUri } from "@/src/utils/cdn";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { useImageCdnFallback } from "@/src/hooks/useImageCdnFallback";
import { memo } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/src/theme/styles";

const placeholderImage = require("../../assets/images/placeholder_gamelist.jpg");

/**
 * Card de um jogo na lista: mostra imagem, nome, tempo jogado e progresso de conquistas.
 * Props: game, navigation, onLongPress.
 */
function GameCardComponent({ game, navigation, onLongPress }) {
    const t = useTheme();
    const { t: tr } = useLanguage();
    const { stage, onError } = useImageCdnFallback(game.appid);

    const { unlocked, total, percent } = getGameCounts(game);

    const playtimeText = game.playtimeHidden
        ? tr("playtimeHidden")
        : game.playtime_forever > 0
            ? (game.playtime_forever < 60
                ? tr("playtimeMinutes", { minutes: game.playtime_forever })
                : tr("playtimeHours", {
                    hours: Math.floor(game.playtime_forever / 60),
                    minutes: game.playtime_forever % 60,
                }))
            : tr("playtimeNeverPlayed");

    return (
        <TouchableOpacity
            className={`${t.cardBg} p-2 rounded-xl flex-row items-center mb-3`}
            onPress={() => navigation.navigate("GameScreen", { game })}
            onLongPress={onLongPress ? () => onLongPress(game) : undefined}
            delayLongPress={400}
            style={{ minHeight: 90 }}
        >
            <Image
                source={stage >= 2
                    ? placeholderImage
                    : { uri: capsuleUri(game.appid, stage === 1) }}
                onError={onError}
                className="w-40 h-20 rounded-md"
                style={{ aspectRatio: 231 / 87 }}
                resizeMode="cover"
            />

            <View className="ml-4 flex-1">
                <View className="flex-row items-center">
                    <Text className={`${t.textPrimary} text-lg font-bold flex-1`} numberOfLines={1}>
                        {game.name}
                    </Text>
                    {total > 0 && unlocked === total && (
                        <Image
                            source={require("../../assets/images/completion_icon.png")}
                            className="w-6 h-6 ml-2"
                            resizeMode="contain"
                        />
                    )}
                </View>
                <Text className={`${t.textSecondary} text-sm mt-1`}>
                    {playtimeText}
                </Text>

                {total > 0 && (
                    <>
                        <View className={`w-full ${t.progressTrack} rounded-full h-2 mt-2`}>
                            <View
                                className={`${unlocked === total ? "bg-warning" : "bg-accent"} h-2 rounded-full`}
                                style={{ width: `${percent}%` }}
                            />
                        </View>
                        <Text className={`${t.textSecondary} text-xs mt-1`}>
                            {tr("achievementsCount", { unlocked, total, percent: percent.toFixed(1) })}
                        </Text>
                    </>
                )}
            </View>
        </TouchableOpacity>
    );
}

/**
 * Exporta o GameCard com memo para evitar re-renderizações quando as props não mudam.
 */
export default memo(GameCardComponent, (prevProps, nextProps) => {
    return prevProps.game === nextProps.game
        && prevProps.navigation === nextProps.navigation
        && prevProps.onLongPress === nextProps.onLongPress;
});
