import { getGame, togglePin } from "@/src/database/db";
import { headerUri } from "@/src/utils/cdn";
import { totalPlaytimeText } from "@/src/utils/playtime";
import { toLibraryGame } from "./adapter";

/** Plataforma Steam: o que as telas genéricas precisam saber dela. */
const steam = {
    id: "steam",
    label: "Steam",

    toLibraryGame,

    /** Linha de baixo do nome no card: tempo total de jogo. */
    subtitle: (game, tr) => totalPlaytimeText(game.raw, tr),

    /** Lê o jogo salvo (linha do banco) pelo appid. */
    getGame: (accounts, id) => getGame(accounts.steam.steamId, id),

    /** Fixa/desfixa o jogo. Retorna o novo valor (0 ou 1). */
    togglePin: (accounts, id) => togglePin(accounts.steam.steamId, id),

    /** Capa da tela do jogo: URL da loja salva, a do appdetails e os CDNs antigos. */
    heroImages: (row) => [...new Set([
        row?.headerUrl,
        row?.details?.header_image,
        headerUri(row?.appid, false),
        headerUri(row?.appid, true),
    ].filter(Boolean))],

    /** Biblioteca: todos os filtros e ordenações, com turbo na sincronização. */
    library: {
        filters: ["all", "progress", "played", "neverPlayed", "withAchievements", "withoutAchievements", "completed", "notCompleted", "pinned"],
        sorts: ["recentPlaytime", "totalPlaytime", "name", "progress"],
        hasTurbo: true,
        hasConsoleFilter: false,
    },
};

export default steam;
