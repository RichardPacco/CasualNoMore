import CONSOLE_ICON_ASSETS from "./consoleIconAssets";

/**
 * Ícone do console do RetroAchievements, guardado no próprio app
 * (assets/images/consoles, baixados por scripts/fetch-console-icons.mjs):
 * aparece na hora, sem chamada à API e offline.
 * Retorna a imagem para o `source` de um <Image>, ou null se o console não
 * tiver ícone (console novo: rode o script de novo).
 */
export function consoleIcon(consoleId) {
    return consoleId != null ? CONSOLE_ICON_ASSETS[consoleId] ?? null : null;
}
