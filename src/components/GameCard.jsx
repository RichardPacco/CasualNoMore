import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Pressable from "@/src/components/ui/Pressable";
import { ProgressBar } from "@/src/components/ui";
import { useImageCdnFallback } from "@/src/hooks/useImageCdnFallback";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";
import { getGameCounts } from "@/src/utils/achievements";
import { capsuleUri, imageCandidates } from "@/src/utils/cdn";
import { playtimeLine } from "@/src/utils/playtime";

const placeholderImage = require("../../assets/images/placeholder_gamelist.jpg");

/**
 * Linha de um jogo na biblioteca (redesign, prancheta 04): cápsula, nome,
 * percentual, barra de progresso e tempo de jogo. Jogos fixados ganham borda
 * dourada. Toque abre o jogo; toque longo atualiza; o alfinete fixa/desfixa.
 * Props: game, navigation, onOpen (opcional; senão navega com o appid),
 * onLongPress, onTogglePin.
 */
function GameCardComponent({ game, navigation, onOpen, onLongPress, onTogglePin }) {
    const { t: tr } = useLanguage();

    // URL da loja (com hash, funciona para jogos novos) primeiro; depois os
    // CDNs antigos montados pelo appid; todas falharam -> placeholder.
    const candidates = imageCandidates(game.capsuleUrl, fb => capsuleUri(game.appid, fb));
    const { stage, onError } = useImageCdnFallback(
        `${game.appid}|${game.capsuleUrl ?? ""}`,
        candidates.length
    );

    const { unlocked, total, percent } = getGameCounts(game);
    const hasAchievements = total > 0;
    const complete = hasAchievements && unlocked === total;

    return (
        <Pressable
            onPress={() => onOpen
                ? onOpen(game)
                : navigation.navigate("GameScreen", { appid: game.appid })}
            onLongPress={onLongPress ? () => onLongPress(game) : undefined}
            delayLongPress={400}
            accessibilityRole="button"
            accessibilityLabel={game.name}
            accessibilityHint={tr("gameRefreshHint")}
            style={({ pressed }) => [
                styles.row,
                game.pinned && styles.rowPinned,
                { opacity: pressed ? 0.85 : 1 },
            ]}
        >
            <Image
                source={stage >= candidates.length ? placeholderImage : { uri: candidates[stage] }}
                onError={onError}
                style={styles.capsule}
                resizeMode="cover"
            />

            <View style={styles.body}>
                <View style={styles.titleRow}>
                    <Text style={styles.name} numberOfLines={1}>{game.name}</Text>
                    {hasAchievements && (
                        <Text style={[styles.pct, complete && { color: COLORS.gold }]}>
                            {Math.round(percent)}%
                        </Text>
                    )}
                </View>
                {hasAchievements && <ProgressBar value={percent} />}
                <Text style={styles.meta} numberOfLines={1}>{playtimeLine(game, tr)}</Text>
            </View>

            {onTogglePin && (
                <Pressable
                    onPress={() => onTogglePin(game)}
                    accessibilityRole="button"
                    accessibilityLabel={game.pinned ? tr("unpinGame") : tr("pinGame")}
                    accessibilityState={{ selected: !!game.pinned }}
                    style={styles.pinButton}
                >
                    <Ionicons
                        name={game.pinned ? "pin" : "pin-outline"}
                        size={18}
                        color={game.pinned ? COLORS.gold : COLORS.textMuted}
                    />
                </Pressable>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 10,
        paddingRight: 4,
        marginBottom: 8,
        borderRadius: 16,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: "transparent",
    },
    rowPinned: { borderColor: "rgba(255, 179, 0, 0.35)" },
    capsule: { width: 92, height: 34, borderRadius: 8, backgroundColor: COLORS.surface2 },
    body: { flex: 1, minWidth: 0, gap: 6 },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    name: { flex: 1, fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.text },
    pct: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.textMuted },
    meta: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted },
    pinButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});

/**
 * Exporta o GameCard com memo para evitar re-renderizações quando as props não mudam.
 */
export default memo(GameCardComponent, (prevProps, nextProps) => {
    return prevProps.game === nextProps.game
        && prevProps.navigation === nextProps.navigation
        && prevProps.onOpen === nextProps.onOpen
        && prevProps.onLongPress === nextProps.onLongPress
        && prevProps.onTogglePin === nextProps.onTogglePin;
});
