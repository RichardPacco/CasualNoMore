import { GetGlobalAchievementsPercentagesForApp, getPlayerAchievements } from "@/src/api/steam";

/**
 * Merge schema, player stats and global percentages into a single
 * array of achievements, ready to be displayed anywhere.
 */
export function mergeAchievements(schema, playerAchievements, globalPerc) {
    const achievementsMap = {};
    (playerAchievements || []).forEach(a => {
        achievementsMap[a.apiname] = a.achieved === 1;
    });

    const percentMap = {};
    (globalPerc || []).forEach(p => {
        percentMap[p.name.toLowerCase()] = p.percent;
    });

    return (schema || []).map(ach => ({
        name: ach.displayName,
        apiname: ach.name,
        description: ach.description,
        icon: achievementsMap[ach.name] ? ach.icon : ach.icongray,
        achieved: achievementsMap[ach.name] || false,
        globalPercent: percentMap[ach.name.toLowerCase()] || 0
    })).sort((a, b) => b.globalPercent - a.globalPercent);
}

/**
 * Fetch player achievements + global percentages and merge with the schema.
 * Fails softly: any failing source falls back to empty data.
 */
export async function fetchAndMergeAchievements(appid, steamId, schema) {
    const [playerAchievements, globalPerc] = await Promise.all([
        getPlayerAchievements(appid, steamId).catch(() => null),
        GetGlobalAchievementsPercentagesForApp(appid).catch(() => null),
    ]);

    return mergeAchievements(
        schema || [],
        playerAchievements?.achievements || [],
        globalPerc || []
    );
}

/**
 * Compute progress info from a merged achievements array.
 */
export function computeProgress(achievements) {
    const list = achievements || [];
    const total = list.length;
    const unlocked = list.filter(a => a.achieved).length;
    const percent = total > 0 ? (unlocked / total) * 100 : 0;
    return { unlocked, total, percent };
}
