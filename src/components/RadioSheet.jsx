import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, useColorScheme, View } from "react-native";
import { setOverlayOpen } from "@/src/utils/overlayBar";
import { COLORS } from "@/src/theme/colors";

export default function RadioSheet({ visible, onClose, title, options, selected, onSelect, counts }) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

    const anim = useRef(new Animated.Value(320)).current;
    const closingRef = useRef(false);

    useEffect(() => {
        setOverlayOpen(visible);
        return () => setOverlayOpen(false);
    }, [visible]);

    useEffect(() => {
        if (visible) {
            closingRef.current = false;
            anim.setValue(320);
            Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
        }
    }, [visible, anim]);

    const close = () => {
        if (closingRef.current) return;
        closingRef.current = true;
        Animated.timing(anim, { toValue: 320, duration: 200, useNativeDriver: true }).start(() => {
            closingRef.current = false;
            onClose();
        });
    };

    if (!visible) return null;

    return (
        <>
            <Pressable
                style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 100 }}
                onPress={close}
            />
            <Animated.View
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: isDark ? "#111827" : "#ffffff",
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    paddingHorizontal: 20,
                    paddingTop: 20,
                    paddingBottom: 32,
                    zIndex: 101,
                    elevation: 10,
                    transform: [{ translateY: anim }],
                }}
            >
                <View
                    style={{
                        alignSelf: "center",
                        width: 40,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: isDark ? "#4b5563" : "#e5e7eb",
                        marginBottom: 16,
                    }}
                />
                <Text
                    style={{
                        color: isDark ? "#f9fafb" : "#111827",
                        fontSize: 18,
                        fontWeight: "700",
                        marginBottom: 8,
                    }}
                >
                    {title}
                </Text>

                {options.map((opt) => (
                    <Pressable
                        key={opt.value}
                        onPress={() => {
                            onSelect(opt.value);
                            close();
                        }}
                        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                    >
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 12,
                            }}
                        >
                            <View
                                style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: 10,
                                    borderWidth: 2,
                                    borderColor: selected === opt.value
                                        ? COLORS.accent
                                        : (isDark ? "#4b5563" : "#d1d5db"),
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                {selected === opt.value && (
                                    <View
                                        style={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: 5,
                                            backgroundColor: COLORS.accent,
                                        }}
                                    />
                                )}
                            </View>
                            <Text
                                numberOfLines={1}
                                style={{
                                    flex: 1,
                                    marginLeft: 12,
                                    marginRight: 12,
                                    color: isDark ? "#f9fafb" : "#111827",
                                    fontSize: 16,
                                    lineHeight: 20,
                                }}
                            >
                                {opt.label}
                            </Text>
                            {counts && (
                                <Text
                                    numberOfLines={1}
                                    style={{
                                        color: isDark ? "#9ca3af" : "#6b7280",
                                        fontSize: 14,
                                        lineHeight: 20,
                                        minWidth: 28,
                                        textAlign: "right",
                                    }}
                                >
                                    {counts[opt.value]}
                                </Text>
                            )}
                        </View>
                    </Pressable>
                ))}
            </Animated.View>
        </>
    );
}
