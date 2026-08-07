const GAME_IMAGE_CDN = "https://cdn.cloudflare.steamstatic.com/steam/apps/";
const GAME_IMAGE_FALLBACK_CDN = "https://steamcdn-a.akamaihd.net/steam/apps/";

const SHARED_IMAGE_CDN = "https://shared.cloudflare.steamstatic.com/community_assets/images/apps/";
const SHARED_IMAGE_FALLBACK_CDN = "https://shared.akamai.steamstatic.com/community_assets/images/apps/";

export function capsuleUri(appid, useFallback = false) {
    return `${useFallback ? GAME_IMAGE_FALLBACK_CDN : GAME_IMAGE_CDN}${appid}/capsule_231x87.jpg`;
}

export function headerUri(appid, useFallback = false) {
    return `${useFallback ? GAME_IMAGE_FALLBACK_CDN : GAME_IMAGE_CDN}${appid}/header.jpg`;
}

export function achievementIconUri(appid, filename, useFallback = false) {
    return `${useFallback ? SHARED_IMAGE_FALLBACK_CDN : SHARED_IMAGE_CDN}${appid}/${filename}`;
}
