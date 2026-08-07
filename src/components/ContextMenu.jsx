import { COLORS } from "@/src/theme/colors";
import { useTheme } from "@/src/theme/styles";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Pressable, StyleSheet, Text, View, } from "react-native";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const MENU_WIDTH = 200;
const TITLE_HEIGHT = 34;
const ROW_HEIGHT = 64;
const ROW_GAP = 10;
const PANEL_PADDING = 6;
const FADE_MS = 150;

const s = StyleSheet.create({
    overlay: StyleSheet.absoluteFillObject,
    wrapper: {
        position: "absolute",
        width: MENU_WIDTH,
        borderRadius: 12,
        elevation: 1000,
        shadowColor: "#000",
        shadowOpacity: 0.3,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
    },
    panel: {
        borderRadius: 12,
        paddingVertical: PANEL_PADDING,
        paddingHorizontal: PANEL_PADDING,
        gap: ROW_GAP,
        overflow: "hidden",
        borderWidth: 1,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "stretch",
        paddingHorizontal: 12,
        height: ROW_HEIGHT,
        borderRadius: 8,
    },
    title: {
        paddingHorizontal: 12,
        height: TITLE_HEIGHT,
        lineHeight: TITLE_HEIGHT,
        fontSize: 12,
        fontWeight: "700",
    },
    rowText: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: "600",
    },
    icon: {
        marginRight: 12,
    },
});

export default function ContextMenu({ visible, x, y, bounds, title, options, onClose, }) {
    const t = useTheme();
    const isDark = t.isDark;
    const [mounted, setMounted] = useState(false);
    const opacity = useRef(new Animated.Value(0)).current;
    const posRef = useRef({ x, y, width: bounds?.width ?? SCREEN_W, height: bounds?.height ?? SCREEN_H, });

    useEffect(() => {
        if (visible) {
            posRef.current = { x, y, width: bounds?.width ?? SCREEN_W, height: bounds?.height ?? SCREEN_H, };
            setMounted(true);
            opacity.setValue(0);
            Animated.timing(opacity, {
                toValue: 1,
                duration: FADE_MS,
                useNativeDriver: true,
            }).start();
        } else {
            setMounted(false);
        }
    }, [visible, opacity, x, y, bounds?.width, bounds?.height]);

    if (!mounted) return null;

    const titleRows = title ? 1 : 0;
    const totalItems = titleRows + options.length;
    const menuHeight =
        titleRows * TITLE_HEIGHT +
        options.length * ROW_HEIGHT +
        PANEL_PADDING * 2 +
        ROW_GAP * Math.max(0, totalItems - 1);
    const left = Math.max(8, Math.min(posRef.current.x, posRef.current.width - MENU_WIDTH - 8));
    const top = Math.max(8, Math.min(posRef.current.y, posRef.current.height - menuHeight - 8));

    return (
        <Animated.View style={[s.overlay, { opacity }]}>
            <Pressable style={s.overlay} onPress={onClose} />
            <View style={[s.wrapper, { left, top }]}>
                <View
                    style={[
                        s.panel,
                        {
                            backgroundColor: t.surface,
                            borderColor: COLORS.accent,
                        },
                    ]}
                >
                    {title ? (
                        <Text
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            style={[
                                s.title,
                                { color: isDark ? "#9ca3af" : "#6b7280" },
                            ]}
                        >
                            {title}
                        </Text>
                    ) : null}
                    {options.map((opt) => (
                        <Pressable
                            key={opt.label}
                            onPress={() => {
                                onClose();
                                opt.onPress?.();
                            }}
                            style={({ pressed }) => [
                                s.row,
                                {
                                    backgroundColor: pressed
                                        ? (isDark ? "#374151" : "#f3f4f6")
                                        : "transparent",
                                },
                            ]}
                        >
                            {opt.icon ? (
                                <Ionicons
                                    name={opt.icon}
                                    size={18}
                                    color={isDark ? "#9ca3af" : "#6b7280"}
                                    style={s.icon}
                                />
                            ) : null}
                            <Text
                                numberOfLines={1}
                                style={[
                                    s.rowText,
                                    { color: isDark ? "#f9fafb" : "#111827" },
                                ]}
                            >
                                {opt.label}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            </View>
        </Animated.View>
    );
}
