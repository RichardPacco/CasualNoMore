import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { ProgressRing } from "@/src/components/ui";
import { useImageCdnFallback } from "@/src/hooks/useImageCdnFallback";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";
import { getGameCounts } from "@/src/utils/achievements";
import { headerUri, imageCandidates } from "@/src/utils/cdn";
import { formatDuration, playtimeLine } from "@/src/utils/playtime";

const placeholderImage = require("../../assets/images/placeholder_gamelist.jpg");

/**
 * Destaque "Continuar caçando" (redesign, prancheta 04): o jogo mais jogado
 * nas últimas 2 semanas, com a capa grande, tempo recente, conquistas e anel
 * de progresso. Props: game, onOpen, onLongPress.
 */
export default function ContinueHuntingCard({ game, onOpen, onLongPress }) {
    const { t: tr } = useLanguage();

    const candidates = imageCandidates(game.headerUrl, fb => headerUri(game.appid, fb));
    const { stage, onError } = useImageCdnFallback(
        `${game.appid}|${game.headerUrl ?? ""}`,
        candidates.length
    );

    const { unlocked, total, percent } = getGameCounts(game);
    const recent = game.playtime_2weeks || 0;
    const parts = [
        recent > 0 ? tr("playtimeRecent", { time: formatDuration(recent) }) : playtimeLine(game, tr),
        total > 0 ? tr("achievementsShort", { unlocked, total }) : null,
    ].filter(Boolean);

    return (
        <Pressable
            onPress={() => onOpen(game)}
            onLongPress={onLongPress ? () => onLongPress(game) : undefined}
            delayLongPress={400}
            accessibilityRole="button"
            accessibilityLabel={`${game.name}, ${parts.join(", ")}`}
            accessibilityHint={tr("gameRefreshHint")}
            style={({ pressed }) => [styles.card, { opacity: pressed ? 0.9 : 1 }]}
        >
            <Image
                source={stage >= candidates.length ? placeholderImage : { uri: candidates[stage] }}
                onError={onError}
                style={styles.cover}
                resizeMode="cover"
            />
            <View style={styles.footer}>
                <View style={styles.texts}>
                    <Text style={styles.name} numberOfLines={1}>{game.name}</Text>
                    <Text style={styles.meta} numberOfLines={1}>{parts.join(" · ")}</Text>
                </View>
                {total > 0 && <ProgressRing value={percent} size={52} stroke={5} />}
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 20,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
        overflow: "hidden",
    },
    // capa no formato do header da Steam (460x215)
    cover: { width: "100%", aspectRatio: 460 / 215, backgroundColor: COLORS.surface2 },
    footer: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 },
    texts: { flex: 1, minWidth: 0, gap: 4 },
    name: { fontFamily: FONTS.displaySemibold, fontSize: 19, color: COLORS.text },
    meta: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted },
});
