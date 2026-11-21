import { COLORS } from "@/src/theme/colors";

// Faixas de raridade pelo % global de desbloqueio (mesmas do app atual):
// > 50% comum, > 25% incomum, > 10% rara, > 5% épica, > 1% lendária, senão perolada.
const TIERS = [
    { id: "common", min: 50, color: COLORS.rarityCommon },
    { id: "uncommon", min: 25, color: COLORS.rarityUncommon },
    { id: "rare", min: 10, color: COLORS.rarityRare },
    { id: "epic", min: 5, color: COLORS.rarityEpic },
    { id: "legendary", min: 1, color: COLORS.rarityLegendary },
];
const PEARLESCENT = { id: "pearlescent", min: 0, color: COLORS.rarityPearlescent };

/** Faixa de raridade ({ id, color }) de uma conquista pelo % global. */
export function rarityTier(percent) {
    const p = Number(percent) || 0;
    return TIERS.find(t => p > t.min) ?? PEARLESCENT;
}

/** Só a cor da raridade de uma conquista pelo % global. */
export function rarityColor(percent) {
    return rarityTier(percent).color;
}
