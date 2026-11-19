import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Linking, StyleSheet, Text, View } from "react-native";
import { getUserAwards, getUserProfile, getUserSummary, raMedia, raUserPic, raUserUrl } from "@/src/api/retroachievements";
import { AppText, Button } from "@/src/components/ui";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS, FONTS } from "@/src/theme/colors";

/**
 * Card da conta do RetroAchievements no Perfil: avatar, nome, status (rich
 * presence), pontos hardcore, RetroPoints, rank e masterizados, e
 * botão para abrir o perfil no site. Os números vêm de GetUserProfile,
 * GetUserSummary (lento, por isso sem jogos/conquistas recentes) e
 * GetUserAwards; se algum falhar, os outros aparecem mesmo assim.
 * Props: account ({ user, ulid, userPic }), refreshKey (muda = busca de novo),
 * onLoaded (chamado ao terminar cada busca).
 */
export default function RaAccountCard({ account, refreshKey = 0, onLoaded }) {
    const { t: tr } = useLanguage();
    const [avatarFailed, setAvatarFailed] = useState(false);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        Promise.allSettled([
            getUserProfile(account.ulid),
            getUserSummary(account.ulid),
            getUserAwards(account.ulid),
        ]).then(([profile, summary, awards]) => {
            if (cancelled) return;
            const p = profile.value, s = summary.value, a = awards.value;
            setStats({
                points: p?.TotalPoints ?? s?.TotalPoints,
                truePoints: p?.TotalTruePoints ?? s?.TotalTruePoints,
                rank: s?.Rank,
                totalRanked: s?.TotalRanked,
                status: p?.RichPresenceMsg || s?.RichPresenceMsg || null,
                masteries: a?.MasteryAwardsCount,
            });
            setLoading(false);
            onLoaded?.();
        });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- onLoaded não deve disparar nova busca
    }, [account.ulid, refreshKey]);

    /** Número formatado, ou "—" se não veio. */
    const num = (v) => (v === undefined || v === null || v === "" ? "—" : Number(v).toLocaleString());
    const avatar = raMedia(account.userPic) ?? raUserPic(account.user);
    const initials = (account.user || "?").slice(0, 2).toUpperCase();

    return (
        <View style={styles.card}>
            <View style={styles.top}>
                {avatar && !avatarFailed ? (
                    <Image
                        source={{ uri: avatar }}
                        onError={() => setAvatarFailed(true)}
                        style={styles.avatar}
                        accessibilityIgnoresInvertColors
                    />
                ) : (
                    <View style={[styles.avatar, styles.fallback]}>
                        <Text style={styles.initials}>{initials}</Text>
                    </View>
                )}
                <View style={styles.texts}>
                    <AppText variant="subtitle" style={{ fontSize: 22 }} numberOfLines={1}>{account.user}</AppText>
                    <Text style={styles.platform}>{tr("platformRa")}</Text>
                    {stats?.status ? <Text style={styles.status} numberOfLines={2}>{stats.status}</Text> : null}
                </View>
            </View>

            {loading && !stats ? (
                <ActivityIndicator size="small" color={COLORS.gold} />
            ) : (
                <View style={styles.statsGrid}>
                    <Stat label={tr("raPoints")} value={num(stats?.points)} />
                    <Stat label={tr("truePoints")} value={num(stats?.truePoints)} />
                    <Stat
                        label={tr("rank")}
                        value={stats?.rank ? tr("rankValue", { rank: num(stats.rank), total: num(stats.totalRanked) }) : "—"}
                    />
                    <Stat label={tr("awardMastered")} value={num(stats?.masteries)} icon="trophy" />
                </View>
            )}
            <Button
                label={tr("viewOnRa")}
                variant="secondary"
                onPress={() => Linking.openURL(raUserUrl(account.user))
                    .catch(err => console.error("Failed to open URL:", err))}
                icon={<Ionicons name="open-outline" size={18} color={COLORS.text} />}
                accessibilityRole="link"
            />
        </View>
    );
}

/** Um número do card (rótulo pequeno em cima, valor embaixo). */
function Stat({ label, value, icon }) {
    return (
        <View style={styles.stat}>
            <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
            <View style={styles.statValueRow}>
                {icon && <Ionicons name={icon} size={14} color={COLORS.gold} />}
                <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { padding: 16, borderRadius: 20, backgroundColor: COLORS.surface, gap: 14 },
    top: { flexDirection: "row", alignItems: "center", gap: 14 },
    avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: COLORS.gold },
    fallback: { backgroundColor: "#3B3466", alignItems: "center", justifyContent: "center" },
    initials: { fontFamily: FONTS.display, fontSize: 22, color: COLORS.text },
    texts: { flex: 1, gap: 2 },
    platform: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.gold },
    status: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    stat: { minWidth: "30%", flexGrow: 1, padding: 10, borderRadius: 14, backgroundColor: COLORS.surface2, gap: 2 },
    statLabel: { fontFamily: FONTS.bodySemibold, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: COLORS.textMuted },
    statValueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    statValue: { fontFamily: FONTS.display, fontSize: 18, color: COLORS.text },
});
