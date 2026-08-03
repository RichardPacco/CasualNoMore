import { GetGlobalAchievementsPercentagesForApp, getGameAchievements, getPlayerAchievements } from "@/src/api/steam";

const ICON_CDN = "https://shared.fastly.steamstatic.com/community_assets/images/apps/";

function iconUrl(uri, appid) {
    if (!uri || !appid) return uri;
    const filename = uri.split("/").pop();
    return `${ICON_CDN}${appid}/${filename}`;
}

/**
 * Merge schema, player stats and global percentages into a single
 * array of achievements, ready to be displayed anywhere.
 */
export function mergeAchievements(schema, playerAchievements, globalPerc, fullDescriptions, appid) {
    const achievementsMap = {};
    const unlockMap = {};
    (playerAchievements || []).forEach(a => {
        achievementsMap[a.apiname] = a.achieved === 1;
        unlockMap[a.apiname] = a.unlocktime || 0;
    });

    const percentMap = {};
    (globalPerc || []).forEach(p => {
        percentMap[p.name.toLowerCase()] = p.percent;
    });

    return (schema || []).map(ach => ({
        name: ach.displayName,
        apiname: ach.name,
        description: ach.description || (fullDescriptions && fullDescriptions[ach.name]) || "",
        icon: iconUrl(achievementsMap[ach.name] ? ach.icon : ach.icongray, appid),
        achieved: achievementsMap[ach.name] || false,
        unlocktime: unlockMap[ach.name] || 0,
        globalPercent: percentMap[ach.name.toLowerCase()] || 0
    })).sort((a, b) => b.globalPercent - a.globalPercent);
}

/**
 * Fetch player achievements + global percentages and merge with the schema.
 * Fails softly: any failing source falls back to empty data.
 */
export async function fetchAndMergeAchievements(appid, steamId, schema) {
    const [playerAchievements, globalPerc, gameAchievements] = await Promise.all([
        getPlayerAchievements(appid, steamId).catch(() => null),
        GetGlobalAchievementsPercentagesForApp(appid).catch(() => null),
        getGameAchievements(appid).catch(() => null),
    ]);

    const fullDescriptions = {};
    (gameAchievements || []).forEach(a => {
        fullDescriptions[a.internal_name] = a.localized_desc;
    });

    return mergeAchievements(
        schema || [],
        playerAchievements?.achievements || [],
        globalPerc || [],
        fullDescriptions,
        appid
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
