import ra from "./ra";
import steam from "./steam";

/**
 * Plataformas de conquistas suportadas. As telas genéricas (biblioteca, card,
 * tela do jogo) falam com elas por aqui, sem saber de qual API vem o dado.
 * Ver RETROACHIEVEMENTS_PLAN.md, seção 3.
 */
export const PLATFORMS = { steam, ra };

/** Ordem das plataformas nos seletores. */
export const PLATFORM_ORDER = ["steam", "ra"];

/** Plataforma pelo id ("steam" | "ra"), ou null se desconhecida. */
export function getPlatform(id) {
    return PLATFORMS[id] ?? null;
}
