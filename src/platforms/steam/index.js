import { getApiKey } from "@/src/config/apiKeyStore";
import { getGame, togglePin } from "@/src/database/db";
import { totalPlaytimeText } from "@/src/utils/playtime";
import { toLibraryGame } from "./adapter";

/** Plataforma Steam: o que as telas genéricas precisam saber dela. */
const steam = {
    id: "steam",
    label: "Steam",

    /** Conectada = conta salva e key em memória. */
    isConnected: (accounts) => !!accounts?.steam?.steamId && !!getApiKey("steam"),

    toLibraryGame,

    /** Linha de baixo do nome no card: tempo total de jogo. */
    subtitle: (game, tr) => totalPlaytimeText(game.raw, tr),

    /** Lê o jogo salvo (linha do banco) pelo appid. */
    getGame: (accounts, id) => getGame(accounts.steam.steamId, id),

    /** Fixa/desfixa o jogo. Retorna o novo valor (0 ou 1). */
    togglePin: (accounts, id) => togglePin(accounts.steam.steamId, id),
};

export default steam;
