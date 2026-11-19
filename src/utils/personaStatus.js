import { COLORS } from "@/src/theme/colors";

/**
 * Texto e cor do status de um jogador da Steam (`personastate`), com as cores
 * do redesign: verde online, ouro ausente/soneca, vermelho ocupado, azul
 * procurando trocar/jogar, cinza offline.
 * `tr` = função de tradução.
 */
export function personaStatus(code, tr) {
    switch (Number(code)) {
        case 0: return { text: tr("statusOffline"), color: "#5B6576", online: false };
        case 1: return { text: tr("statusOnline"), color: COLORS.success, online: true };
        case 2: return { text: tr("statusBusy"), color: COLORS.danger, online: true };
        case 3: return { text: tr("statusAway"), color: COLORS.gold, online: true };
        case 4: return { text: tr("statusSleep"), color: COLORS.gold, online: true };
        case 5: return { text: tr("statusLookingTrade"), color: COLORS.accent, online: true };
        case 6: return { text: tr("statusLookingPlay"), color: COLORS.accent, online: true };
        default: return { text: tr("statusUnknown"), color: "#5B6576", online: false };
    }
}
