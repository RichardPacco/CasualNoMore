import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Pressable from "@/src/components/ui/Pressable";
import { ProgressBar } from "@/src/components/ui";
import { useImageCdnFallback } from "@/src/hooks/useImageCdnFallback";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";
import { getGameCounts } from "@/src/utils/achievements";
import { capsuleUri, headerUri, imageCandidates } from "@/src/utils/cdn";
import { totalPlaytimeText } from "@/src/utils/playtime";

const placeholderImage = require("../../assets/images/placeholder_gamelist.jpg");
// medalha de jogo completo (100% das conquistas), a mesma de antes do redesign
const completionIcon = require("../../assets/images/completion_icon.png");

/**
 * Um jogo na biblioteca, em um dos três formatos (`variant`):
 * - "card" (padrão): cápsula à esquerda e, ao lado, nome com medalha e
 *   alfinete, tempo total, barra e "18/28 conquistas (64.3%)";
 * - "compact": lista sem imagem, para ver mais jogos por tela;
 * - "grid": card quadrado para a grade de duas colunas, com a capa larga em
 *   cima (medalha e alfinete sobre a imagem) e nome, barra e contagem embaixo.
 * Jogos fixados ganham borda dourada. Toque abre o jogo; toque longo
 * atualiza; o alfinete fixa/desfixa.
 * Props: game, navigation, onOpen (opcional; senão navega com o appid),
 * onLongPress, onTogglePin, variant.
 */
function GameCardComponent({ game, navigation, onOpen, onLongPress, onTogglePin, variant = "card" }) {
    const { t: tr } = useLanguage();
    const isGrid = variant === "grid";

    // Imagem: na grade a capa larga (header 460x215), nos cards a cápsula
    // (231x87). URL da loja (com hash, funciona para jogos novos) primeiro;
    // depois os CDNs antigos montados pelo appid; todas falharam -> placeholder.
    const storeUrl = isGrid ? game.headerUrl : game.capsuleUrl;
    const legacyUri = isGrid ? (fb => headerUri(game.appid, fb)) : (fb => capsuleUri(game.appid, fb));
    const candidates = imageCandidates(storeUrl, legacyUri);
    const { stage, onError } = useImageCdnFallback(
        `${game.appid}|${variant}|${storeUrl ?? ""}`,
        candidates.length
    );
    const imageSource = stage >= candidates.length ? placeholderImage : { uri: candidates[stage] };

    const { unlocked, total, percent } = getGameCounts(game);
    const hasAchievements = total > 0;
    const complete = hasAchievements && unlocked === total;
    const countText = hasAchievements
        ? tr("achievementsCount", { unlocked, total, percent: percent.toFixed(1) })
        : null;

    const open = () => onOpen ? onOpen(game) : navigation.navigate("GameScreen", { appid: game.appid });

    const medal = complete ? (
        <Image
            source={completionIcon}
            style={isGrid ? styles.medalGrid : styles.medal}
            resizeMode="contain"
            accessibilityLabel={tr("filterCompleted")}
        />
    ) : null;

    const pin = onTogglePin ? (
        <Pressable
            onPress={() => onTogglePin(game)}
            accessibilityRole="button"
            accessibilityLabel={game.pinned ? tr("unpinGame") : tr("pinGame")}
            accessibilityState={{ selected: !!game.pinned }}
            hitSlop={13}
            style={isGrid ? styles.pinOverlay : styles.pinButton}
        >
            <Ionicons
                name={game.pinned ? "pin" : "pin-outline"}
                size={18}
                color={game.pinned ? COLORS.gold : (isGrid ? COLORS.text : COLORS.accent)}
            />
        </Pressable>
    ) : null;

    const pressableProps = {
        onPress: open,
        onLongPress: onLongPress ? () => onLongPress(game) : undefined,
        delayLongPress: 400,
        accessibilityRole: "button",
        accessibilityLabel: game.name,
        accessibilityHint: tr("gameRefreshHint"),
    };

    // ---------- grade: card quadrado ----------
    if (isGrid) {
        return (
            <Pressable
                {...pressableProps}
                style={({ pressed }) => [styles.tile, game.pinned && styles.pinned, { opacity: pressed ? 0.85 : 1 }]}
            >
                <View>
                    <Image source={imageSource} onError={onError} style={styles.cover} resizeMode="cover" />
                    {medal && <View style={styles.medalOverlay}>{medal}</View>}
                    {pin}
                </View>
                <View style={styles.tileBody}>
                    <Text style={styles.tileName} numberOfLines={2}>{game.name}</Text>
                    <Text style={styles.meta} numberOfLines={1}>{totalPlaytimeText(game, tr)}</Text>
                    {hasAchievements && (
                        <>
                            <ProgressBar value={percent} height={6} style={{ marginTop: 4 }} />
                            <Text style={styles.count} numberOfLines={1}>{`${unlocked}/${total} · ${Math.round(percent)}%`}</Text>
                        </>
                    )}
                </View>
            </Pressable>
        );
    }

    // ---------- lista sem imagem ----------
    if (variant === "compact") {
        return (
            <Pressable
                {...pressableProps}
                style={({ pressed }) => [styles.compact, game.pinned && styles.pinned, { opacity: pressed ? 0.85 : 1 }]}
            >
                <View style={styles.titleRow}>
                    <Text style={styles.name} numberOfLines={1}>{game.name}</Text>
                    {medal}
                    {pin}
                </View>
                <Text style={styles.meta} numberOfLines={1}>
                    {countText ? `${totalPlaytimeText(game, tr)} · ${countText}` : totalPlaytimeText(game, tr)}
                </Text>
                {hasAchievements && <ProgressBar value={percent} height={4} style={{ marginTop: 4 }} />}
            </Pressable>
        );
    }

    // ---------- card padrão: cápsula + informações ----------
    return (
        <Pressable
            {...pressableProps}
            style={({ pressed }) => [styles.row, game.pinned && styles.pinned, { opacity: pressed ? 0.85 : 1 }]}
        >
            <Image source={imageSource} onError={onError} style={styles.capsule} resizeMode="cover" />

            {/* Mesmo arranjo de antes do redesign: nome (+ medalha e alfinete),
                tempo de jogo, barra e contagem de conquistas, um embaixo do outro */}
            <View style={styles.body}>
                <View style={styles.titleRow}>
                    <Text style={styles.name} numberOfLines={1}>{game.name}</Text>
                    {medal}
                    {pin}
                </View>
                <Text style={styles.meta} numberOfLines={1}>{totalPlaytimeText(game, tr)}</Text>
                {hasAchievements && (
                    <>
                        <ProgressBar value={percent} height={8} style={{ marginTop: 4 }} />
                        <Text style={styles.count} numberOfLines={1}>{countText}</Text>
                    </>
                )}
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    // --- card padrão ---
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
    pinned: { borderColor: "rgba(255, 179, 0, 0.35)" },
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

    // --- lista sem imagem ---
    compact: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 8,
        borderRadius: 14,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: "transparent",
        gap: 3,
    },

    // --- grade ---
    tile: {
        flex: 1,
        marginBottom: 10,
        borderRadius: 16,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: "transparent",
        overflow: "hidden",
    },
    // capa larga da Steam (header 460x215) inteira, sem corte
    cover: { width: "100%", aspectRatio: 460 / 215, backgroundColor: COLORS.surface2 },
    medalOverlay: {
        position: "absolute",
        left: 6,
        top: 6,
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: "rgba(10, 14, 21, 0.7)",
        alignItems: "center",
        justifyContent: "center",
    },
    medalGrid: { width: 22, height: 22 },
    pinOverlay: {
        position: "absolute",
        right: 6,
        top: 6,
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: "rgba(10, 14, 21, 0.7)",
        alignItems: "center",
        justifyContent: "center",
    },
    tileBody: { padding: 10, gap: 3, flex: 1 },
    tileName: { fontFamily: FONTS.bodySemibold, fontSize: 14, lineHeight: 18, color: COLORS.text, minHeight: 36 },
});

/**
 * Exporta o GameCard com memo para evitar re-renderizações quando as props não mudam.
 */
export default memo(GameCardComponent, (prevProps, nextProps) => {
    return prevProps.game === nextProps.game
        && prevProps.navigation === nextProps.navigation
        && prevProps.onOpen === nextProps.onOpen
        && prevProps.onLongPress === nextProps.onLongPress
        && prevProps.onTogglePin === nextProps.onTogglePin
        && prevProps.variant === nextProps.variant;
});
