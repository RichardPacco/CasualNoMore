// src/api/steam.js
import config from "../config/config"; // ajuste caminho
const BASE_URL = "https://api.steampowered.com";

async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function GetGlobalAchievementsPercentagesForApp(appId) {
    if (!appId) throw new Error("getAchievements: appId é obrigatório");

    const url = `${BASE_URL}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${encodeURIComponent(
        appId
    )}`
    const json = await fetchJson(url)
    return json?.achievementpercentages?.achievements ?? null;
}

export async function GetSchemaForGame(appId, steamId, lang = "portuguese") {
    if (!appId) throw new Error("getAchievements: appId é obrigatório");
    if (!steamId) throw new Error("getAchievements: steamId é obrigatório");

    const url = `${BASE_URL}/ISteamUserStats/GetSchemaForGame/v2/?key=${encodeURIComponent(
        config.apiKey
    )}&appid=${encodeURIComponent(
        appId
    )}&l=${encodeURIComponent(lang)}&format=json`
    const json = await fetchJson(url)
    return json?.game?.availableGameStats?.achievements ?? null;
}

export async function resolveVanityURL(vanity) {
    if (!vanity) return null;
    const url = `${BASE_URL}/ISteamUser/ResolveVanityURL/v1/?key=${encodeURIComponent(
        config.apiKey
    )}&vanityurl=${encodeURIComponent(vanity)}`;
    const json = await fetchJson(url);
    return json?.response ?? null; // { success, steamid, message }
}

export async function getPlayerSummary(steamId) {
    if (!steamId) throw new Error("getPlayerSummary: steamId é obrigatório");
    const url = `${BASE_URL}/ISteamUser/GetPlayerSummaries/v0002/?key=${encodeURIComponent(
        config.apiKey
    )}&steamids=${encodeURIComponent(steamId)}`;
    const json = await fetchJson(url);
    return json?.response?.players?.[0] ?? null;
}

export async function getOwnedGames(steamId) {
    if (!steamId) throw new Error("getOwnedGames: steamId é obrigatório");
    const url = `${BASE_URL}/IPlayerService/GetOwnedGames/v0001/?key=${encodeURIComponent(
        config.apiKey
    )}&steamid=${encodeURIComponent(steamId)}&include_appinfo=1&include_played_free_games=1&format=json`;
    const json = await fetchJson(url);
    return json?.response ?? { games: [], game_count: 0 };
}

export async function getPlayerAchievements(appId, steamId, lang = "portuguese") {
    if (!appId) throw new Error("getPlayerAchievements: appId é obrigatório");
    if (!steamId) throw new Error("getPlayerAchievements: steamId é obrigatório");
    const url = `${BASE_URL}/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${encodeURIComponent(
        appId
    )}&key=${encodeURIComponent(config.apiKey)}&steamid=${encodeURIComponent(
        steamId
    )}&l=${encodeURIComponent(lang)}`;
    const json = await fetchJson(url);
    return json?.playerstats ?? null; // { steamID, gameName, achievements: [...] }
}
