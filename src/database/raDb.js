import { ensureCustomTable, openDB, parseJson, runInTransaction } from "@/src/database/db";

/**
 * Banco local do RetroAchievements: uma tabela de jogos por conta,
 * `ra_games_<ulid>` (o ULID não muda quando o usuário troca de nome).
 * Ver RETROACHIEVEMENTS_PLAN.md, seção 4.3.
 */

const COLUMNS_SQL = `
    gameId INTEGER PRIMARY KEY NOT NULL,
    title TEXT,
    consoleId INTEGER,
    consoleName TEXT,
    imageIcon TEXT,
    imageTitle TEXT,
    imageIngame TEXT,
    imageBoxArt TEXT,
    maxPossible INTEGER DEFAULT 0,
    numAwarded INTEGER DEFAULT 0,
    numAwardedHardcore INTEGER DEFAULT 0,
    highestAwardKind TEXT,
    highestAwardDate TEXT,
    mostRecentAwardedDate TEXT,
    lastPlayed TEXT,
    achievements TEXT,
    achievementsStatus TEXT DEFAULT 'pending',
    achievementsSyncedAt INTEGER,
    details TEXT,
    pinned INTEGER DEFAULT 0
`;

// Colunas que a sincronização da biblioteca (GetUserCompletionProgress)
// atualiza. As outras (fixado, conquistas, detalhes, imagens grandes) são
// locais ou vêm de outras chamadas e não podem ser apagadas pela sincronização.
const PROGRESS_COLUMNS = [
    "gameId", "title", "consoleId", "consoleName", "imageIcon",
    "maxPossible", "numAwarded", "numAwardedHardcore",
    "highestAwardKind", "highestAwardDate", "mostRecentAwardedDate",
];

/** Nome da tabela da conta (só letras e números, por segurança). */
function tableFor(ulid) {
    const safe = String(ulid || "").replace(/[^A-Za-z0-9]/g, "");
    if (!safe) throw new Error("[raDb] ULID inválido");
    return `ra_games_${safe}`;
}

/** Garante a tabela de jogos da conta e retorna o nome. */
export function ensureRaTable(ulid) {
    return ensureCustomTable(tableFor(ulid), COLUMNS_SQL);
}

/** Converte uma linha do banco (faz parse dos campos JSON). */
function fromRow(row) {
    if (!row) return null;
    return { ...row, achievements: parseJson(row.achievements), details: parseJson(row.details) };
}

/** Todos os jogos salvos da conta. */
export async function getAllRaGames(ulid) {
    try {
        const table = await ensureRaTable(ulid);
        const db = await openDB();
        const rows = await db.getAllAsync(`SELECT * FROM ${table}`);
        return rows.map(fromRow);
    } catch (err) {
        console.error("[raDb] getAllRaGames failed", err);
        return [];
    }
}

/** Um jogo salvo da conta (ou null). */
export async function getRaGame(ulid, gameId) {
    try {
        const table = await ensureRaTable(ulid);
        const db = await openDB();
        return fromRow(await db.getFirstAsync(`SELECT * FROM ${table} WHERE gameId = ?`, [gameId]));
    } catch (err) {
        console.error("[raDb] getRaGame failed", gameId, err);
        return null;
    }
}

/**
 * Grava o progresso da biblioteca (um item de GetUserCompletionProgress por
 * jogo): insere os jogos novos e, nos que já existem, atualiza só as colunas
 * de progresso (PROGRESS_COLUMNS). Tudo numa transação.
 */
export async function saveRaProgressBatch(ulid, results) {
    if (!results?.length) return;
    const table = await ensureRaTable(ulid);
    const placeholders = PROGRESS_COLUMNS.map(() => "?").join(", ");
    const updates = PROGRESS_COLUMNS.slice(1).map(c => `${c} = excluded.${c}`).join(", ");
    const sql = `INSERT INTO ${table} (${PROGRESS_COLUMNS.join(", ")}) VALUES (${placeholders})
        ON CONFLICT(gameId) DO UPDATE SET ${updates}`;

    await runInTransaction(async (db) => {
        for (const r of results) {
            await db.runAsync(sql, [
                Number(r.GameID),
                r.Title ?? null,
                Number(r.ConsoleID) || null,
                r.ConsoleName ?? null,
                r.ImageIcon ?? null,
                Number(r.MaxPossible) || 0,
                Number(r.NumAwarded) || 0,
                Number(r.NumAwardedHardcore) || 0,
                r.HighestAwardKind ?? null,
                r.HighestAwardDate ?? null,
                r.MostRecentAwardedDate ?? null,
            ]);
        }
    });
}

/**
 * Grava o que vem de GetUserRecentlyPlayedGames: data em que o jogo foi
 * jogado e as imagens grandes (box art, tela de título, in-game). Só atualiza
 * jogos que já estão na tabela.
 */
export async function saveRaRecentlyPlayed(ulid, list) {
    if (!list?.length) return;
    const table = await ensureRaTable(ulid);
    const sql = `UPDATE ${table} SET lastPlayed = ?,
        imageBoxArt = COALESCE(?, imageBoxArt),
        imageTitle = COALESCE(?, imageTitle),
        imageIngame = COALESCE(?, imageIngame)
        WHERE gameId = ?`;

    await runInTransaction(async (db) => {
        for (const g of list) {
            await db.runAsync(sql, [
                g.LastPlayed ?? null,
                g.ImageBoxArt ?? null,
                g.ImageTitle ?? null,
                g.ImageIngame ?? null,
                Number(g.GameID),
            ]);
        }
    });
}

/**
 * Remove os jogos que não vieram na biblioteca do RA (ex.: reset de
 * progresso). `presentIds` = GameIDs que a API acabou de retornar.
 * Retorna os ids removidos.
 */
export async function deleteRaGamesNotPresent(ulid, presentIds) {
    const table = await ensureRaTable(ulid);
    const present = new Set(presentIds);
    const db = await openDB();
    const rows = await db.getAllAsync(`SELECT gameId FROM ${table}`);
    const toDelete = rows.map(r => r.gameId).filter(id => !present.has(id));
    if (toDelete.length === 0) return [];
    await runInTransaction(async (tx) => {
        for (const id of toDelete) {
            await tx.runAsync(`DELETE FROM ${table} WHERE gameId = ?`, [id]);
        }
    });
    return toDelete;
}

/**
 * Grava o que a tela do jogo buscou (GetGameInfoAndUserProgress): conquistas
 * já convertidas, detalhes, imagens grandes e o progresso atualizado (para a
 * biblioteca refletir o resultado ao voltar). Retorna a linha nova.
 */
export async function saveRaGameInfo(ulid, gameId, { achievements, details, info }) {
    const table = await ensureRaTable(ulid);
    const db = await openDB();
    const unlockedHardcore = (achievements || []).filter(a => a.achieved).length;
    await db.runAsync(
        `UPDATE ${table} SET
            achievements = ?, achievementsStatus = 'done', achievementsSyncedAt = ?,
            details = ?,
            imageIcon = COALESCE(?, imageIcon),
            imageTitle = COALESCE(?, imageTitle),
            imageIngame = COALESCE(?, imageIngame),
            imageBoxArt = COALESCE(?, imageBoxArt),
            maxPossible = ?,
            numAwardedHardcore = ?,
            numAwarded = MAX(numAwarded, ?),
            highestAwardKind = ?,
            highestAwardDate = ?
        WHERE gameId = ?`,
        [
            JSON.stringify(achievements || []), Date.now(),
            details ? JSON.stringify(details) : null,
            info?.ImageIcon ?? null,
            info?.ImageTitle ?? null,
            info?.ImageIngame ?? null,
            info?.ImageBoxArt ?? null,
            (achievements || []).length,
            unlockedHardcore,
            Number(info?.NumAwardedToUser) || 0,
            info?.HighestAwardKind ?? null,
            info?.HighestAwardDate ?? null,
            gameId,
        ]
    );
    return getRaGame(ulid, gameId);
}

/**
 * Garante uma linha para um jogo da lista "Quero jogar" que ainda não está na
 * biblioteca (nunca jogado), para a tela do jogo conseguir abri-lo. Não mexe
 * se o jogo já existir. A próxima sincronização tira a linha de novo se o
 * jogo continuar sem desbloqueios.
 */
export async function ensureRaGameRow(ulid, item) {
    const table = await ensureRaTable(ulid);
    const db = await openDB();
    await db.runAsync(
        `INSERT OR IGNORE INTO ${table} (gameId, title, consoleId, consoleName, imageIcon, maxPossible)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [item.gameId, item.title ?? null, item.consoleId ?? null, item.consoleName ?? null, item.imageIcon ?? null, item.maxPossible || 0]
    );
}

/** Fixa/desfixa um jogo. Retorna o novo valor (0 ou 1). */
export async function toggleRaPin(ulid, gameId) {
    try {
        const table = await ensureRaTable(ulid);
        const db = await openDB();
        const row = await db.getFirstAsync(`SELECT pinned FROM ${table} WHERE gameId = ?`, [gameId]);
        const pinned = (row?.pinned || 0) === 0 ? 1 : 0;
        await db.runAsync(`UPDATE ${table} SET pinned = ? WHERE gameId = ?`, [pinned, gameId]);
        return pinned;
    } catch (err) {
        console.error("[raDb] toggleRaPin failed", gameId, err);
        return 0;
    }
}

// ---------- amigos (seguindo / seguidores) ----------

const FRIENDS_COLUMNS_SQL = `
    ulid TEXT PRIMARY KEY NOT NULL,
    user TEXT,
    points INTEGER DEFAULT 0,
    following INTEGER DEFAULT 0,
    follower INTEGER DEFAULT 0,
    games TEXT,
    gamesSyncedAt INTEGER
`;

/** Garante a tabela de amigos da conta (`ra_friends_<ulid>`) e retorna o nome. */
function ensureRaFriendsTable(ulid) {
    return ensureCustomTable(tableFor(ulid).replace("ra_games_", "ra_friends_"), FRIENDS_COLUMNS_SQL);
}

/** Converte uma linha de amigo do banco. */
function friendFromRow(row) {
    if (!row) return null;
    return { ...row, following: !!row.following, follower: !!row.follower, games: parseJson(row.games) };
}

/** Amigos salvos da conta, por pontos (maior primeiro). */
export async function getRaFriends(ulid) {
    try {
        const table = await ensureRaFriendsTable(ulid);
        const db = await openDB();
        const rows = await db.getAllAsync(`SELECT ulid, user, points, following, follower FROM ${table} ORDER BY points DESC`);
        return rows.map(friendFromRow);
    } catch (err) {
        console.error("[raDb] getRaFriends failed", err);
        return [];
    }
}

/** Um amigo salvo (com os jogos dele, se já buscados), ou null. */
export async function getRaFriend(ulid, friendUlid) {
    try {
        const table = await ensureRaFriendsTable(ulid);
        const db = await openDB();
        return friendFromRow(await db.getFirstAsync(`SELECT * FROM ${table} WHERE ulid = ?`, [friendUlid]));
    } catch (err) {
        console.error("[raDb] getRaFriend failed", err);
        return null;
    }
}

/**
 * Grava a lista de seguindo/seguidores: atualiza nome, pontos e relação
 * (mantendo os jogos já buscados) e remove quem saiu das duas listas.
 */
export async function saveRaFriends(ulid, list) {
    const table = await ensureRaFriendsTable(ulid);
    const present = new Set(list.map(f => f.ulid));
    await runInTransaction(async (db) => {
        for (const f of list) {
            await db.runAsync(
                `INSERT INTO ${table} (ulid, user, points, following, follower) VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(ulid) DO UPDATE SET user = excluded.user, points = excluded.points,
                    following = excluded.following, follower = excluded.follower`,
                [f.ulid, f.user, f.points || 0, f.following ? 1 : 0, f.follower ? 1 : 0]
            );
        }
        const rows = await db.getAllAsync(`SELECT ulid FROM ${table}`);
        for (const r of rows) {
            if (!present.has(r.ulid)) await db.runAsync(`DELETE FROM ${table} WHERE ulid = ?`, [r.ulid]);
        }
    });
}

/** Grava a biblioteca de um amigo (itens de GetUserCompletionProgress). */
export async function saveRaFriendGames(ulid, friendUlid, games) {
    try {
        const table = await ensureRaFriendsTable(ulid);
        const db = await openDB();
        await db.runAsync(
            `UPDATE ${table} SET games = ?, gamesSyncedAt = ? WHERE ulid = ?`,
            [JSON.stringify(games || []), Date.now(), friendUlid]
        );
    } catch (err) {
        console.error("[raDb] saveRaFriendGames failed", err);
    }
}
