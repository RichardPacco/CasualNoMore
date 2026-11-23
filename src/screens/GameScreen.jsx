import { Ionicons } from "@expo/vector-icons";
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { LinearGradient } from "expo-linear-gradient";
import { useContext, useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import Pressable from "@/src/components/ui/Pressable";
import AchievementsTab from './AchievementsTab';
import GameDetailsTab from './GameDetailsTab';
import RaGameDetailsTab from './RaGameDetailsTab';
import { raMedia } from "@/src/api/retroachievements";
import { AppText } from "@/src/components/ui";
import { AuthContext } from "@/src/context/AuthContext";
import { useImageCdnFallback } from "@/src/hooks/useImageCdnFallback";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { getPlatform } from "@/src/platforms";
import useRaGame from "@/src/platforms/ra/useRaGame";
import { COLORS, FONTS } from "@/src/theme/colors";
import { getGameCounts } from "@/src/utils/achievements";
import { formatDuration, playtimeLine } from "@/src/utils/playtime";
import { showToast } from "@/src/utils/toast";

const Tab = createMaterialTopTabNavigator();
const placeholderImage = require("../../assets/images/placeholder_gamelist.jpg");

/**
 * Tela do jogo (redesign, prancheta 06): capa grande com voltar e fixar,
 * nome e tempo de jogo, e as abas Detalhes e Conquistas num seletor
 * segmentado.
 *
 * Recebe só a plataforma e o id do jogo pela rota (`{ platform, id }`) e lê o
 * jogo do banco ao abrir. Assim a tela sempre parte do estado salvo mais
 * recente, e nenhuma cópia antiga do jogo viaja pela navegação para depois
 * sobrescrever dados mais novos.
 *
 * A capa vem da plataforma (heroImages). No RetroAchievements a tela busca
 * o jogo uma vez (useRaGame) e repassa conquistas e detalhes para as duas
 * abas; a capa é a tela de título, com o ícone do jogo ao lado do nome.
 */
export default function GameScreen({ route, navigation }) {
    const { platform: platformId = "steam", id, notInLibrary = false } = route.params;
    const { accounts } = useContext(AuthContext);
    const isSteam = platformId === "steam";
    const platform = getPlatform(platformId);
    // Ler o jogo do banco só precisa da conta da plataforma, não da API key
    // (sem a key em memória a tela mostrava "não encontrado" para tudo)
    const connected = !!platform && !!accounts?.[platformId];
    const { t: tr } = useLanguage();

    const [game, setGame] = useState(null);
    const [loadingGame, setLoadingGame] = useState(true);
    // aba ativa: em "Conquistas" a capa encolhe para sobrar espaço para a lista
    const [activeTab, setActiveTab] = useState("Detalhes");
    const compact = activeTab === "Conquistas";

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoadingGame(true);
            const row = connected ? await platform.getGame(accounts, id) : null;
            if (cancelled) return;
            setGame(row);
            setLoadingGame(false);
        })();
        return () => { cancelled = true; };
    }, [connected, platform, accounts, id]);

    // RA: conquistas, detalhes e a linha atualizada (com as imagens grandes)
    const raGame = useRaGame(!isSteam ? game : null, accounts.ra);
    // linha mostrada: no RA a que o useRaGame atualizou, mantendo o fixado local
    const shown = !isSteam && raGame.row && game
        ? { ...raGame.row, pinned: game.pinned }
        : game;

    // Capa: lista de URLs a tentar em ordem, montada pela plataforma
    const headerCandidates = shown && platform?.heroImages ? platform.heroImages(shown) : [];
    const { stage, onError } = useImageCdnFallback(
        `${platformId}:${id}|${headerCandidates.join("|")}`,
        headerCandidates.length
    );

    /** Fixa/desfixa o jogo (a biblioteca relê a linha ao voltar). */
    const togglePin = async () => {
        if (!connected || !game) return;
        const pinned = await platform.togglePin(accounts, id);
        setGame(g => ({ ...g, pinned }));
        showToast(pinned ? tr("gamePinned") : tr("gameUnpinned"), "success");
    };

    const backButton = (
        <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={tr("back")}
            style={({ pressed }) => [styles.roundButton, { opacity: pressed ? 0.8 : 1 }]}
        >
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </Pressable>
    );

    if (loadingGame || !game) {
        return (
            <View style={styles.screen}>
                <View style={styles.fallbackTop}>{backButton}</View>
                <View style={styles.fallbackBody}>
                    {loadingGame ? (
                        <ActivityIndicator size="large" color={COLORS.accent} />
                    ) : (
                        <AppText variant="body" style={{ textAlign: "center" }}>{tr("gameNotFound")}</AppText>
                    )}
                </View>
            </View>
        );
    }

    // Linha abaixo do nome: tempo de jogo (Steam) ou console (RA) + conquistas
    const { unlocked, total } = isSteam ? getGameCounts(game) : platform.toLibraryGame(shown);
    const firstMeta = isSteam
        ? (game.playtimeHidden || !(game.playtime_forever > 0)
            ? playtimeLine(game, tr)
            : tr("playtimePlayed", { time: formatDuration(game.playtime_forever) }))
        : shown.consoleName;
    const name = isSteam ? game.name : shown.title;
    // as abas usam `name` (busca de guias, HowLongToBeat)
    const tabGame = isSteam ? game : { ...shown, name };
    const raIcon = !isSteam ? raMedia(shown.imageIcon) : null;
    const meta = [firstMeta, total > 0 ? tr("achievementsShort", { unlocked, total }) : null]
        .filter(Boolean)
        .join(" · ");

    return (
        <View style={styles.screen}>
            {/* Capa com degradê, voltar, fixar, nome e tempo de jogo */}
            <View style={[styles.hero, compact && styles.heroCompact]}>
                <Image
                    source={stage >= headerCandidates.length ? placeholderImage : { uri: headerCandidates[stage] }}
                    onError={onError}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                />
                <LinearGradient
                    // no modo compacto o nome fica sobre a capa: escurece bem mais
                    colors={compact
                        ? ["rgba(10,14,21,0.6)", "rgba(10,14,21,0.75)", COLORS.bg]
                        : ["rgba(10,14,21,0)", "rgba(10,14,21,0)", COLORS.bg]}
                    locations={compact ? [0, 0.6, 1] : [0, 0.45, 1]}
                    style={StyleSheet.absoluteFill}
                />
                <View style={styles.heroButtons}>
                    {backButton}
                    {/* no modo compacto o nome fica na linha dos botões */}
                    {compact && (
                        <AppText variant="subtitle" style={styles.compactTitle} numberOfLines={1}>
                            {name}
                        </AppText>
                    )}
                    {/* sem alfinete para jogo fora da biblioteca (aberto pela lista "Quero
                        jogar" sem nunca ter sido jogado): a linha dele é temporária */}
                    {notInLibrary ? <View style={styles.roundButtonSpacer} /> : (
                    <Pressable
                        onPress={togglePin}
                        accessibilityRole="button"
                        accessibilityLabel={game.pinned ? tr("unpinGame") : tr("pinGame")}
                        accessibilityState={{ selected: !!game.pinned }}
                        style={({ pressed }) => [styles.roundButton, { opacity: pressed ? 0.8 : 1 }]}
                    >
                        <Ionicons
                            name={game.pinned ? "pin" : "pin-outline"}
                            size={18}
                            color={game.pinned ? COLORS.gold : COLORS.text}
                        />
                    </Pressable>
                    )}
                </View>
                {!compact && (
                    <View style={styles.heroTextsRow}>
                        {raIcon && <Image source={{ uri: raIcon }} style={styles.heroIcon} />}
                        <View style={styles.heroTexts}>
                            <AppText variant="title" style={styles.heroTitle} numberOfLines={2}>{name}</AppText>
                            <Text style={styles.heroMeta} numberOfLines={1}>{meta}</Text>
                        </View>
                    </View>
                )}
            </View>

            <Tab.Navigator
                tabBar={(props) => <SegmentedTabBar {...props} label={tr("gameSections")} />}
                screenOptions={{ sceneStyle: { backgroundColor: COLORS.bg } }}
                screenListeners={({ route: tabRoute }) => ({
                    focus: () => setActiveTab(tabRoute.name),
                })}
            >
                <Tab.Screen name="Detalhes" options={{ title: tr("details") }}>
                    {() => isSteam
                        ? <GameDetailsTab game={game} navigation={navigation} />
                        : <RaGameDetailsTab game={tabGame} details={raGame.details} loading={raGame.loading} />}
                </Tab.Screen>
                <Tab.Screen name="Conquistas" options={{ title: tr("achievements") }}>
                    {() => <AchievementsTab game={tabGame} data={isSteam ? null : raGame} />}
                </Tab.Screen>
            </Tab.Navigator>
        </View>
    );
}

/** Abas do jogo como seletor segmentado (Detalhes | Conquistas). */
function SegmentedTabBar({ state, descriptors, navigation, label }) {
    return (
        <View style={styles.segmentWrap}>
            <View style={styles.segment} accessibilityRole="tablist" accessibilityLabel={label}>
                {state.routes.map((route, index) => {
                    const focused = state.index === index;
                    const title = descriptors[route.key].options.title ?? route.name;
                    return (
                        <Pressable
                            key={route.key}
                            onPress={() => {
                                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
                            }}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: focused }}
                            style={[styles.segmentItem, focused && styles.segmentItemOn]}
                        >
                            <Text style={[styles.segmentLabel, focused ? styles.segmentLabelOn : styles.segmentLabelOff]}>
                                {title}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.bg },
    hero: { height: 200, backgroundColor: COLORS.surface2, justifyContent: "space-between" },
    heroCompact: { height: 120 },
    heroButtons: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 16 },
    // sombra no texto para ler sobre qualquer capa
    compactTitle: {
        flex: 1,
        fontSize: 20,
        textShadowColor: "rgba(0, 0, 0, 0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
    },
    // ocupa o lugar do alfinete quando ele não aparece (mantém o título no lugar)
    roundButtonSpacer: { width: 44, height: 44 },
    roundButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(10, 14, 21, 0.6)",
        alignItems: "center",
        justifyContent: "center",
    },
    heroTextsRow: { flexDirection: "row", alignItems: "flex-end", gap: 12, paddingHorizontal: 20, paddingBottom: 6 },
    heroTexts: { flex: 1, minWidth: 0, gap: 2 },
    // ícone do jogo (RA) ao lado do nome
    heroIcon: { width: 56, height: 56, borderRadius: 12, borderWidth: 2, borderColor: COLORS.bg, backgroundColor: COLORS.surface2 },
    heroTitle: {
        fontSize: 28,
        textShadowColor: "rgba(0, 0, 0, 0.7)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
    },
    heroMeta: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSoft },
    segmentWrap: { paddingHorizontal: 20, paddingTop: 14, backgroundColor: COLORS.bg },
    segment: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 14, backgroundColor: COLORS.surface },
    segmentItem: { flex: 1, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    segmentItemOn: { backgroundColor: COLORS.border },
    segmentLabel: { fontSize: 14 },
    segmentLabelOn: { fontFamily: FONTS.bodySemibold, color: COLORS.text },
    segmentLabelOff: { fontFamily: FONTS.bodyMedium, color: COLORS.textSoft },
    fallbackTop: { padding: 16 },
    fallbackBody: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
});
