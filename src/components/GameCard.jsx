import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import AwardMedal from "@/src/components/AwardMedal";
import Pressable from "@/src/components/ui/Pressable";
import { ProgressBar } from "@/src/components/ui";
import { useImageCdnFallback } from "@/src/hooks/useImageCdnFallback";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { getPlatform } from "@/src/platforms";
import { COLORS, FONTS } from "@/src/theme/colors";

const placeholderImage = require("../../assets/images/placeholder_gamelist.jpg");

/**
 * Um jogo na biblioteca, em um dos três formatos (`variant`):
 * - "card" (padrão): cápsula à esquerda e, ao lado, nome com medalha e
 *   alfinete, tempo total, barra e "18/28 conquistas (64.3%)";
 * - "compact": lista sem imagem, para ver mais jogos por tela;
 * - "grid": card quadrado para a grade de duas colunas, com a capa larga em
 *   cima (medalha e alfinete sobre a imagem) e nome, barra e contagem embaixo.
 * Jogos fixados ganham borda dourada. Toque abre o jogo; toque longo
 * atualiza; o alfinete fixa/desfixa.
 * Props: game (LibraryGame, o formato comum de jogo de qualquer plataforma),
 * navigation, onOpen (opcional; senão navega com plataforma e id),
 * onLongPress, onTogglePin, variant.
 */
function GameCardComponent({ game, navigation, onOpen, onLongPress, onTogglePin, variant = "card" }) {
    const { t: tr } = useLanguage();
    const isGrid = variant === "grid";

    // Imagem: na grade a capa larga, nos cards a cápsula. Cada plataforma
    // manda a lista de URLs a tentar em ordem; todas falharam -> placeholder.
    const { candidates, shape } = isGrid ? game.gridImage : game.image;
    // ícones quadrados (RA) no lugar da cápsula/capa larga (Steam)
    const square = shape === "square";
    const { stage, onError } = useImageCdnFallback(
        `${game.key}|${variant}|${candidates[0] ?? ""}`,
        candidates.length
    );
    const imageSource = stage >= candidates.length ? placeholderImage : { uri: candidates[stage] };

    const { unlocked, total, percent } = game;
    const hasAchievements = total > 0;
    const complete = hasAchievements && unlocked === total;
    const subtitle = getPlatform(game.platform)?.subtitle(game, tr) ?? "";
    const countText = hasAchievements
        ? tr("achievementsCount", { unlocked, total, percent: percent.toFixed(1) })
        : null;

    const open = () => onOpen ? onOpen(game) : navigation.navigate("GameScreen", { platform: game.platform, id: game.id });

    const medal = game.award ? <AwardMedal award={game.award} size={isGrid ? 22 : 24} /> : null;

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
                    <Image source={imageSource} onError={onError} style={[styles.cover, square && styles.coverSquare]} resizeMode="cover" />
                    {medal && <View style={styles.medalOverlay}>{medal}</View>}
                    {pin}
                </View>
                <View style={styles.tileBody}>
                    <Text style={styles.tileName} numberOfLines={2}>{game.name}</Text>
                    <Text style={styles.meta} numberOfLines={1}>{subtitle}</Text>
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
                {/* sem tempo de jogo: contagem de conquistas e a barra com o % entre parênteses */}
                {hasAchievements && (
                    <>
                        <Text style={styles.count} numberOfLines={1}>{tr("achievementsShort", { unlocked, total })}</Text>
                        <View style={styles.barRow}>
                            <ProgressBar value={percent} height={4} style={{ flex: 1 }} />
                            <Text style={[styles.count, complete && { color: COLORS.gold }]}>
                                ({percent.toFixed(1)}%)
                            </Text>
                        </View>
                    </>
                )}
            </Pressable>
        );
    }

    // ---------- card padrão: cápsula + informações ----------
    return (
        <Pressable
            {...pressableProps}
            style={({ pressed }) => [styles.row, game.pinned && styles.pinned, { opacity: pressed ? 0.85 : 1 }]}
        >
            <Image source={imageSource} onError={onError} style={square ? styles.squareImage : styles.capsule} resizeMode="cover" />

            {/* Mesmo arranjo de antes do redesign: nome (+ medalha e alfinete),
                tempo de jogo, barra e contagem de conquistas, um embaixo do outro */}
            <View style={styles.body}>
                <View style={styles.titleRow}>
                    <Text style={styles.name} numberOfLines={1}>{game.name}</Text>
                    {medal}
                    {pin}
                </View>
                <Text style={styles.meta} numberOfLines={1}>{subtitle}</Text>
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
    // ícone quadrado (RA): mesma altura da cápsula, em quadrado
    squareImage: { width: 56, height: 56, borderRadius: 10, backgroundColor: COLORS.surface2 },
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
    barRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },

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
    coverSquare: { aspectRatio: 1 },
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
