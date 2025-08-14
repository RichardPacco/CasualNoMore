import { API_KEY, STEAM_ID } from "../config/constants";

const BASE_URL = "https://api.steampowered.com";

export const getPlayerSummary = async () => {
    const res = await fetch(`${BASE_URL}/ISteamUser/GetPlayerSummaries/v0002/?key=${API_KEY}&steamids=${STEAM_ID}`);
    const json = await res.json();
    return json.response.players[0];
};

export const getOwnedGames = async () => {
    const res = await fetch(`${BASE_URL}/IPlayerService/GetOwnedGames/v0001/?key=${API_KEY}&steamid=${STEAM_ID}&include_appinfo=true&include_played_free_games=1&format=json`);
    const json = await res.json();
    return json.response.games;
};

export const getAchievements = async (appId) => {
    const res = await fetch(
        `${BASE_URL}/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${appId}&key=${API_KEY}&steamid=${STEAM_ID}&l=portuguese`
    );
    const json = await res.json();
    return json.playerstats.achievements;
};
