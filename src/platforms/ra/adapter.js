import { raMedia } from "@/src/api/retroachievements";
import { parseRaDate } from "@/src/utils/raDate";

// Jogado nos últimos 14 dias = "Jogados recentemente" (como as 2 semanas da Steam)
const RECENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

// Cache linha do banco -> LibraryGame, um por modo (hardcore/softcore).
// As linhas são trocadas (nunca alteradas) quando o jogo muda, então a mesma
// linha gera o mesmo objeto e o GameCard (memo) só re-renderiza o que mudou.
const caches = { hardcore: new WeakMap(), softcore: new WeakMap() };

/**
 * Marcações que o RA põe no título: "~Hack~", "~Homebrew~" e
 * "[Subset - ...]" (conquistas extras de um jogo, separadas do set principal).
 */
export function raTitleFlags(title = "") {
    return {
        hack: /~hack~/i.test(title),
        homebrew: /~homebrew~/i.test(title),
        subset: /\[subset\b/i.test(title),
    };
}

/**
 * Medalha do card a partir do HighestAwardKind, de acordo com o modo:
 * - mastered (100% hardcore) vale nos dois modos;
 * - completed (100% softcore) e beaten softcore só contam no modo softcore.
 */
function awardFor(kind, mode) {
    switch (kind) {
        case "mastered": return "mastered";
        case "completed": return mode === "softcore" ? "completed" : null;
        case "beaten-hardcore": return "beaten";
        case "beaten-softcore": return mode === "softcore" ? "beaten" : null;
        default: return null;
    }
}

/**
 * Converte uma linha da tabela ra_games_<ulid> para o formato comum de jogo
 * da biblioteca (LibraryGame, ver RETROACHIEVEMENTS_PLAN.md, seção 4.4).
 * `mode`: "hardcore" conta só as conquistas em hardcore; "softcore" conta
 * todas (o NumAwarded do RA já inclui as de hardcore).
 */
export function toLibraryGame(row, mode = "hardcore") {
    const cache = caches[mode] ?? caches.hardcore;
    const cached = cache.get(row);
    if (cached) return cached;

    const total = row.maxPossible || 0;
    const unlocked = Math.min(total, mode === "softcore" ? row.numAwarded || 0 : row.numAwardedHardcore || 0);
    const percent = total > 0 ? (unlocked / total) * 100 : 0;

    // "Recente": quando jogou (RecentlyPlayed) ou, sem isso, a última conquista
    const lastActivity = parseRaDate(row.lastPlayed) ?? parseRaDate(row.mostRecentAwardedDate) ?? 0;
    const icon = raMedia(row.imageIcon);

    const game = {
        key: `ra:${row.gameId}`,
        platform: "ra",
        id: row.gameId,
        name: row.title || "",
        // O RA só tem ícones quadrados (96x96) para todos os jogos
        image: { candidates: icon ? [icon] : [], shape: "square" },
        gridImage: { candidates: icon ? [icon] : [], shape: "square" },
        unlocked,
        total,
        percent,
        award: awardFor(row.highestAwardKind, mode),
        pinned: !!row.pinned,
        // Todo jogo da biblioteca do RA foi aberto com o emulador
        played: true,
        recent: lastActivity > 0 && Date.now() - lastActivity < RECENT_WINDOW_MS,
        // sem tempo de jogo na lista do RA: null vai para o fim
        sortKeys: { recent: lastActivity, playtime: null },
        console: row.consoleId ? { id: row.consoleId, name: row.consoleName || "" } : null,
        flags: raTitleFlags(row.title),
        raw: row,
    };
    cache.set(row, game);
    return game;
}
