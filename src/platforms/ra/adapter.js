import { raBadge, raMedia } from "@/src/api/retroachievements";
import { parseRaDate } from "@/src/utils/raDate";

// Jogado nos últimos 14 dias = "Jogados recentemente" (como as 2 semanas da Steam)
const RECENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

// Cache linha do banco -> LibraryGame. As linhas são trocadas (nunca
// alteradas) quando o jogo muda, então a mesma linha gera o mesmo objeto e o
// GameCard (memo) só re-renderiza o que mudou.
const cache = new WeakMap();

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
 * Medalha do card a partir do HighestAwardKind. Só hardcore conta (decisão
 * D2): mastered (100% hardcore) e beaten hardcore. "completed" e "beaten
 * softcore" são de softcore e não ganham medalha.
 */
function awardFor(kind) {
    switch (kind) {
        case "mastered": return "mastered";
        case "beaten-hardcore": return "beaten";
        default: return null;
    }
}

/**
 * Converte uma linha da tabela ra_games_<ulid> para o formato comum de jogo
 * da biblioteca (LibraryGame, ver RETROACHIEVEMENTS_PLAN.md, seção 4.4).
 * Só as conquistas em hardcore contam no progresso (decisão D2).
 */
export function toLibraryGame(row) {
    const cached = cache.get(row);
    if (cached) return cached;

    const total = row.maxPossible || 0;
    const unlocked = Math.min(total, row.numAwardedHardcore || 0);
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
        award: awardFor(row.highestAwardKind),
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

/**
 * Tipo da conquista normalizado: "progression", "win_condition", "missable"
 * ou null. Aceita variações de nome do campo e de escrita ("Missable",
 * "win-condition"...), para não perder a etiqueta se a API mudar a forma.
 */
function achievementType(a) {
    const raw = a?.type ?? a?.Type ?? a?.AchievementType ?? null;
    if (!raw) return null;
    const value = String(raw).trim().toLowerCase().replace(/[\s-]+/g, "_");
    return value === "progression" || value === "win_condition" || value === "missable" ? value : null;
}

/**
 * Converte as conquistas de GetGameInfoAndUserProgress para o formato comum
 * (o mesmo da Steam: name, description, icon, achieved, unlocktime,
 * globalPercent), mais os campos do RA: points, trueRatio, type, order e
 * softcoreUnlocktime. Só hardcore conta (decisão D2): `achieved` = desbloqueada
 * em hardcore; a raridade é entre os jogadores de hardcore.
 * Volta na ordem do autor do set (DisplayOrder).
 */
export function toAchievements(info) {
    const list = Object.values(info?.Achievements ?? {});
    const playersHardcore = Number(info?.NumDistinctPlayersHardcore) || Number(info?.NumDistinctPlayers) || 0;

    return list
        .map(a => {
            const hardcoreAt = parseRaDate(a.DateEarnedHardcore);
            const softcoreAt = parseRaDate(a.DateEarned);
            const achieved = !!hardcoreAt;
            const awardedHardcore = Number(a.NumAwardedHardcore) || 0;
            return {
                apiname: String(a.ID),
                id: Number(a.ID),
                name: a.Title || "",
                description: a.Description || "",
                icon: raBadge(a.BadgeName, !achieved),
                achieved,
                unlocktime: achieved ? Math.floor(hardcoreAt / 1000) : 0,
                // desbloqueada só em softcore: não conta, mas aparece na ficha
                softcoreUnlocktime: !achieved && softcoreAt ? Math.floor(softcoreAt / 1000) : 0,
                globalPercent: playersHardcore > 0 ? Math.min(100, (awardedHardcore / playersHardcore) * 100) : 0,
                points: Number(a.Points) || 0,
                trueRatio: Number(a.TrueRatio) || 0,
                type: achievementType(a),
                order: Number(a.DisplayOrder) || 0,
            };
        })
        .sort((a, b) => a.order - b.order || a.id - b.id);
}

/** Informações do jogo (aba Detalhes) a partir de GetGameInfoAndUserProgress. */
export function toDetails(info) {
    if (!info) return null;
    return {
        consoleName: info.ConsoleName || null,
        publisher: info.Publisher || null,
        developer: info.Developer || null,
        genre: info.Genre || null,
        released: info.Released || null,
        releasedGranularity: info.ReleasedAtGranularity || null,
        guideUrl: info.GuideURL || null,
        forumTopicId: Number(info.ForumTopicID) || null,
        players: Number(info.NumDistinctPlayers) || 0,
        playersHardcore: Number(info.NumDistinctPlayersHardcore) || 0,
    };
}
