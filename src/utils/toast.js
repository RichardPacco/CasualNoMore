import Toast from "react-native-root-toast";
import { COLORS, FONTS } from "@/src/theme/colors";

let activeToast = null;

// Cor da borda de cada tipo de aviso (redesign, prancheta 13)
const BORDER_BY_TYPE = {
    success: COLORS.success,
    error: COLORS.danger,
    warning: COLORS.gold,
    info: COLORS.border,
};

/**
 * Exibe um aviso (toast) no visual do redesign, substituindo o anterior:
 * fundo escuro elevado, borda na cor do tipo (info/success/error/warning) e
 * posição logo acima da tab bar flutuante.
 */
export function showToast(message, type = "info") {
    if (activeToast !== null) {
        Toast.hide(activeToast);
        activeToast = null;
    }

    activeToast = Toast.show(message, {
        duration: Toast.durations.LONG,
        position: -110, // acima da tab bar (64 px + 20 px de margem)
        shadow: true,
        shadowColor: "#000",
        animation: true,
        hideOnPress: true,
        backgroundColor: COLORS.surface2,
        textColor: COLORS.text,
        opacity: 1,
        containerStyle: {
            borderRadius: 16,
            borderWidth: 1,
            borderColor: BORDER_BY_TYPE[type] ?? COLORS.border,
            marginHorizontal: 20,
            paddingHorizontal: 16,
            paddingVertical: 12,
        },
        textStyle: {
            fontFamily: FONTS.bodySemibold,
            fontSize: 14,
        },
        onHidden: () => {
            activeToast = null;
        },
    });
}
