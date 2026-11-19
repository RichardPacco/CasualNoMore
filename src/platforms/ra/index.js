import { raMedia } from "@/src/api/retroachievements";
import { getApiKey } from "@/src/config/apiKeyStore";
import { getRaGame, toggleRaPin } from "@/src/database/raDb";
import { toLibraryGame } from "./adapter";

/** Plataforma RetroAchievements: o que as telas genéricas precisam saber dela. */
const ra = {
    id: "ra",
    label: "RetroAchievements",

    /** Conectada = conta salva e key em memória. */
    isConnected: (accounts) => !!accounts?.ra?.ulid && !!getApiKey("ra"),

    toLibraryGame,

    /** Linha de baixo do nome no card: o console. */
    subtitle: (game) => game.console?.name ?? "",

    /** Lê o jogo salvo (linha do banco) pelo GameID. */
    getGame: (accounts, id) => getRaGame(accounts.ra.ulid, id),

    /** Fixa/desfixa o jogo. Retorna o novo valor (0 ou 1). */
    togglePin: (accounts, id) => toggleRaPin(accounts.ra.ulid, id),

    /** Capa da tela do jogo: tela de título, in-game e o ícone, nessa ordem. */
    heroImages: (row) => [row?.imageTitle, row?.imageIngame, row?.imageIcon].map(raMedia).filter(Boolean),

    /**
     * Biblioteca: filtros e ordenações que fazem sentido no RA (sem tempo de
     * jogo: todo jogo da lista já foi jogado), sem turbo (a sincronização é
     * uma chamada paginada) e com filtro de console e hacks/subsets.
     */
    library: {
        filters: ["all", "progress", "withAchievements", "withoutAchievements", "completed", "notCompleted", "pinned"],
        sorts: ["recentPlaytime", "name", "progress"],
        hasTurbo: false,
        hasConsoleFilter: true,
    },
};

export default ra;
