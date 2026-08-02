import * as SQLite from "expo-sqlite";

let dbInstance = null;

// Tabelas já garantidas nesta sessão, para não recriar a cada acesso
const createdTables = new Set();

export async function openDB() {
    if (!dbInstance) {
        console.log("[db] Abrindo banco de dados...");
        dbInstance = await SQLite.openDatabaseAsync("games.db");
    }
    return dbInstance;
}

/**
 * Garante que exista uma tabela para o steamId
 */
export async function ensureTable(steamId) {
    const tableName = `games_${steamId}`;
    if (createdTables.has(tableName)) return tableName;

    const db = await openDB();
    console.log(`[db] Criando tabela se não existir: ${tableName}`);
    await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      appid INTEGER PRIMARY KEY NOT NULL,
      name TEXT,
      playtime_forever INTEGER,
      playtime_2weeks INTEGER,
      schema TEXT,
      schemaStatus TEXT
    );
  `);
    createdTables.add(tableName);
    return tableName;
}

export async function ensureTableFriends(steamId) {
    const tableName = `friends_${steamId}`;
    if (createdTables.has(tableName)) return tableName;

    const db = await openDB();
    console.log(`[db] Criando tabela se não existir: ${tableName}`);
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
            steamId INTEGER PRIMARY KEY NOT NULL,
            profile TEXT,
            games TEXT,
            commonGames TEXT
        );
    `);
    createdTables.add(tableName);
    return tableName;
}



/**
 * Salva ou atualiza um jogo na tabela do steamId
 */
export async function saveGame(steamId, game) {
    try {
        const db = await openDB();
        const tableName = await ensureTable(steamId);
        const schemaString = game.schema ? JSON.stringify(game.schema) : null;
        const schemaStatus = game.schemaStatus || "pending"; // default if not set

        console.log(`[db] Salvando jogo: ${game.name || game.appid} na tabela ${tableName}`);
        await db.runAsync(
            `INSERT OR REPLACE INTO ${tableName} (appid, name, playtime_forever, playtime_2weeks, schema, schemaStatus)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [game.appid, game.name, game.playtime_forever || 0, game.playtime_2weeks || 0, schemaString, schemaStatus]
        );
        console.log(`[db] Jogo salvo: ${game.name || game.appid}`);
    } catch (err) {
        console.error(`[db] Failed to save game: ${game.name || game.appid}`, err);
    }
}

/**
 * Retorna todos os jogos de um steamId
 */
export async function getAllGames(steamId) {
    try {
        const db = await openDB();
        const tableName = await ensureTable(steamId);
        console.log(`[db] Buscando todos os jogos da tabela ${tableName}`);
        const rows = await db.getAllAsync(`SELECT * FROM ${tableName}`);
        return rows.map(r => ({
            ...r,
            schema: r.schema ? JSON.parse(r.schema) : null
        }));
    } catch (err) {
        console.error("[db] erro getAllGames", err);
        return [];
    }
}


export async function saveGamesBatch(steamId, games) {
    try {
        const db = await openDB();
        const tableName = await ensureTable(steamId);

        // Prepare statements for all games
        const insertPromises = games.map(game => {
            const schemaString = game.schema ? JSON.stringify(game.schema) : null;
            const schemaStatus = game.schemaStatus || "pending";

            console.log(`[db] Salvando jogo: ${game.name || game.appid} na tabela ${tableName}`);
            return db.runAsync(
                `INSERT OR REPLACE INTO ${tableName} 
                (appid, name, playtime_forever, playtime_2weeks, schema, schemaStatus)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [game.appid, game.name, game.playtime_forever || 0, game.playtime_2weeks || 0, schemaString, schemaStatus]
            ).then(() => {
                console.log(`[db] Jogo salvo: ${game.name || game.appid}`);
            });
        });

        await Promise.all(insertPromises); // Run all inserts in parallel
    } catch (err) {
        console.error("[db] Failed to save games batch", err);
    }
}


/**
 * Retorna a contagem de jogos de um steamId
 */
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


/**
 * DEBUG: limpa todas as tabelas do banco
 */
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
        console.log("[db] Banco de dados limpo!");
    } catch (err) {
        console.error("[db] Erro ao limpar DB", err);
    }
}



// Save the profile of a friend
export async function saveFriendProfile(steamId, friend) {
    try {
        const db = await openDB();
        const tableName = await ensureTableFriends(steamId);

        const profileJson = friend.profile ? JSON.stringify(friend.profile) : null;
        const gamesJson = friend.games ? JSON.stringify(friend.games) : null;
        const commonJson = friend.commonGames ? JSON.stringify(friend.commonGames) : null;

        await db.runAsync(
            `INSERT OR REPLACE INTO ${tableName} (steamId, profile, games, commonGames) VALUES (?, ?, ?, ?)`,
            [friend.steamId, profileJson, gamesJson, commonJson]
        );

        console.log(`[db] Friend profile saved: ${friend.steamId}`);
    } catch (err) {
        console.error(`[db] Failed to save friend profile: ${friend?.steamId}`, err);
    }
}



// Save full friend (profile + games) into the friends table of the owner
export async function saveFriend(steamId, friend) {
    await saveFriendProfile(steamId, friend);
}

// Load full friend
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

