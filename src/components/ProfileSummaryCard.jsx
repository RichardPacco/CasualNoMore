import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Image, Linking, StyleSheet, Text, View } from "react-native";
import { raMedia, raUserPic, raUserUrl } from "@/src/api/retroachievements";
import { AppText, Button } from "@/src/components/ui";
import Pressable from "@/src/components/ui/Pressable";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";
import { personaStatus } from "@/src/utils/personaStatus";

const STEAM = COLORS.accent;
const RA = COLORS.gold;

/** Número formatado, ou "—" se não veio. */
const num = (v) => (v === undefined || v === null || v === "" ? "—" : Number(v).toLocaleString());

/**
 * "Top X%" do rank no RA (posição / usuários no ranking), como no site:
 * 2 casas abaixo de 10%, 1 casa até 100%. null sem os dois números.
 */
function topPercent(rank, totalRanked, language) {
    const r = Number(rank), t = Number(totalRanked);
    if (!(r > 0) || !(t > 0)) return null;
    const pct = Math.min(100, (r / t) * 100);
    return pct.toLocaleString(language === "pt" ? "pt-BR" : "en-US", {
        minimumFractionDigits: pct < 10 ? 2 : 1,
        maximumFractionDigits: pct < 10 ? 2 : 1,
    });
}

/** Abre um link externo, registrando falhas no console. */
function openUrl(url) {
    if (url) Linking.openURL(url).catch(err => console.error("Failed to open URL:", url, err));
}

/**
 * Card único do Perfil para Steam e RetroAchievements: avatar,
 * nome e um selo que acompanha a identidade mostrada: status na Steam ou
 * rank e top % no RA (tocar abre o perfil no site); no fim,
 * o que está jogando agora no RA (rich presence); o total de jogos 100% em destaque, uma barra com quanto vem de
 * cada plataforma e um bloco de números de cada uma. Com uma plataforma só,
 * mostra só a parte dela.
 *
 * Props:
 * - steam: { profile (GetPlayerSummaries), perfected, avgCompletion, games } | null
 * - ra: { account ({ user, ulid, userPic }), stats (useRaProfileStats), loading } | null
 * - onUpdateRaKey: abre o login do RA para uma key nova (key revogada)
 */
export default function ProfileSummaryCard({ steam, ra, onUpdateRaKey }) {
    const { t: tr, language } = useLanguage();
    const [avatarFailed, setAvatarFailed] = useState(false);

    const raStats = ra?.stats;
    // selo do RA: "RA · #1.234 · Top 2,35%" (sem rank: só o nome)
    const raTop = topPercent(raStats?.rank, raStats?.totalRanked, language);
    const raPill = raStats?.rank
        ? ["RA", `#${num(raStats.rank)}`, raTop ? tr("raTopPercent", { percent: raTop }) : null].filter(Boolean).join(" · ")
        : "RetroAchievements";

    // Cabeçalho: começa na identidade da Steam (se conectada); com as duas
    // conectadas, tocar no avatar alterna entre a da Steam e a do RA
    const [showRa, setShowRa] = useState(false);
    const canSwap = !!steam && !!ra;
    const useRa = !steam || (canSwap && showRa);
    const avatar = useRa
        ? (ra ? raMedia(ra.account.userPic) ?? raUserPic(ra.account.user) : null)
        : steam?.profile?.avatarfull ?? null;
    const name = (useRa ? ra?.account.user : steam?.profile?.personaname) ?? "";
    const initials = name.slice(0, 2).toUpperCase() || "?";
    const ringColor = useRa ? RA : STEAM;
    // status da Steam (Online, Offline, Ausente...) para o selo da identidade Steam
    const steamStatus = steam ? personaStatus(steam.profile?.personastate, tr) : null;

    /** Alterna a identidade do cabeçalho (Steam ↔ RA). */
    const swapIdentity = () => {
        setAvatarFailed(false);
        setShowRa(v => !v);
    };

    // Destaque: jogos 100% (perfeitos na Steam + masterizados no RA)
    const steamDone = steam ? steam.perfected || 0 : 0;
    const raDone = ra ? Number(raStats?.masteries) || 0 : 0;
    const total = steamDone + raDone;
    const both = !!steam && !!ra;
    const steamShare = total > 0 ? (steamDone / total) * 100 : 50;
    const heroLabel = both ? tr("summaryTotalBoth") : steam ? tr("summaryTotalSteam") : tr("summaryTotalRa");

    return (
        <View style={styles.card}>
            {/* Identidade (toque no avatar alterna Steam ↔ RA) e o selo do RA */}
            <View style={styles.top}>
                <Pressable
                    onPress={swapIdentity}
                    disabled={!canSwap}
                    accessibilityRole="button"
                    accessibilityLabel={useRa ? tr("profileShowSteam") : tr("profileShowRa")}
                    accessibilityState={{ disabled: !canSwap }}
                    style={({ pressed }) => [styles.avatarButton, { opacity: pressed ? 0.8 : 1 }]}
                >
                    {avatar && !avatarFailed ? (
                        <Image
                            key={avatar}
                            source={{ uri: avatar }}
                            onError={() => setAvatarFailed(true)}
                            style={[styles.avatar, { borderColor: ringColor }]}
                            accessibilityIgnoresInvertColors
                        />
                    ) : (
                        <View style={[styles.avatar, styles.avatarFallback, { borderColor: ringColor }]}>
                            <Text style={styles.initials}>{initials}</Text>
                        </View>
                    )}
                    {/* indica que dá para trocar: um ícone pequeno de troca */}
                    {canSwap && (
                        <View style={[styles.swapBadge, { backgroundColor: ringColor }]}>
                            <Ionicons name="swap-horizontal" size={11} color={COLORS.onAccent} />
                        </View>
                    )}
                </Pressable>
                <View style={styles.identity}>
                    <AppText variant="subtitle" style={{ fontSize: 20 }} numberOfLines={1}>{name}</AppText>
                    {/* o selo acompanha a identidade: posição no RA ou status na Steam */}
                    <View style={styles.chips}>
                        {useRa ? (
                            ra && (
                                <Pill
                                    color={RA}
                                    label={raPill}
                                    a11y={tr("viewOnRa")}
                                    onPress={() => openUrl(raUserUrl(ra.account.user))}
                                />
                            )
                        ) : (
                            steamStatus && (
                                <Pill
                                    color={steamStatus.color}
                                    label={steamStatus.text}
                                    a11y={tr("viewSteamProfile")}
                                    onPress={() => openUrl(steam.profile?.profileurl)}
                                />
                            )
                        )}
                    </View>
                </View>
            </View>

            {/* RA: key revogada / conta fora do ranking */}
            {ra && raStats?.keyInvalid && (
                <View style={styles.warning}>
                    <Text style={styles.warningText}>{tr("raKeyRevoked")}</Text>
                    <Button label={tr("raUpdateKey")} variant="secondary" onPress={onUpdateRaKey} />
                </View>
            )}
            {ra && raStats?.untracked && !raStats?.keyInvalid && (
                <Text style={styles.untracked}>{tr("raUntracked")}</Text>
            )}

            {/* Destaque: total de jogos 100% (o rótulo fica só para o leitor de tela) */}
            <View style={styles.hero} accessible accessibilityLabel={`${num(total)} ${heroLabel}`}>
                <View style={styles.heroRow}>
                    <Ionicons name="trophy" size={22} color={COLORS.gold} />
                    {ra && ra.loading && !raStats
                        ? <ActivityIndicator size="small" color={COLORS.gold} />
                        : <Text style={styles.heroValue}>{num(total)}</Text>}
                </View>
            </View>

            {/* Quanto vem de cada plataforma (só com as duas) */}
            {both && (
                <View style={{ gap: 6 }}>
                    <View
                        style={styles.bar}
                        accessible
                        accessibilityLabel={`${tr("summarySteamPerfected", { n: num(steamDone) })}, ${tr("summaryRaMastered", { n: num(raDone) })}`}
                    >
                        <View style={{ width: `${steamShare}%`, backgroundColor: STEAM }} />
                        <View style={{ flex: 1, backgroundColor: RA }} />
                    </View>
                    <View style={styles.barLabels}>
                        <Text style={[styles.barLabel, { color: STEAM }]}>{tr("summarySteamPerfected", { n: num(steamDone) })}</Text>
                        <Text style={[styles.barLabel, { color: RA }]}>{tr("summaryRaMastered", { n: num(raDone) })}</Text>
                    </View>
                </View>
            )}

            {/* Números de cada plataforma */}
            <View style={styles.blocks}>
                {steam && (
                    <Block color={STEAM} title="Steam">
                        <Line value={num(steam.games)} label={tr("summaryGames")} />
                        <Line value={`${(steam.avgCompletion || 0).toFixed(1)}%`} label={tr("profileAvgCompletion")} />
                    </Block>
                )}
                {ra && (
                    <Block color={RA} title="RetroAchievements">
                        <Line value={num(raStats?.points)} label={tr("raPoints")} />
                        <Line value={num(raStats?.retroPoints)} label={tr("truePoints")} />
                    </Block>
                )}
            </View>

            {/* RA: o que está jogando agora (rich presence), no fim do card */}
            {ra && raStats?.status ? (
                <View style={styles.presenceRow} accessible accessibilityLabel={raStats.status}>
                    <Ionicons name="game-controller-outline" size={16} color={RA} />
                    <Text style={styles.presence} numberOfLines={2}>{raStats.status}</Text>
                </View>
            ) : null}
        </View>
    );
}

/** Selo de plataforma no cabeçalho; tocar abre o perfil no site. */
function Pill({ color, label, a11y, onPress }) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="link"
            accessibilityLabel={a11y}
            hitSlop={{ top: 12, bottom: 12 }}
            style={({ pressed }) => [styles.pill, { backgroundColor: `${color}24`, opacity: pressed ? 0.75 : 1 }]}
        >
            <Text style={[styles.pillText, { color }]} numberOfLines={1}>{label}</Text>
        </Pressable>
    );
}

/** Bloco de números de uma plataforma (título na cor dela), números lado a lado. */
function Block({ color, title, children }) {
    return (
        <View style={styles.block}>
            <Text style={[styles.blockTitle, { color }]} numberOfLines={1}>{title}</Text>
            <View style={styles.blockLines}>{children}</View>
        </View>
    );
}

/** Uma linha "valor rótulo" dentro do bloco. */
function Line({ value, label }) {
    return (
        <Text style={styles.line} numberOfLines={1}>
            <Text style={styles.lineValue}>{value}</Text> {label}
        </Text>
    );
}

const styles = StyleSheet.create({
    card: { padding: 16, borderRadius: 20, backgroundColor: COLORS.surface, gap: 16 },
    top: { flexDirection: "row", alignItems: "center", gap: 14 },
    avatarButton: { width: 56, height: 56 },
    avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2 },
    swapBadge: {
        position: "absolute",
        right: -2,
        bottom: -2,
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: COLORS.surface,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarFallback: { backgroundColor: "#22405E", alignItems: "center", justifyContent: "center" },
    initials: { fontFamily: FONTS.display, fontSize: 20, color: COLORS.text },
    identity: { flex: 1, minWidth: 0, gap: 6 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, maxWidth: "100%" },
    pillText: { fontFamily: FONTS.bodySemibold, fontSize: 11 },
    presenceRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 2 },
    presence: { flex: 1, fontFamily: FONTS.body, fontSize: 13, lineHeight: 18, color: COLORS.textSoft },
    warning: {
        padding: 12,
        borderRadius: 14,
        backgroundColor: "rgba(248, 113, 113, 0.10)",
        borderWidth: 1,
        borderColor: "rgba(248, 113, 113, 0.35)",
        gap: 10,
    },
    warningText: { fontFamily: FONTS.bodyMedium, fontSize: 13, lineHeight: 19, color: COLORS.text },
    untracked: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.gold },
    hero: { alignItems: "center", gap: 2, paddingVertical: 4 },
    heroRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40 },
    heroValue: { fontFamily: FONTS.display, fontSize: 40, lineHeight: 44, color: COLORS.text },
    bar: { height: 10, borderRadius: 5, overflow: "hidden", flexDirection: "row", backgroundColor: COLORS.surface2 },
    barLabels: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    barLabel: { fontFamily: FONTS.bodySemibold, fontSize: 12, flexShrink: 1 },
    // um bloco por linha, largura inteira; os números dele lado a lado
    blocks: { gap: 8 },
    block: { padding: 12, borderRadius: 14, backgroundColor: COLORS.surface2, gap: 6 },
    blockLines: { flexDirection: "row", flexWrap: "wrap", columnGap: 18, rowGap: 2 },
    blockTitle: { fontFamily: FONTS.bodySemibold, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
    line: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSoft },
    lineValue: { fontFamily: FONTS.bodySemibold, color: COLORS.text },
});
