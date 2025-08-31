import * as SQLite from "expo-sqlite";

let dbInstance = null;

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
    const db = await openDB();
    const tableName = `games_${steamId}`;
    console.log(`[db] Criando tabela se não existir: ${tableName}`);
    await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      appid INTEGER PRIMARY KEY NOT NULL,
      name TEXT,
      playtime_forever INTEGER,
      playtime_2weeks INTEGER,
      schema TEXT
    );
  `);
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

        console.log(`[db] Salvando jogo: ${game.name || game.appid} na tabela ${tableName}`);
        await db.runAsync(
            `INSERT OR REPLACE INTO ${tableName} (appid, name, playtime_forever, playtime_2weeks, schema)
       VALUES (?, ?, ?, ?, ?)`,
            [game.appid, game.name, game.playtime_forever || 0, game.playtime_2weeks || 0, schemaString]
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

        console.log("[db] Banco de dados limpo!");
    } catch (err) {
        console.error("[db] Erro ao limpar DB", err);
    }
}
