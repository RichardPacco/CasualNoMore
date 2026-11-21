import { getGameCounts } from "@/src/utils/achievements";
import { capsuleUri, headerUri, imageCandidates } from "@/src/utils/cdn";

// Cache linha do banco -> LibraryGame. As linhas são trocadas (nunca
// alteradas) quando o jogo muda, então a mesma linha sempre gera o mesmo
// objeto: o GameCard (memo) só re-renderiza os jogos que mudaram.
const cache = new WeakMap();

/**
 * Converte uma linha da tabela games_<steamId> para o formato comum de jogo
 * da biblioteca (LibraryGame, ver RETROACHIEVEMENTS_PLAN.md, seção 4.4).
 * `raw` guarda a linha original para o que ainda é só da Steam.
 */
export function toLibraryGame(row) {
    const cached = cache.get(row);
    if (cached) return cached;

    const { unlocked, total, percent } = getGameCounts(row);
    const playtime = row.playtime_forever || 0;
    const recentPlaytime = row.playtime_2weeks || 0;

    const game = {
        key: `steam:${row.appid}`,
        platform: "steam",
        id: row.appid,
        name: row.name || "",
        // Imagens: URL da loja (com hash, funciona para jogos novos) primeiro;
        // depois os CDNs antigos montados pelo appid.
        image: {
            candidates: imageCandidates(row.capsuleUrl, fb => capsuleUri(row.appid, fb)),
            shape: "capsule",
        },
        gridImage: {
            candidates: imageCandidates(row.headerUrl, fb => headerUri(row.appid, fb)),
            shape: "header",
        },
        unlocked,
        total,
        percent,
        award: total > 0 && unlocked === total ? "complete" : null,
        pinned: !!row.pinned,
        played: playtime > 0,
        recent: recentPlaytime > 0,
        sortKeys: { recent: recentPlaytime, playtime },
        raw: row,
    };
    cache.set(row, game);
    return game;
}
