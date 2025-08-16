// Importa o config.js
import config from '../config/config'; // ajuste o caminho conforme sua pasta

const BASE_URL = "https://api.steampowered.com";

export const getPlayerSummary = async () => {
    const res = await fetch(
        `${BASE_URL}/ISteamUser/GetPlayerSummaries/v0002/?key=${config.apiKey}&steamids=${config.steamid}`
    );
    const json = await res.json();
    return json.response.players[0];
};

export const getOwnedGames = async () => {
    const res = await fetch(`${BASE_URL}/IPlayerService/GetOwnedGames/v0001/?key=${config.apiKey}&steamid=${config.steamid}&include_appinfo=true&include_played_free_games=1&format=json`);
    const json = await res.json();
    return json.response.games;
};

export const getAchievements = async (appId) => {
    const res = await fetch(
        `${BASE_URL}/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${appId}&key=${config.apiKey}&steamid=${config.steamid}&l=portuguese`
    );
    const json = await res.json();
    return json.playerstats.achievements;
};
