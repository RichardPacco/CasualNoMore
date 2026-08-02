import { AuthContext } from "@/src/context/AuthContext";
import { computeProgress, fetchAndMergeAchievements } from "@/src/utils/achievements";
import { useContext, useEffect, useState } from "react";

export default function useAchievements(game) {
    const { steamId } = useContext(AuthContext);

    const appid = game?.appid;
    const gameName = game?.name;
    const gameSchema = game?.schema;
    const cachedAchievements = game?.achievements;

    const [mergedCheevos, setMergedCheevos] = useState(cachedAchievements || []);
    const [loading, setLoading] = useState(!cachedAchievements);

    useEffect(() => {
        if (!appid) return;

        // Já temos tudo cacheado, não precisa buscar de novo
        if (cachedAchievements) {
            setMergedCheevos(cachedAchievements);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);

        async function fetchAll() {
            try {
                const merged = await fetchAndMergeAchievements(appid, steamId, gameSchema || []);
                if (!cancelled) setMergedCheevos(merged);
            } catch (err) {
                console.error("Error fetching achievements for", gameName, err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchAll();
        return () => {
            cancelled = true;
        };
    }, [appid, gameName, gameSchema, cachedAchievements, steamId]);

    const { unlocked, total, percent } = computeProgress(mergedCheevos);

    return { mergedCheevos, loading, unlocked, total, percent };
}
