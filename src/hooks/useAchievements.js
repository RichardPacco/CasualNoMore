import { GetGlobalAchievementsPercentagesForApp, getPlayerAchievements } from "@/src/api/steam";
import { AuthContext } from "@/src/context/AuthContext";
import { useContext, useEffect, useState } from "react";

export default function useAchievements(game) {
    const { steamId } = useContext(AuthContext);

    const appid = game?.appid;
    const gameName = game?.name;
    const gameSchema = game?.schema;

    const [mergedCheevos, setMergedCheevos] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!appid) return;

        let cancelled = false;
        setLoading(true);

        async function fetchAll() {
            try {
                const schemaData = gameSchema || [];

                // Try fetching player achievements, fallback to empty array
                let playerAchievements = { achievements: [] };
                try {
                    playerAchievements = await getPlayerAchievements(appid, steamId);
                } catch (err) {
                    console.warn(`No player achievements for ${gameName}`, err);
                }

                // Try fetching global percentages, fallback to empty
                let globalPerc = [];
                try {
                    globalPerc = await GetGlobalAchievementsPercentagesForApp(appid);
                } catch (err) {
                    console.warn(`No global percentages for ${gameName}`, err);
                }

                const achievementsList = playerAchievements?.achievements || [];

                // Merge achievements only if schema exists
                let merged = [];
                if (schemaData.length > 0) {
                    const achievementsMap = {};
                    achievementsList.forEach(a => {
                        achievementsMap[a.apiname] = a.achieved === 1;
                    });

                    const percentMap = {};
                    (globalPerc || []).forEach(p => {
                        percentMap[p.name.toLowerCase()] = p.percent;
                    });

                    merged = schemaData.map(ach => ({
                        name: ach.displayName,
                        apiname: ach.name,
                        description: ach.description,
                        icon: achievementsMap[ach.name] ? ach.icon : ach.icongray,
                        achieved: achievementsMap[ach.name] || false,
                        globalPercent: percentMap[ach.name.toLowerCase()] || 0
                    }));

                    merged.sort((a, b) => b.globalPercent - a.globalPercent);
                }

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
    }, [appid, gameName, gameSchema, steamId]);

    const total = gameSchema?.length ?? 0;
    const unlocked = mergedCheevos.filter(a => a.achieved).length;
    const percent = total > 0 ? (unlocked / total) * 100 : 0;

    return { mergedCheevos, loading, unlocked, total, percent };
}
