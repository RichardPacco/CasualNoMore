import Toast from "react-native-root-toast";
import { COLORS } from "@/src/theme/colors";

let activeToast = null;

/** Exibe um toast, substituindo o anterior; a cor varia pelo tipo (info/success/error/warning). */
export function showToast(message, type = "info") {


    if (activeToast !== null) {
        Toast.hide(activeToast);
        activeToast = null;
    }

    let backgroundColor = "#333";

    switch (type) {
        case "success":
            backgroundColor = COLORS.accent;
            break;
        case "error":
            backgroundColor = COLORS.error;
            break;
        case "warning":
            backgroundColor = COLORS.warning;
            break;
        default:
            backgroundColor = "#333";
    }

    // Show new toast and save reference
    activeToast = Toast.show(message, {
        duration: Toast.durations.LONG,
        position: Toast.positions.CENTER,
        shadow: true,
        animation: true,
        hideOnPress: true,
        backgroundColor,
        textColor: "#fff",
        opacity: 0.70,
        containerStyle: {
            borderRadius: 10,
            marginHorizontal: 15,
        },
        textStyle: {
            fontWeight: "500",
        },
        onHidden: () => {
            activeToast = null;
        },
    });
}
