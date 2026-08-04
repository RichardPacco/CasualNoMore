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
 * Fontes secundárias falham silenciosamente; mas se o estado de desbloqueio
 * (getPlayerAchievements) falhar, lança erro — senão o merge mostraria tudo
 * como "não conquistado" e o caller gravaria esse dado falso como "done".
 */
export async function fetchAndMergeAchievements(appid, steamId, schema) {
    const [playerAchievements, globalPerc, gameAchievements] = await Promise.all([
        getPlayerAchievements(appid, steamId).catch(() => null),
        GetGlobalAchievementsPercentagesForApp(appid).catch(() => null),
        getGameAchievements(appid).catch(() => null),
    ]);

    // Se o jogo tem conquistas no schema, o estado de desbloqueio é obrigatório:
    // sem ele o merge mostraria tudo como "não conquistado" (falso) e o caller
    // gravaria esse dado como "done". Jogos sem conquistas (ex: Dota 2) retornam
    // vazio e são tratados normalmente.
    const hasSchemaAchievements = Array.isArray(schema) && schema.length > 0;
    if (hasSchemaAchievements && !(playerAchievements?.achievements?.length > 0)) {
        throw new Error(`fetchAndMergeAchievements: player achievements indisponíveis (${appid})`);
    }

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
