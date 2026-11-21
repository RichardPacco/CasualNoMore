import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { raForumUrl, raGameUrl } from "@/src/api/retroachievements";
import { Button } from "@/src/components/ui";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";

/** Abre um link externo, registrando falhas no console. */
function openUrl(url) {
    Linking.openURL(url).catch(err => console.error("Failed to open URL:", url, err));
}

/** Data de lançamento no nível de detalhe que o RA informa (ano, mês ou dia). */
function releaseText(details) {
    const value = details?.released;
    if (!value) return null;
    const [year, month, day] = String(value).slice(0, 10).split("-");
    switch (details.releasedGranularity) {
        case "year": return year;
        case "month": return month ? `${month}/${year}` : year;
        default: return day ? `${day}/${month}/${year}` : year;
    }
}

/**
 * Aba Detalhes de um jogo do RetroAchievements: botões para a página do jogo
 * no RA, o fórum, o guia (quando existem) e a busca no HowLongToBeat; depois
 * blocos com console, lançamento, gênero, publicadora, desenvolvedora e
 * jogadores. O RA não tem descrição do jogo.
 * Props: game (linha do banco, com `name`), details (de useRaGame), loading.
 */
export default function RaGameDetailsTab({ game, details, loading }) {
    const { t: tr } = useLanguage();
    const players = details?.players
        ? tr("playersValue", { hardcore: details.playersHardcore.toLocaleString(), total: details.players.toLocaleString() })
        : null;

    return (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            <View style={styles.actions}>
                <Button
                    label={tr("viewOnRa")}
                    onPress={() => openUrl(raGameUrl(game.gameId))}
                    icon={<Ionicons name="open-outline" size={18} color={COLORS.onAccent} />}
                    accessibilityRole="link"
                />
                {(details?.forumTopicId || details?.guideUrl) && (
                    <View style={styles.actionsRow}>
                        {details?.forumTopicId && (
                            <Button
                                label={tr("forum")}
                                variant="secondary"
                                onPress={() => openUrl(raForumUrl(details.forumTopicId))}
                                icon={<Ionicons name="chatbubbles-outline" size={18} color={COLORS.text} />}
                                accessibilityRole="link"
                                style={{ flex: 1 }}
                            />
                        )}
                        {details?.guideUrl && (
                            <Button
                                label={tr("guide")}
                                variant="secondary"
                                onPress={() => openUrl(details.guideUrl)}
                                icon={<Ionicons name="book-outline" size={18} color={COLORS.text} />}
                                accessibilityRole="link"
                                style={{ flex: 1 }}
                            />
                        )}
                    </View>
                )}
                {/* HowLongToBeat: busca pelo nome, como na Steam */}
                <Button
                    label={tr("viewOnHltb")}
                    variant="secondary"
                    onPress={() => openUrl(`https://howlongtobeat.com/?q=${encodeURIComponent(game.name || "")}`)}
                    icon={<Ionicons name="time-outline" size={18} color={COLORS.text} />}
                    accessibilityRole="link"
                />
            </View>

            {loading && !details ? (
                <ActivityIndicator size="small" color={COLORS.accent} style={{ marginTop: 12 }} />
            ) : (
                <View style={styles.grid}>
                    <StatTile label={tr("console")} value={details?.consoleName ?? game.consoleName} />
                    <StatTile label={tr("release")} value={releaseText(details)} />
                    <StatTile label={tr("genre")} value={details?.genre} />
                    <StatTile label={tr("players")} value={players} />
                    <StatTile label={tr("publisher")} value={details?.publisher} />
                    <StatTile label={tr("developer")} value={details?.developer} />
                </View>
            )}
        </ScrollView>
    );
}

/** Bloco pequeno de informação (rótulo em caixa alta + valor), meia largura. */
function StatTile({ label, value }) {
    return (
        <View style={styles.tile}>
            <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
            <Text style={styles.tileValue} numberOfLines={2}>{value || "—"}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    scroll: { flex: 1, backgroundColor: COLORS.bg },
    // espaço no fim para o conteúdo não ficar atrás da tab bar flutuante
    content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 110, gap: 12 },
    actions: { gap: 10, marginBottom: 4 },
    actionsRow: { flexDirection: "row", gap: 10 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    tile: { width: "48.8%", padding: 12, borderRadius: 16, backgroundColor: COLORS.surface, gap: 4 },
    tileLabel: {
        fontFamily: FONTS.bodySemibold,
        fontSize: 11,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: COLORS.textMuted,
    },
    tileValue: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.text },
});
