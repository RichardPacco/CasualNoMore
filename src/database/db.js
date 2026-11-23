import * as SQLite from "expo-sqlite";

// Abertura do banco (promessa compartilhada, ver openDB)
let dbPromise = null;

// Tabelas já garantidas nesta sessão, para não recriar a cada acesso
const createdTables = new Set();

// Promises de criação em andamento, para não disparar CREATE TABLE em paralelo
const tableCreationPromises = new Map();

/** Serializa um valor para JSON sem duplicar strings já serializadas. */
function toJson(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "string") return value;
    return JSON.stringify(value);
}

/** Faz parse de um campo JSON armazenado, retornando objeto/array ou null. */
export function parseJson(value) {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string") return value;
    try {
        return JSON.parse(value);
    } catch (err) {
        console.error("[db] erro parseJson", err);
        return null;
    }
}

/**
 * Abre (uma única vez) e retorna a instância do banco SQLite.
 * Guarda a PROMESSA da abertura, não só o resultado: chamadas que chegam ao
 * mesmo tempo (ex.: bibliotecas da Steam e do RA na inicialização) esperam a
 * mesma abertura. Antes cada uma abria a sua conexão; a que sobrava era
 * coletada e, ao fechar, derrubava a outra (NullPointerException em toda
 * consulta, "jogo não encontrado" em tudo).
 */
export function openDB() {
    if (!dbPromise) {
        console.log("[db] Abrindo banco de dados...");
        dbPromise = SQLite.openDatabaseAsync("games.db").catch(err => {
            dbPromise = null; // deixa tentar de novo na próxima chamada
            throw err;
        });
    }
    return dbPromise;
}

/** Garante que exista a tabela de jogos do steamId e retorna o nome dela. */
export async function ensureTable(steamId) {
    const tableName = `games_${steamId}`;
    if (createdTables.has(tableName)) return tableName;
    if (tableCreationPromises.has(tableName)) return tableCreationPromises.get(tableName);

    const promise = (async () => {
        const db = await openDB();
        console.log(`[db] Criando tabela se não existir: ${tableName}`);
        await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      appid INTEGER PRIMARY KEY NOT NULL,
      name TEXT,
      playtime_forever INTEGER,
      playtime_2weeks INTEGER,
      playtimeHidden INTEGER DEFAULT 0,
      schema TEXT,
      schemaStatus TEXT,
      achievements TEXT,
      achievementsStatus TEXT,
      details TEXT,
      detailsStatus TEXT,
      detailsLang TEXT,
      lang TEXT,
      unlocked INTEGER,
      totalAchievements INTEGER,
      pinned INTEGER DEFAULT 0,
      capsuleUrl TEXT,
      headerUrl TEXT
    );
  `);
        createdTables.add(tableName);
        tableCreationPromises.delete(tableName);
        return tableName;
    })();

    tableCreationPromises.set(tableName, promise);
    return promise;
}

/**
 * Garante que exista a tabela `tableName` (criada com `columnsSql`, o corpo do
 * CREATE TABLE) e retorna o nome. Usa o mesmo registro das tabelas da Steam,
 * então o clearDB também zera as tabelas criadas por aqui (ex.: as do
 * RetroAchievements, em raDb.js).
 */
export async function ensureCustomTable(tableName, columnsSql) {
    if (createdTables.has(tableName)) return tableName;
    if (tableCreationPromises.has(tableName)) return tableCreationPromises.get(tableName);

    const promise = (async () => {
        const db = await openDB();
        console.log(`[db] Criando tabela se não existir: ${tableName}`);
        await db.execAsync(`CREATE TABLE IF NOT EXISTS ${tableName} (${columnsSql});`);
        createdTables.add(tableName);
        tableCreationPromises.delete(tableName);
        return tableName;
    })();

    tableCreationPromises.set(tableName, promise);
    return promise;
}

/** Garante que exista a tabela de amigos do steamId e retorna o nome dela. */
export async function ensureTableFriends(steamId) {
    const tableName = `friends_${steamId}`;
    if (createdTables.has(tableName)) return tableName;
    if (tableCreationPromises.has(tableName)) return tableCreationPromises.get(tableName);

    const promise = (async () => {
        const db = await openDB();
        console.log(`[db] Criando tabela se não existir: ${tableName}`);
        await db.execAsync(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
            steamId TEXT PRIMARY KEY NOT NULL,
            profile TEXT,
            games TEXT,
            commonGames TEXT
        );
    `);
        createdTables.add(tableName);
        tableCreationPromises.delete(tableName);
        return tableName;
    })();

    tableCreationPromises.set(tableName, promise);
    return promise;
}



// Fila das transações: o expo-sqlite não permite abrir uma transação enquanto
// outra está aberta na mesma conexão (ex.: GameList e Friends salvando lotes ao
// mesmo tempo). Cada transação espera a anterior terminar.
let transactionQueue = Promise.resolve();

/** Roda `fn` dentro de uma transação (tudo ou nada), uma transação por vez. */
export async function runInTransaction(fn) {
    const db = await openDB();
    const run = transactionQueue.then(() => db.withTransactionAsync(() => fn(db)));
    transactionQueue = run.catch(() => { }); // uma falha não trava a fila
    return run;
}

// Colunas da tabela de jogos, na ordem dos valores de gameRowValues.
// Ao adicionar uma coluna: CREATE TABLE em ensureTable + aqui + gameRowValues.
const GAME_COLUMNS = [
    "appid", "name", "playtime_forever", "playtime_2weeks", "playtimeHidden",
    "schema", "schemaStatus", "achievements", "achievementsStatus",
    "details", "detailsStatus", "detailsLang", "lang",
    "unlocked", "totalAchievements", "pinned",
    "capsuleUrl", "headerUrl",
];

/** SQL do INSERT OR REPLACE de um jogo completo na tabela informada. */
function gameInsertSql(tableName) {
    const placeholders = GAME_COLUMNS.map(() => "?").join(", ");
    return `INSERT OR REPLACE INTO ${tableName} (${GAME_COLUMNS.join(", ")}) VALUES (${placeholders})`;
}

/** Converte um jogo nos valores da linha, na ordem de GAME_COLUMNS. */
function gameRowValues(game) {
    const achievementsList = Array.isArray(game.achievements) ? game.achievements : [];
    return [
        game.appid,
        game.name,
        game.playtime_forever || 0,
        game.playtime_2weeks || 0,
        game.playtimeHidden ? 1 : 0,
        toJson(game.schema),
        game.schemaStatus || "pending",
        toJson(game.achievements),
        game.achievementsStatus || "pending",
        toJson(game.details),
        game.detailsStatus || "pending",
        game.detailsLang || null,
        game.lang || null,
        game.unlocked ?? achievementsList.filter(a => a.achieved).length,
        game.totalAchievements ?? achievementsList.length,
        game.pinned ? 1 : 0,
        game.capsuleUrl || null,
        game.headerUrl || null,
    ];
}

/** Salva ou atualiza um jogo na tabela do steamId. */
export async function saveGame(steamId, game) {
    try {
        const db = await openDB();
        const tableName = await ensureTable(steamId);
        await db.runAsync(gameInsertSql(tableName), gameRowValues(game));
        console.log(`[db] Jogo salvo: ${game.name || game.appid}`);
    } catch (err) {
        console.error(`[db] Failed to save game: ${game.name || game.appid}`, err);
    }
}

/** Retorna todos os jogos de um steamId. */
export async function getAllGames(steamId) {
    try {
        const db = await openDB();
        const tableName = await ensureTable(steamId);
        console.log(`[db] Buscando todos os jogos da tabela ${tableName}`);
        const rows = await db.getAllAsync(`SELECT * FROM ${tableName}`);
        return rows;
    } catch (err) {
        console.error("[db] erro getAllGames", err);
        return [];
    }
}

/** Retorna um único jogo cacheado do steamId, com campos JSON já parseados. */
export async function getGame(steamId, appid) {
    try {
        const db = await openDB();
        const tableName = await ensureTable(steamId);
        const row = await db.getFirstAsync(`SELECT * FROM ${tableName} WHERE appid = ?`, [appid]);
        if (!row) return null;
        return {
            ...row,
            schema: parseJson(row.schema),
            achievements: parseJson(row.achievements),
            details: parseJson(row.details),
        };
    } catch (err) {
        console.error("[db] erro getGame", err);
        return null;
    }
}


/**
 * Salva vários jogos de uma vez na tabela do steamId, numa única transação:
 * mais rápido (um commit só) e tudo-ou-nada (um erro não deixa o lote pela metade).
 */
export async function saveGamesBatch(steamId, games) {
    if (!games?.length) return;
    try {
        const tableName = await ensureTable(steamId);
        const sql = gameInsertSql(tableName);
        await runInTransaction(async (db) => {
            for (const game of games) {
                await db.runAsync(sql, gameRowValues(game));
            }
        });
        console.log(`[db] ${games.length} jogos salvos na tabela ${tableName}`);
    } catch (err) {
        console.error("[db] Failed to save games batch", err);
    }
}

/**
 * Remove do cache os jogos que não estão mais na biblioteca (reembolsados,
 * removidos, fim de fim de semana grátis). `ownedAppIds` = appids que a Steam
 * acabou de retornar. Retorna os appids removidos.
 */
export async function deleteGamesNotOwned(steamId, ownedAppIds) {
    try {
        const tableName = await ensureTable(steamId);
        const owned = new Set(ownedAppIds);
        const db = await openDB();
        const rows = await db.getAllAsync(`SELECT appid FROM ${tableName}`);
        const toDelete = rows.map(r => r.appid).filter(id => !owned.has(id));
        if (toDelete.length === 0) return [];

        // Em lotes, para não passar do limite de parâmetros do SQLite
        const CHUNK = 500;
        await runInTransaction(async (txDb) => {
            for (let i = 0; i < toDelete.length; i += CHUNK) {
                const chunk = toDelete.slice(i, i + CHUNK);
                await txDb.runAsync(
                    `DELETE FROM ${tableName} WHERE appid IN (${chunk.map(() => "?").join(", ")})`,
                    chunk
                );
            }
        });
        console.log(`[db] ${toDelete.length} jogos fora da biblioteca removidos de ${tableName}`);
        return toDelete;
    } catch (err) {
        console.error("[db] deleteGamesNotOwned failed", err);
        return [];
    }
}


/**
 * Atualiza só os detalhes da loja de um jogo (e o idioma deles, detailsLang),
 * sem tocar nas outras colunas (pinned, conquistas, lang...). Evita sobrescrever dados mais novos com uma
 * cópia antiga do jogo. Não faz nada se o jogo ainda não estiver salvo.
 */
export async function updateGameDetails(steamId, appid, details, lang) {
    try {
        const db = await openDB();
        const tableName = await ensureTable(steamId);
        await db.runAsync(
            `UPDATE ${tableName} SET details = ?, detailsStatus = ?, detailsLang = ? WHERE appid = ?`,
            [toJson(details), details ? "done" : "pending", details ? lang : null, appid]
        );
    } catch (err) {
        console.error("[db] updateGameDetails failed", appid, err);
    }
}

/**
 * Atualiza só as conquistas (e os contadores) de um jogo, sem tocar nas
 * outras colunas. Não faz nada se o jogo ainda não estiver salvo.
 */
export async function updateGameAchievements(steamId, appid, achievements) {
    try {
        const db = await openDB();
        const tableName = await ensureTable(steamId);
        const list = Array.isArray(achievements) ? achievements : [];
        await db.runAsync(
            `UPDATE ${tableName} SET achievements = ?, achievementsStatus = 'done', unlocked = ?, totalAchievements = ? WHERE appid = ?`,
            [toJson(list), list.filter(a => a.achieved).length, list.length, appid]
        );
    } catch (err) {
        console.error("[db] updateGameAchievements failed", appid, err);
    }
}

/** Alterna o estado pinned de um jogo. Retorna o novo valor (0 ou 1). */
export async function togglePin(steamId, appid) {
    try {
        const db = await openDB();
        const tableName = await ensureTable(steamId);
        const row = await db.getFirstAsync(`SELECT pinned FROM ${tableName} WHERE appid = ?`, [appid]);
        const newPinned = (row?.pinned || 0) === 0 ? 1 : 0;
        await db.runAsync(`UPDATE ${tableName} SET pinned = ? WHERE appid = ?`, [newPinned, appid]);
        return newPinned;
    } catch (err) {
        console.error("[db] togglePin failed", appid, err);
        return 0;
    }
}

/**
 * Progresso de conquistas de todos os jogos do steamId, sem os JSONs pesados:
 * Map appid -> { unlocked, total }. Usado para mostrar "você 64%" nos jogos
 * de um amigo.
 */
export async function getGamesProgress(steamId) {
    try {
        const db = await openDB();
        const tableName = await ensureTable(steamId);
        const rows = await db.getAllAsync(`SELECT appid, unlocked, totalAchievements FROM ${tableName}`);
        return new Map(rows.map(r => [r.appid, { unlocked: r.unlocked ?? 0, total: r.totalAchievements ?? 0 }]));
    } catch (err) {
        console.error("[db] getGamesProgress failed", err);
        return new Map();
    }
}

/** Retorna os appids dos jogos fixados de um steamId. */
export async function getPinnedAppIds(steamId) {
    try {
        const db = await openDB();
        const tableName = await ensureTable(steamId);
        const rows = await db.getAllAsync(`SELECT appid FROM ${tableName} WHERE pinned = 1`);
        return rows.map(r => r.appid);
    } catch (err) {
        console.error("[db] getPinnedAppIds failed", err);
        return [];
    }
}

/** Retorna a contagem de jogos de um steamId. */
export async function getGamesCount(steamId) {
    try {
        const db = await openDB();
        const tableName = await ensureTable(steamId);
        const row = await db.getFirstAsync(`SELECT COUNT(*) as count FROM ${tableName}`);
        return row?.count ?? 0;
    } catch (err) {
        console.error("[db] getGamesCount failed", err);
        return 0;
    }
}


/** DEBUG: remove todas as tabelas do banco e reinicia os caches. */
export async function clearDB() {
    try {
        const db = await openDB();
        console.log("[db] Limpando todas as tabelas...");

        // Pega todas as tabelas existentes
        const tables = await db.getAllAsync(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
        );

        for (const table of tables) {
            console.log(`[db] Dropping table: ${table.name}`);
            await db.runAsync(`DROP TABLE IF EXISTS ${table.name};`);
        }

        createdTables.clear(); // as tabelas foram dropadas, precisam ser recriadas
        tableCreationPromises.clear();
        console.log("[db] Banco de dados limpo!");
    } catch (err) {
        console.error("[db] Erro ao limpar DB", err);
    }
}



/** SQL do INSERT OR REPLACE de um amigo na tabela informada. */
function friendInsertSql(tableName) {
    return `INSERT OR REPLACE INTO ${tableName} (steamId, profile, games, commonGames) VALUES (?, ?, ?, ?)`;
}

/** Converte um amigo nos valores da linha (steamId, profile, games, commonGames). */
function friendRowValues(friend) {
    return [
        friend.steamId,
        friend.profile ? JSON.stringify(friend.profile) : null,
        friend.games ? JSON.stringify(friend.games) : null,
        friend.commonGames ? JSON.stringify(friend.commonGames) : null,
    ];
}

/** Salva o perfil de um amigo na tabela do dono. */
export async function saveFriendProfile(steamId, friend) {
    try {
        const db = await openDB();
        const tableName = await ensureTableFriends(steamId);
        await db.runAsync(friendInsertSql(tableName), friendRowValues(friend));
        console.log(`[db] Friend profile saved: ${friend.steamId}`);
    } catch (err) {
        console.error(`[db] Failed to save friend profile: ${friend?.steamId}`, err);
    }
}

/** Salva vários perfis de amigos de uma vez na tabela do dono, numa única transação. */
export async function saveFriendsBatch(steamId, friends) {
    if (!friends?.length) return;
    try {
        const tableName = await ensureTableFriends(steamId);
        const sql = friendInsertSql(tableName);
        await runInTransaction(async (db) => {
            for (const friend of friends) {
                await db.runAsync(sql, friendRowValues(friend));
            }
        });
        console.log(`[db] ${friends.length} friend profiles saved`);
    } catch (err) {
        console.error("[db] Failed to save friends batch", err);
    }
}



/** Salva um amigo completo (perfil) na tabela do dono. */
export async function saveFriend(steamId, friend) {
    await saveFriendProfile(steamId, friend);
}

/** Carrega um amigo completo (perfil, jogos e comuns) do banco. */
export async function loadFriend(ownSteamId, friendSteamId) {
    try {
        const db = await openDB();
        const tableName = await ensureTableFriends(ownSteamId);

        // Select the columns we need
        const row = await db.getFirstAsync(
            `SELECT steamId, profile, games, commonGames FROM ${tableName} WHERE steamId = ?`,
            [friendSteamId]
        );

        if (!row) return null;

        // Parse safely (guard against null/invalid JSON)
        let profile = null;
        let games = null;
        let commonGames = [];

        try {
            profile = row.profile ? JSON.parse(row.profile) : null;
        } catch (e) {
            console.warn(`[db] Failed to parse profile JSON for ${friendSteamId}`, e);
            profile = null;
        }

        try {
            games = row.games ? JSON.parse(row.games) : null;
        } catch (e) {
            console.warn(`[db] Failed to parse games JSON for ${friendSteamId}`, e);
            games = null;
        }

        try {
            commonGames = row.commonGames ? JSON.parse(row.commonGames) : [];
        } catch (e) {
            console.warn(`[db] Failed to parse commonGames JSON for ${friendSteamId}`, e);
            commonGames = [];
        }

        return {
            steamId: row.steamId,
            profile,
            games,
            commonGames,
        };
    } catch (err) {
        console.error(`[db] Failed to load friend: ${friendSteamId}`, err);
        return null;
    }
}

