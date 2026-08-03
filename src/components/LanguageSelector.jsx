import { Image, Pressable, useColorScheme, View } from "react-native";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS } from "@/src/theme/colors";

const OPTIONS = [
    { code: "pt", label: "PT", flag: require("../../assets/images/Brazil_flag.png") },
    { code: "en", label: "EN", flag: require("../../assets/images/Flag_of_the_United_States.png") },
];

export default function LanguageSelector({ overlay = false }) {
    const { language, setLanguage } = useLanguage();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

    const containerBg = overlay
        ? "rgba(255,255,255,0.08)"
        : isDark
            ? "#111827"
            : "#ffffff";
    const borderColor = overlay
        ? "rgba(255,255,255,0.18)"
        : isDark
            ? "#374151"
            : "#e5e7eb";

    return (
        <View
            style={{
                flexDirection: "row",
                borderRadius: 12,
                padding: 4,
                backgroundColor: containerBg,
                borderWidth: 1,
                borderColor: borderColor,
                alignSelf: "flex-start",
                gap: 10,
            }}
        >
            {OPTIONS.map((opt) => {
                const active = language === opt.code;
                return (
                    <Pressable
                        key={opt.code}
                        onPress={() => setLanguage(opt.code)}
                        accessibilityLabel={opt.label}
                        style={({ pressed }) => ({
                            width: 48,
                            height: 34,
                            borderRadius: 8,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: active ? "rgba(255,179,0,0.16)" : "transparent",
                            borderWidth: active ? 2 : 0,
                            borderColor: active ? COLORS.warning : "transparent",
                            shadowColor: COLORS.warning,
                            shadowOpacity: active ? 0.7 : 0,
                            shadowRadius: 6,
                            shadowOffset: { width: 0, height: 0 },
                            elevation: active ? 6 : 0,
                            opacity: pressed ? 0.7 : 1,
                        })}
                    >
                        <Image
                            source={opt.flag}
                            style={{ width: 28, height: 20, borderRadius: 2 }}
                            resizeMode="cover"
                        />
                    </Pressable>
                );
            })}
        </View>
    );
}
