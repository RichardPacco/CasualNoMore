import { getPlayerSummary } from "@/src/api/steam";
import AboutModal from "@/src/components/AboutModal";
import AppUpdateRow from "@/src/components/AppUpdateRow";
import LanguageSelector from "@/src/components/LanguageSelector";
import ProfileSummaryCard from "@/src/components/ProfileSummaryCard";
import PullToRefresh from "@/src/components/PullToRefresh";
import { AppText, Button } from "@/src/components/ui";
import { AuthContext } from "@/src/context/AuthContext";
import { getAllGames } from "@/src/database/db";
import useRaProfileStats from "@/src/hooks/useRaProfileStats";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { getGameCounts } from "@/src/utils/achievements";
import { COLORS, FONTS } from "@/src/theme/colors";
import { useRouter } from "expo-router";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import Pressable from "@/src/components/ui/Pressable";
import { Ionicons } from "@expo/vector-icons";

/**
 * Calcula as estatísticas de progresso: total de jogos da biblioteca, jogos
 * perfeitos (100% de conquistas) e a média de progresso entre os jogos com
 * conquistas.
 */
function computeCompletionStats(cachedGames) {
    const played = cachedGames.filter(g => {
        const { unlocked } = getGameCounts(g);
        return (g.playtime_forever || 0) > 0 || unlocked > 0;
    });

    const withAchievements = played.filter(g => getGameCounts(g).total > 0);
    const perfected = withAchievements.filter(g => {
        const { unlocked, total } = getGameCounts(g);
        return unlocked === total;
    }).length;
    const avgCompletion = withAchievements.length > 0
        ? withAchievements.reduce((sum, g) => sum + getGameCounts(g).percent, 0) / withAchievements.length
        : 0;

    return { games: cachedGames.length, perfected, avgCompletion };
}

/**
 * Perfil (redesign, prancheta 11): um card só para as plataformas conectadas
 * (ProfileSummaryCard: identidade, total de jogos 100% e os números de cada
 * plataforma) e a lista de ajustes (idioma, sobre o app, sair). Puxar para
 * baixo atualiza.
 * Nos ajustes: conectar a plataforma que falta (abre o login no modo
 * "adicionar"), desconectar uma delas (com as duas conectadas) e "Sair", que
 * desconecta todas. As keys continuam salvas para o próximo login.
 */
export default function Profile() {
    const router = useRouter();
    const { steamId, accounts, disconnect } = useContext(AuthContext);
    // alguma conta conectada (não depende da API key em memória)
    const hasAccount = !!accounts.steam || !!accounts.ra;
    const { t: tr } = useLanguage();

    const [profile, setProfile] = useState(null);
    // só a parte da Steam carrega da API; sem Steam não há o que esperar
    const [loading, setLoading] = useState(!!steamId);
    const [refreshingProfile, setRefreshingProfile] = useState(false);
    const [completionStats, setCompletionStats] = useState({ games: 0, perfected: 0, avgCompletion: 0 });
    const [aboutVisible, setAboutVisible] = useState(false);
    // muda a cada puxar para atualizar: o card do RA busca de novo
    const [raRefreshKey, setRaRefreshKey] = useState(0);
    // resolve a espera do puxar para atualizar quando o RA termina de buscar
    const raDoneRef = useRef(null);
    // números do RA (pontos, RetroPoints, rank, masterizados, status)
    const raProfile = useRaProfileStats(accounts.ra, raRefreshKey, () => raDoneRef.current?.());
    const cancelledRef = useRef(false);

    useEffect(() => {
        cancelledRef.current = !steamId;
    }, [steamId]);

    /**
     * Carrega o perfil do usuário na Steam e os jogos em cache para
     * calcular as estatísticas de progresso.
     */
    const loadProfile = useCallback(async () => {
        if (!steamId) return;
        setLoading(true);
        try {
            const [Profile, cachedGames] = await Promise.all([
                getPlayerSummary(steamId),
                getAllGames(steamId),
            ]);
            if (!cancelledRef.current) {
                setProfile(Profile ?? null);
                setCompletionStats(computeCompletionStats(cachedGames));
            }
        } catch (err) {
            console.error("[Profile] Failed to load:", err);
            if (!cancelledRef.current) setProfile(null);
        } finally {
            if (!cancelledRef.current) setLoading(false);
        }
    }, [steamId]);

    /** Atualiza o perfil e as estatísticas ao puxar para atualizar (pull-to-refresh). */
    // O PullToRefresh só volta ao normal quando `refreshing` passa de true
    // para false: sempre liga e espera a Steam e o card do RA terminarem.
    const refreshProfile = useCallback(async () => {
        setRefreshingProfile(true);

        // RA: o hook avisa (onLoaded) quando terminou de buscar; no máximo 20 s
        const raDone = accounts.ra
            ? new Promise(resolve => {
                raDoneRef.current = resolve;
                setTimeout(resolve, 20000);
            })
            : Promise.resolve();
        setRaRefreshKey(k => k + 1);

        const steamDone = (async () => {
            if (!steamId) return;
            try {
                const [Profile, cachedGames] = await Promise.all([
                    getPlayerSummary(steamId),
                    getAllGames(steamId),
                ]);
                if (Profile) setProfile(Profile);
                setCompletionStats(computeCompletionStats(cachedGames));
            } catch (err) {
                console.error("[Profile] Failed to refresh profile:", err);
            }
        })();

        try {
            await Promise.all([steamDone, raDone]);
        } finally {
            raDoneRef.current = null;
            setRefreshingProfile(false);
        }
    }, [steamId, accounts.ra]);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    // Sem nenhuma plataforma conectada (saiu): volta para o login
    useEffect(() => {
        if (!hasAccount) {
            router.replace("/(auth)/login");
        }
    }, [hasAccount, router]);

    /** Abre o login para conectar mais uma plataforma. */
    const connectPlatform = useCallback((platform) => {
        router.push({ pathname: "/(auth)/login", params: { platform, mode: "add" } });
    }, [router]);

    // Plataformas para os ajustes: [id, nome]
    const platformRows = [["steam", tr("platformSteam")], ["ra", tr("platformRa")]];
    const bothConnected = !!accounts.steam && !!accounts.ra;

    /** Sai de todas as plataformas (o redirecionamento acima leva ao login). */
    const logout = useCallback(async () => {
        await disconnect("steam");
        await disconnect("ra");
    }, [disconnect]);

    if (steamId && loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    // Erro ao carregar o perfil (ex.: sem conexão ou chave inválida):
    // tentar de novo, ou sair para o login (o card com o "Sair" não aparece).
    if (steamId && !profile) {
        return (
            <View style={styles.screen}>
                <View style={styles.headerPad}>
                    <AppText variant="title">{tr("tabProfile")}</AppText>
                </View>
                <View style={styles.errorBox}>
                    <View style={styles.errorIcon}>
                        <Ionicons name="alert-circle-outline" size={32} color={COLORS.danger} />
                    </View>
                    <AppText variant="subtitle" style={{ textAlign: "center" }}>{tr("profileUnavailable")}</AppText>
                    <AppText variant="muted" style={{ textAlign: "center", fontSize: 14, lineHeight: 21 }}>
                        {tr("profileLoadError")}
                    </AppText>
                    <Button label={tr("profileRetry")} onPress={loadProfile} style={{ marginTop: 8, alignSelf: "stretch" }} />
                    <Pressable
                        onPress={logout}
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.logoutInline, { opacity: pressed ? 0.8 : 1 }]}
                    >
                        <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
                        <Text style={styles.logoutText}>{tr("logout")}</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <PullToRefresh refreshing={refreshingProfile} onRefresh={refreshProfile}>
                <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
                    <AppText variant="title">{tr("tabProfile")}</AppText>

                    {/* Um card só para as plataformas conectadas */}
                    <ProfileSummaryCard
                        steam={steamId && profile ? { profile, ...completionStats } : null}
                        ra={accounts.ra ? { account: accounts.ra, stats: raProfile.stats, loading: raProfile.loading } : null}
                        onUpdateRaKey={() => router.push({ pathname: "/(auth)/login", params: { platform: "ra", mode: "add", resetKey: "1" } })}
                    />

                    {/* Ajustes: idioma, sobre o app, sair */}
                    <View style={styles.settings}>
                        <View style={styles.settingRow}>
                            <Text style={styles.settingLabel}>{tr("languageLabel")}</Text>
                            <LanguageSelector inset />
                        </View>
                        {/* Conectar a plataforma que falta */}
                        {platformRows.filter(([id]) => !accounts[id]).map(([id, name]) => (
                            <Pressable
                                key={`connect-${id}`}
                                onPress={() => connectPlatform(id)}
                                accessibilityRole="button"
                                style={({ pressed }) => [styles.settingRow, styles.settingDivider, { justifyContent: "flex-start", gap: 10, opacity: pressed ? 0.8 : 1 }]}
                            >
                                <Ionicons name="add-circle-outline" size={18} color={COLORS.accent} />
                                <Text style={[styles.settingLabel, { color: COLORS.accent }]}>
                                    {tr("connectPlatform", { platform: name })}
                                </Text>
                            </Pressable>
                        ))}
                        {/* Desconectar só uma (com as duas conectadas) */}
                        {bothConnected && platformRows.map(([id, name]) => (
                            <Pressable
                                key={`disconnect-${id}`}
                                onPress={() => disconnect(id)}
                                accessibilityRole="button"
                                style={({ pressed }) => [styles.settingRow, styles.settingDivider, { justifyContent: "flex-start", gap: 10, opacity: pressed ? 0.8 : 1 }]}
                            >
                                <Ionicons name="remove-circle-outline" size={18} color={COLORS.textMuted} />
                                <Text style={[styles.settingLabel, { color: COLORS.textSoft }]}>
                                    {tr("disconnectPlatform", { platform: name })}
                                </Text>
                            </Pressable>
                        ))}
                        {/* Atualização pelas releases do GitHub (Android) */}
                        <AppUpdateRow
                            style={[styles.settingRow, styles.settingDivider, { gap: 10 }]}
                            labelStyle={styles.settingLabel}
                        />
                        <Pressable
                            onPress={() => setAboutVisible(true)}
                            accessibilityRole="button"
                            style={({ pressed }) => [styles.settingRow, styles.settingDivider, { opacity: pressed ? 0.8 : 1 }]}
                        >
                            <Text style={styles.settingLabel}>{tr("aboutApp")}</Text>
                            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                        </Pressable>
                        <Pressable
                            onPress={logout}
                            accessibilityRole="button"
                            style={({ pressed }) => [styles.settingRow, styles.settingDivider, { justifyContent: "flex-start", gap: 10, opacity: pressed ? 0.8 : 1 }]}
                        >
                            <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
                            <Text style={[styles.settingLabel, { color: COLORS.danger }]}>{tr("logout")}</Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </PullToRefresh>

            <AboutModal visible={aboutVisible} onClose={() => setAboutVisible(false)} />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg },
    // espaço no fim para o conteúdo não ficar atrás da tab bar flutuante
    content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 110, gap: 14 },
    settings: { borderRadius: 20, backgroundColor: COLORS.surface, overflow: "hidden" },
    settingRow: {
        minHeight: 56,
        paddingHorizontal: 16,
        paddingVertical: 8,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    settingDivider: { borderTopWidth: 1, borderTopColor: COLORS.borderSubtle },
    settingLabel: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.text },
    headerPad: { paddingHorizontal: 20, paddingTop: 20 },
    errorBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12, paddingBottom: 80 },
    errorIcon: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: "rgba(248, 113, 113, 0.12)",
        alignItems: "center",
        justifyContent: "center",
    },
    logoutInline: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16 },
    logoutText: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.danger },
});
