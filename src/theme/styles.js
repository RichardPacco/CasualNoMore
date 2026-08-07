import { useColorScheme } from "react-native";

// Semantic theme tokens — dark/light palette lives here, change once and it
// applies everywhere. Class tokens go into `className`, hex tokens into
// inline `style` props. Class strings are plain literals so NativeWind
// generates them via the ./src/** content glob.
export const theme = {
    dark: {
        pageBg: "bg-gray-900",
        cardBg: "bg-gray-800",
        elevatedCardBg: "bg-gray-800",
        cardBorder: "border-gray-800",
        coverBg: "bg-gray-700",
        avatarBorder: "border-gray-900",
        progressTrack: "bg-gray-700",
        textPrimary: "text-white",
        textSecondary: "text-gray-400",
        textHeader: "text-gray-200",
        textInline: "white",
        textInlineSecondary: "#9ca3af",
        surface: "#1f2937",
        surfaceAlt: "#111827",
        borderInline: "#1f2937",
        placeholderText: "#9ca3af",
        inputBg: "bg-slate-800",
        inputBorder: "border-accent",
        inputText: "text-white",
    },
    light: {
        pageBg: "bg-white",
        cardBg: "bg-gray-100",
        elevatedCardBg: "bg-white",
        cardBorder: "border-gray-200",
        coverBg: "bg-gray-200",
        avatarBorder: "border-gray-300",
        progressTrack: "bg-gray-300",
        textPrimary: "text-black",
        textSecondary: "text-gray-600",
        textHeader: "text-gray-800",
        textInline: "black",
        textInlineSecondary: "#6b7280",
        surface: "#ffffff",
        surfaceAlt: "#f9fafb",
        borderInline: "#e5e7eb",
        placeholderText: "#6b7280",
        inputBg: "bg-slate-100",
        inputBorder: "border-gray-300",
        inputText: "text-black",
    },
};

export function useTheme() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";
    return { isDark, ...theme[isDark ? "dark" : "light"] };
}
