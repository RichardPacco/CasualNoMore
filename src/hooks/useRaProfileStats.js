import { useEffect, useState } from "react";
import { getUserAwards, getUserProfile, getUserSummary } from "@/src/api/retroachievements";

/**
 * Números da conta do RetroAchievements para o Perfil: pontos, RetroPoints,
 * rank (e o total de usuários no ranking), masterizados e status (rich presence), de GetUserProfile,
 * GetUserSummary (lento, por isso sem jogos/conquistas recentes) e
 * GetUserAwards. Se uma chamada falhar, as outras aparecem mesmo assim.
 * Também indica key revogada (401) e conta fora do ranking.
 *
 * `account` null = RA não conectado (não busca). `refreshKey` mudou = busca
 * de novo. `onLoaded` é chamado ao terminar cada busca (puxar para atualizar).
 */
export default function useRaProfileStats(account, refreshKey = 0, onLoaded) {
    const ulid = account?.ulid ?? null;
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(!!ulid);

    useEffect(() => {
        if (!ulid) {
            setStats(null);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        Promise.allSettled([getUserProfile(ulid), getUserSummary(ulid), getUserAwards(ulid)])
            .then(([profile, summary, awards]) => {
                if (cancelled) return;
                const p = profile.value, s = summary.value, a = awards.value;
                setStats({
                    // 401 em qualquer chamada = a key foi revogada/trocada no site
                    keyInvalid: [profile, summary, awards].some(r => r.status === "rejected" && r.reason?.status === 401),
                    untracked: !!Number(p?.Untracked ?? s?.Untracked ?? 0),
                    points: p?.TotalPoints ?? s?.TotalPoints,
                    retroPoints: p?.TotalTruePoints ?? s?.TotalTruePoints,
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
    }, [ulid, refreshKey]);

    return { stats, loading };
}
