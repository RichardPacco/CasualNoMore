import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as WebBrowser from "expo-web-browser";
import { useRef, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Pressable from "@/src/components/ui/Pressable";
import { raAchievementUrl } from "@/src/api/retroachievements";
import AchievementTypeTag from "@/src/components/AchievementTypeTag";
import { BottomSheet, rarityTier } from "@/src/components/ui";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";
import { achievementIconUri } from "@/src/utils/cdn";
import { formatDate } from "@/src/utils/formatDate";
import { formatPercent } from "@/src/utils/formatPercent";

/** Abre uma URL no navegador do app, registrando falhas no console. */
function openInBrowser(url) {
    WebBrowser.openBrowserAsync(url).catch(err => console.error("Failed to open browser:", url, err));
}

/**
 * Painel de uma conquista (redesign, prancheta 08): ícone grande com a cor da
 * raridade, nome, raridade e % dos jogadores, descrição, status e atalhos
 * para procurar um guia (Google e ChatGPT).
 * Conquistas do RetroAchievements (têm `points`) mostram também pontos,
 * RetroPoints, tipo, o desbloqueio em softcore (que não conta) e o link da
 * conquista no site do RA, além do botão "Comentários" (abre a tela
 * RaAchievementComments).
 * Props: achievement (item da lista ou null), game, onClose.
 */
export default function AchievementSheet({ achievement, game, onClose }) {
    const { t: tr, language } = useLanguage();
    const sheetRef = useRef(null);
    const navigation = useNavigation();
    const [iconFailed, setIconFailed] = useState(false);

    const item = achievement;
    const tier = rarityTier(item?.globalPercent);
    const percentText = formatPercent(item?.globalPercent, language);

    const isRa = item?.points !== undefined;
    // CDN alternativa só existe para os ícones da Steam
    const iconUri = item && iconFailed && !isRa
        ? achievementIconUri(game?.appid, (item.icon || "").split("/").pop(), true)
        : item?.icon;

    const status = !item ? "" : item.achieved
        ? (item.unlocktime ? tr("unlockedAt", { date: formatDate(item.unlocktime) }) : tr("achFilterUnlocked"))
        : item.softcoreUnlocktime
            ? tr("unlockedSoftcoreAt", { date: formatDate(item.softcoreUnlocktime) })
            : tr("achLocked");

    // Busca pelo nome do jogo + conquista (mesma query do menu antigo)
    const query = item ? encodeURIComponent(`${game?.name} ${item.name} Achievement Guide`) : "";
    const links = item ? [
        { key: "google", label: tr("searchGoogle"), icon: "logo-google", url: `https://www.google.com/search?q=${query}` },
        { key: "chatgpt", label: tr("searchChatGPT"), icon: "sparkles-outline", url: `https://chatgpt.com/?q=${query}` },
        ...(isRa ? [{ key: "ra", label: tr("viewOnRa"), icon: "game-controller-outline", url: raAchievementUrl(item.id) }] : []),
    ] : [];

    return (
        <BottomSheet
            ref={sheetRef}
            visible={!!item}
            onClose={() => { setIconFailed(false); onClose(); }}
        >
            {item && (
                <>
                    <View style={styles.top}>
                        <View style={[styles.iconFrame, { borderColor: tier.color }]}>
                            <Image
                                source={{ uri: iconUri }}
                                style={[styles.icon, !item.achieved && { opacity: 0.45 }]}
                                onError={() => setIconFailed(true)}
                            />
                            {!item.achieved && (
                                <View style={styles.lockBadge}>
                                    <Ionicons name="lock-closed" size={13} color={COLORS.textSoft} />
                                </View>
                            )}
                        </View>
                        <View style={styles.titleBox}>
                            <Text style={styles.title} numberOfLines={2}>{item.name}</Text>
                            <Text style={[styles.tierPill, { color: tier.color, backgroundColor: `${tier.color}1F` }]}>
                                {tr(`rarity_${tier.id}`)} · {tr("achRarityA11y", { percent: percentText })}
                            </Text>
                        </View>
                    </View>

                    <View style={{ gap: 6 }}>
                        <Text style={styles.desc}>{item.description || tr("hiddenDescription")}</Text>
                        {isRa && (
                            <View style={styles.raMeta}>
                                <Text style={styles.points}>
                                    {tr("points", { n: item.points })}
                                    {item.trueRatio > 0 ? ` · ${tr("truePointsValue", { n: item.trueRatio })}` : ""}
                                </Text>
                                <AchievementTypeTag type={item.type} />
                            </View>
                        )}
                        <Text style={[styles.status, { color: item.achieved ? COLORS.accent : COLORS.textMuted }]}>
                            {status} · {game?.name}
                        </Text>
                    </View>

                    {isRa && (
                        <Pressable
                            onPress={() => {
                                sheetRef.current?.close();
                                navigation.navigate("RaAchievementComments", {
                                    achievementId: item.id,
                                    title: item.name,
                                    badgeName: item.badgeName ?? null,
                                });
                            }}
                            accessibilityRole="button"
                            style={({ pressed }) => [styles.link, { opacity: pressed ? 0.8 : 1 }]}
                        >
                            <Ionicons name="chatbubbles-outline" size={20} color={COLORS.text} />
                            <Text style={styles.linkLabel}>{tr("raCommentsAndChangelog")}</Text>
                            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
                        </Pressable>
                    )}

                    <View style={{ gap: 8 }}>
                        <Text style={styles.label}>{tr("findGuide")}</Text>
                        {links.map(link => (
                            <Pressable
                                key={link.key}
                                onPress={() => {
                                    sheetRef.current?.close();
                                    openInBrowser(link.url);
                                }}
                                accessibilityRole="link"
                                style={({ pressed }) => [styles.link, { opacity: pressed ? 0.8 : 1 }]}
                            >
                                <Ionicons name={link.icon} size={20} color={COLORS.text} />
                                <Text style={styles.linkLabel}>{link.label}</Text>
                                <Ionicons name="open-outline" size={16} color={COLORS.textMuted} />
                            </Pressable>
                        ))}
                    </View>
                </>
            )}
        </BottomSheet>
    );
}

const styles = StyleSheet.create({
    top: { flexDirection: "row", alignItems: "center", gap: 14 },
    iconFrame: { width: 72, height: 72, borderRadius: 18, borderWidth: 3, overflow: "hidden", backgroundColor: COLORS.surface2 },
    icon: { width: "100%", height: "100%" },
    lockBadge: {
        position: "absolute",
        right: 3,
        bottom: 3,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: "rgba(10, 14, 21, 0.85)",
        alignItems: "center",
        justifyContent: "center",
    },
    titleBox: { flex: 1, minWidth: 0, gap: 6 },
    title: { fontFamily: FONTS.display, fontSize: 22, color: COLORS.text },
    tierPill: {
        alignSelf: "flex-start",
        fontFamily: FONTS.bodySemibold,
        fontSize: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        overflow: "hidden",
    },
    desc: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 23, color: COLORS.textSoft },
    status: { fontFamily: FONTS.body, fontSize: 13 },
    raMeta: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
    points: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.gold },
    label: {
        fontFamily: FONTS.bodySemibold,
        fontSize: 12,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        color: COLORS.textMuted,
    },
    link: {
        minHeight: 52,
        paddingHorizontal: 16,
        borderRadius: 14,
        backgroundColor: COLORS.surface2,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    linkLabel: { flex: 1, fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.text },
});
