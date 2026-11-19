import { getApiKey } from "@/src/config/apiKeyStore";

/**
 * Cliente da Web API do RetroAchievements (RA).
 * Documentação: https://api-docs.retroachievements.org/
 *
 * - Toda chamada leva a key do usuário no parâmetro `y`. A URL completa contém
 *   a key: nunca registrar a URL em log nem colocá-la em mensagens de erro.
 * - As respostas usam chaves em PascalCase (`GameID`, `NumAwarded`...). A
 *   conversão para o formato do app fica nos adaptadores (src/platforms/ra).
 * - O RA não publica um limite de requisições: no máximo MAX_CONCURRENT
 *   chamadas ao mesmo tempo, e novas tentativas com espera em 429/5xx.
 */

const API_BASE = "https://retroachievements.org/API/";
const MEDIA_BASE = "https://media.retroachievements.org";
const SITE_BASE = "https://retroachievements.org";

/** Página onde o usuário encontra a Web API Key (Settings → Keys). */
export const RA_SETTINGS_URL = `${SITE_BASE}/settings`;

const MAX_CONCURRENT = 3;
const MAX_RETRIES = 3;
// Tamanho máximo de página dos endpoints paginados (c)
const PAGE_SIZE = 500;

/** Erro da API do RA. `status`: HTTP (401 key inválida, 404 não encontrado) ou 0 sem rede. */
export class RaApiError extends Error {
    constructor(message, status) {
        super(message);
        this.name = "RaApiError";
        this.status = status;
    }
}

// ---------- fila: no máximo MAX_CONCURRENT requisições ao mesmo tempo ----------
let active = 0;
const waiting = [];

/** Espera uma vaga na fila. */
function acquire() {
    if (active < MAX_CONCURRENT) {
        active++;
        return Promise.resolve();
    }
    return new Promise(resolve => waiting.push(resolve));
}

/** Libera a vaga (passa direto para o próximo da fila, se houver). */
function release() {
    const next = waiting.shift();
    if (next) next();
    else active--;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/** Espera antes da nova tentativa: Retry-After do servidor ou 1 s, 2 s, 4 s. */
function retryDelay(res, attempt) {
    const retryAfter = Number(res?.headers?.get?.("retry-after"));
    if (retryAfter > 0) return Math.min(retryAfter, 30) * 1000;
    return 1000 * 2 ** attempt;
}

/**
 * Chama `API_<endpoint>.php` com os parâmetros dados e devolve o JSON.
 * `key` opcional: usa essa key no lugar da salva (validação no login, antes
 * de salvar). Lança RaApiError.
 */
export async function raFetch(endpoint, params = {}, { key } = {}) {
    const apiKey = key ?? getApiKey("ra");
    if (!apiKey) throw new RaApiError("API key do RetroAchievements não configurada", 401);

    // Montado à mão: o URLSearchParams do React Native é incompleto
    const query = Object.entries({ ...params, y: apiKey })
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join("&");
    const url = `${API_BASE}API_${endpoint}.php?${query}`;

    await acquire();
    try {
        for (let attempt = 0; ; attempt++) {
            let res;
            try {
                res = await fetch(url);
            } catch {
                if (attempt < MAX_RETRIES) {
                    await sleep(retryDelay(null, attempt));
                    continue;
                }
                throw new RaApiError(`${endpoint}: sem conexão`, 0);
            }

            if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
                await sleep(retryDelay(res, attempt));
                continue;
            }
            if (res.status === 401 || res.status === 403) {
                throw new RaApiError(`${endpoint}: key inválida`, 401);
            }
            if (!res.ok) throw new RaApiError(`${endpoint}: HTTP ${res.status}`, res.status);

            try {
                return await res.json();
            } catch {
                throw new RaApiError(`${endpoint}: resposta inválida`, res.status);
            }
        }
    } finally {
        release();
    }
}

/**
 * Busca todas as páginas de um endpoint paginado (`c`/`o`, resposta com
 * `Count`, `Total` e `Results`). Retorna { total, results }.
 */
async function fetchAllPages(endpoint, params = {}) {
    const results = [];
    let total = 0;
    for (let offset = 0; ;) {
        const page = await raFetch(endpoint, { ...params, c: PAGE_SIZE, o: offset });
        const items = Array.isArray(page?.Results) ? page.Results : [];
        results.push(...items);
        total = Number(page?.Total ?? results.length);
        offset += items.length;
        if (items.length < PAGE_SIZE || offset >= total) return { total, results };
    }
}

// ---------- endpoints ----------

/**
 * Perfil do usuário (`u` = nome ou ULID). Lança RaApiError 404 se o usuário
 * não existir. `key` opcional, para validar uma key ainda não salva.
 */
export async function getUserProfile(u, { key } = {}) {
    if (!u) throw new RaApiError("getUserProfile: usuário é obrigatório", 404);
    const profile = await raFetch("GetUserProfile", { u }, { key });
    if (!profile?.ULID || !profile?.User) throw new RaApiError("getUserProfile: usuário não encontrado", 404);
    return profile;
}

/** Biblioteca inteira do usuário com o progresso de cada jogo (todas as páginas). */
export function getUserCompletionProgress(u) {
    return fetchAllPages("GetUserCompletionProgress", { u });
}

/** Jogo + conquistas + progresso do usuário nele (com os dados de medalha). */
export function getGameInfoAndUserProgress(u, gameId) {
    return raFetch("GetGameInfoAndUserProgress", { u, g: gameId, a: 1 });
}

/** Jogos jogados recentemente (máx. 50 por chamada). */
export async function getUserRecentlyPlayedGames(u, count = 50) {
    const list = await raFetch("GetUserRecentlyPlayedGames", { u, c: Math.min(count, 50) });
    return Array.isArray(list) ? list : [];
}

/** Resumo do usuário (rank, status). Lento na API: sem jogos/conquistas recentes. */
export function getUserSummary(u) {
    return raFetch("GetUserSummary", { u, g: 0, a: 0 });
}

/** Medalhas do usuário (masters, completions, beaten). */
export function getUserAwards(u) {
    return raFetch("GetUserAwards", { u });
}

/** Quem o dono da key segue (todas as páginas). */
export function getUsersIFollow() {
    return fetchAllPages("GetUsersIFollow");
}

/** Quem segue o dono da key (todas as páginas). */
export function getUsersFollowingMe() {
    return fetchAllPages("GetUsersFollowingMe");
}

/** Consoles ativos que são de jogos (sem Hubs/Events). */
export async function getConsoleIds() {
    const list = await raFetch("GetConsoleIDs", { a: 1, g: 1 });
    return Array.isArray(list) ? list : [];
}

// ---------- mídia e links do site ----------

/** URL completa de uma imagem da API (`ImageIcon`, `ImageBoxArt`, `UserPic`...). */
export function raMedia(path) {
    if (!path) return null;
    if (/^https?:\/\//.test(path)) return path;
    return `${MEDIA_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Ícone da conquista (`locked` = versão cinza). */
export function raBadge(badgeName, locked = false) {
    if (!badgeName) return null;
    return `${MEDIA_BASE}/Badge/${badgeName}${locked ? "_lock" : ""}.png`;
}

/** Avatar do usuário pelo nome. */
export function raUserPic(user) {
    return user ? `${MEDIA_BASE}/UserPic/${encodeURIComponent(user)}.png` : null;
}

export const raGameUrl = (gameId) => `${SITE_BASE}/game/${gameId}`;
export const raAchievementUrl = (id) => `${SITE_BASE}/achievement/${id}`;
export const raUserUrl = (user) => `${SITE_BASE}/user/${encodeURIComponent(user)}`;
export const raForumUrl = (topicId) => `${SITE_BASE}/viewtopic.php?t=${topicId}`;
