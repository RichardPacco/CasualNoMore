const GAME_IMAGE_CDN = "https://cdn.cloudflare.steamstatic.com/steam/apps/";
const GAME_IMAGE_FALLBACK_CDN = "https://steamcdn-a.akamaihd.net/steam/apps/";

const SHARED_IMAGE_CDN = "https://shared.cloudflare.steamstatic.com/community_assets/images/apps/";
const SHARED_IMAGE_FALLBACK_CDN = "https://shared.akamai.steamstatic.com/community_assets/images/apps/";

// CDN atual das imagens da loja (inclui os caminhos com hash dos jogos novos)
const STORE_ASSETS_CDN = "https://shared.akamai.steamstatic.com/store_item_assets/";

/**
 * Monta a URL de uma imagem da loja a partir do retorno do GetItems:
 * `format` = asset_url_format ("steam/apps/{appid}/${FILENAME}?t=...") e
 * `filename` = o caminho da imagem ("{hash}/capsule_231x87.jpg", ou só o nome
 * em jogos antigos). Retorna null se faltar algum dos dois.
 */
export function storeAssetUrl(format, filename) {
    if (!format || !filename) return null;
    return STORE_ASSETS_CDN + format.replace("${FILENAME}", filename);
}

/**
 * Lista de URLs a tentar, em ordem, para uma imagem: a URL da loja (com hash),
 * quando conhecida, e depois os CDNs antigos montados pelo appid.
 */
export function imageCandidates(storeUrl, legacyUri) {
    return [storeUrl, legacyUri(false), legacyUri(true)].filter(Boolean);
}

/** Gera a URL da imagem de cápsula do jogo no CDN. */
export function capsuleUri(appid, useFallback = false) {
    return `${useFallback ? GAME_IMAGE_FALLBACK_CDN : GAME_IMAGE_CDN}${appid}/capsule_231x87.jpg`;
}

/** Gera a URL da imagem de cabeçalho do jogo no CDN. */
export function headerUri(appid, useFallback = false) {
    return `${useFallback ? GAME_IMAGE_FALLBACK_CDN : GAME_IMAGE_CDN}${appid}/header.jpg`;
}

/** Gera a URL do ícone de conquista no CDN compartilhado. */
export function achievementIconUri(appid, filename, useFallback = false) {
    return `${useFallback ? SHARED_IMAGE_FALLBACK_CDN : SHARED_IMAGE_CDN}${appid}/${filename}`;
}
