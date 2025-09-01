import Toast from "react-native-root-toast";

let activeToast = null;

export function showToast(message, type = "info") {


    if (activeToast !== null) {
        Toast.hide(activeToast);
        activeToast = null;
    }

    let backgroundColor = "#333";

    switch (type) {
        case "success":
            backgroundColor = "#22c55e";
            break;
        case "error":
            backgroundColor = "#ef4444";
            break;
        case "warning":
            backgroundColor = "#facc15";
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
