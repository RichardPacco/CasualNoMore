import { Ionicons } from "@expo/vector-icons";
import { getGameStoreDetails } from "@/src/api/steam";
import { AppText, Button } from "@/src/components/ui";
import { AuthContext } from "@/src/context/AuthContext";
import { getGame, parseJson, updateGameDetails } from "@/src/database/db";
import { getLanguageStore } from "@/src/i18n/langStore";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";
import { useContext, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import RenderHTML, { defaultSystemFonts } from 'react-native-render-html';

// Fontes do app liberadas para o HTML da descrição da loja
const HTML_FONTS = [...defaultSystemFonts, FONTS.body, FONTS.bodySemibold];
const HTML_IGNORED_TAGS = ["video", "iframe", "source", "picture", "object", "embed", "noscript", "style", "script", "track"];

/** Abre um link externo, registrando falhas no console. */
function openUrl(url) {
    Linking.openURL(url).catch(err => console.error("Failed to open URL:", url, err));
}

/**
 * Aba Detalhes do jogo (redesign, prancheta 06): gênero, lançamento e
 * Metacritic em blocos, descrição da loja com "Ler mais", e botões para a
 * loja, os guias e as discussões da comunidade Steam.
 */
export default function GameDetailsTab({ game }) {
    const { steamId } = useContext(AuthContext);
    const { t: tr, language } = useLanguage();
    const cachedDetails = parseJson(game?.details);
    const [gameDetail, setGameDetail] = useState(cachedDetails);
    const [showFull, setShowFull] = useState(false);
    const { width } = useWindowDimensions();

    useEffect(() => {
        if (!game) return;

        let cancelled = false;
        const currentLang = getLanguageStore();
        const details = parseJson(game?.details);
        // Os detalhes têm o próprio idioma (detailsLang), separado do lang da
        // linha, que vale para schema/conquistas.
        const staleGameDetails = details && game.detailsLang !== currentLang;

        /**
         * Carrega os detalhes da loja: do objeto do jogo, do cache do banco
         * ou da API da Steam, persistindo o resultado após a busca.
         */
        const loadDetails = async () => {
            // 1️⃣ Detalhes já no objeto do jogo
            if (details && !staleGameDetails) {
                setGameDetail(details);
                return;
            }

            // 2️⃣ Detalhes cacheados no banco
            let cached = null;
            if (steamId) {
                cached = await getGame(steamId, game.appid);
                if (cancelled) return;
            }
            if (cached?.details && cached.detailsLang === currentLang) {
                setGameDetail(cached.details);
                return;
            }

            // 3️⃣ Busca na loja e persiste
            try {
                const details = await getGameStoreDetails(game.appid);
                if (cancelled) return;
                setGameDetail(details);
                if (details && steamId) {
                    // Atualiza só os detalhes. Não usa a cópia do jogo da rota (pode estar
                    // desatualizada) nem muda a coluna lang, que vale para schema/conquistas.
                    await updateGameDetails(steamId, game.appid, details, currentLang);
                }
            } catch (err) {
                console.warn(`No Details for ${game.name}`, err);
            }
        };

        loadDetails();
        return () => {
            cancelled = true;
        };
    }, [game, steamId, language]);

    const appid = game.appid;
    const genre = gameDetail?.genres?.slice(0, 2).map(g => g.description).join(", ");
    const releaseDate = gameDetail?.release_date?.date;
    const metacritic = gameDetail?.metacritic?.score;
    const description = showFull ? gameDetail?.detailed_description : gameDetail?.short_description;

    return (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            <View style={styles.stats}>
                <StatTile label={tr("genre")} value={genre} />
                <StatTile label={tr("release")} value={releaseDate} />
                <StatTile label="Metacritic" value={metacritic != null ? String(metacritic) : null} />
            </View>

            {(gameDetail?.short_description || gameDetail?.detailed_description) && (
                <View style={styles.card}>
                    <AppText variant="label">{tr("aboutGame")}</AppText>
                    <RenderHTML
                        contentWidth={width - 72}
                        source={{ html: description || gameDetail.short_description || "" }}
                        systemFonts={HTML_FONTS}
                        baseStyle={styles.html}
                        tagsStyles={{ a: { color: COLORS.accent }, strong: { fontFamily: FONTS.bodySemibold } }}
                        ignoredDomTags={HTML_IGNORED_TAGS}
                    />
                    {gameDetail.detailed_description && (
                        <Pressable
                            onPress={() => setShowFull(v => !v)}
                            accessibilityRole="button"
                            style={styles.readMore}
                        >
                            <Text style={styles.readMoreText}>{showFull ? tr("readLess") : tr("readMore")}</Text>
                        </Pressable>
                    )}
                </View>
            )}

            <View style={styles.actions}>
                <Button
                    label={tr("viewInSteamStore")}
                    onPress={() => openUrl(`https://store.steampowered.com/app/${appid}`)}
                    icon={<Ionicons name="open-outline" size={18} color={COLORS.onAccent} />}
                    accessibilityRole="link"
                />
                <View style={styles.actionsRow}>
                    <Button
                        label={tr("guidesShort")}
                        variant="secondary"
                        onPress={() => openUrl(`https://steamcommunity.com/app/${appid}/guides/`)}
                        icon={<Ionicons name="book-outline" size={18} color={COLORS.text} />}
                        accessibilityRole="link"
                        accessibilityLabel={tr("communityGuides")}
                        style={{ flex: 1 }}
                    />
                    <Button
                        label={tr("discussionsShort")}
                        variant="secondary"
                        onPress={() => openUrl(`https://steamcommunity.com/app/${appid}/discussions/`)}
                        icon={<Ionicons name="chatbubbles-outline" size={18} color={COLORS.text} />}
                        accessibilityRole="link"
                        accessibilityLabel={tr("steamDiscussions")}
                        style={{ flex: 1 }}
                    />
                </View>
            </View>
        </ScrollView>
    );
}

/** Bloco pequeno de informação (rótulo em caixa alta + valor). */
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
    stats: { flexDirection: "row", gap: 8 },
    tile: { flex: 1, padding: 12, borderRadius: 16, backgroundColor: COLORS.surface, gap: 4 },
    tileLabel: {
        fontFamily: FONTS.bodySemibold,
        fontSize: 11,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: COLORS.textMuted,
    },
    tileValue: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.text },
    card: { padding: 16, borderRadius: 20, backgroundColor: COLORS.surface, gap: 10 },
    html: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 23, color: COLORS.textSoft },
    readMore: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
    readMoreText: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.accent },
    actions: { gap: 10, marginTop: 2 },
    actionsRow: { flexDirection: "row", gap: 10 },
});
