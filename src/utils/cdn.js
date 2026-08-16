const GAME_IMAGE_CDN = "https://cdn.cloudflare.steamstatic.com/steam/apps/";
const GAME_IMAGE_FALLBACK_CDN = "https://steamcdn-a.akamaihd.net/steam/apps/";

const SHARED_IMAGE_CDN = "https://shared.cloudflare.steamstatic.com/community_assets/images/apps/";
const SHARED_IMAGE_FALLBACK_CDN = "https://shared.akamai.steamstatic.com/community_assets/images/apps/";

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
