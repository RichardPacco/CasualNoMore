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
import { totalPlaytimeText } from "@/src/utils/playtime";

const placeholderImage = require("../../assets/images/placeholder_gamelist.jpg");
// medalha de jogo completo (100% das conquistas), a mesma de antes do redesign
const completionIcon = require("../../assets/images/completion_icon.png");

/**
 * Linha de um jogo na biblioteca: cápsula grande e, ao lado, o mesmo arranjo
 * de antes do redesign (nome com troféu e alfinete, tempo total, barra e
 * "18/28 conquistas (64.3%)"), nas cores novas. Jogos fixados ganham borda
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

            {/* Mesmo arranjo de antes do redesign: nome (+ troféu e alfinete),
                tempo de jogo, barra e contagem de conquistas, um embaixo do outro */}
            <View style={styles.body}>
                <View style={styles.titleRow}>
                    <Text style={styles.name} numberOfLines={1}>{game.name}</Text>
                    {complete && (
                        <Image
                            source={completionIcon}
                            style={styles.medal}
                            resizeMode="contain"
                            accessibilityLabel={tr("filterCompleted")}
                        />
                    )}
                    {onTogglePin && (
                        <Pressable
                            onPress={() => onTogglePin(game)}
                            accessibilityRole="button"
                            accessibilityLabel={game.pinned ? tr("unpinGame") : tr("pinGame")}
                            accessibilityState={{ selected: !!game.pinned }}
                            hitSlop={13}
                            style={styles.pinButton}
                        >
                            <Ionicons
                                name={game.pinned ? "pin" : "pin-outline"}
                                size={18}
                                color={game.pinned ? COLORS.gold : COLORS.accent}
                            />
                        </Pressable>
                    )}
                </View>
                <Text style={styles.meta} numberOfLines={1}>{totalPlaytimeText(game, tr)}</Text>
                {hasAchievements && (
                    <>
                        <ProgressBar value={percent} height={8} style={{ marginTop: 4 }} />
                        <Text style={styles.count} numberOfLines={1}>
                            {tr("achievementsCount", { unlocked, total, percent: percent.toFixed(1) })}
                        </Text>
                    </>
                )}
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 10,
        minHeight: 80,
        marginBottom: 10,
        borderRadius: 16,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: "transparent",
    },
    rowPinned: { borderColor: "rgba(255, 179, 0, 0.35)" },
    // cápsula na proporção exata da imagem da Steam (capsule_231x87, ~2,66:1),
    // para aparecer inteira, sem cortar as laterais
    capsule: { width: 128, aspectRatio: 231 / 87, borderRadius: 8, backgroundColor: COLORS.surface2 },
    body: { flex: 1, minWidth: 0, gap: 3 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    name: { flex: 1, fontFamily: FONTS.bodySemibold, fontSize: 16, color: COLORS.text },
    meta: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted },
    count: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted },
    medal: { width: 24, height: 24 },
    // alfinete pequeno na linha do nome; hitSlop leva a área de toque a ~44 px
    pinButton: { padding: 2 },
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
