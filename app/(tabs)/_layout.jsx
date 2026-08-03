import Ionicons from "@expo/vector-icons/Ionicons";
import * as NavigationBar from "expo-navigation-bar";
import { Tabs } from "expo-router";
import { useSyncExternalStore } from "react";
import { Pressable, StatusBar, useColorScheme, View } from "react-native";
import '../globals.css';
import { useLanguage } from "@/src/i18n/LanguageContext";
import { COLORS } from "@/src/theme/colors";
import { theme } from "@/src/theme/styles";
import { getOverlayOpen, subscribeOverlay } from "@/src/utils/overlayBar";

function TabBarButton({ children, style, onPress, onLongPress, accessibilityState }) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";
    const selected = accessibilityState?.selected ?? false;

    return (
        <Pressable onPress={onPress} onLongPress={onLongPress} style={style}>
            {({ pressed }) => (
                <View
                    style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 20,
                        marginHorizontal: 6,
                        marginVertical: 4,
                        backgroundColor: selected
                            ? (isDark ? COLORS.accentSoft : COLORS.accentSoftLight)
                            : "transparent",
                        opacity: pressed ? 0.7 : 1,
                    }}
                >
                    {children}
                </View>
            )}
        </Pressable>
    );
}

export default function TabsLayout() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";
    const s = isDark ? theme.dark : theme.light;
    const { t } = useLanguage();
    const overlayOpen = useSyncExternalStore(subscribeOverlay, getOverlayOpen);

    NavigationBar.setBackgroundColorAsync(s.surface);
    NavigationBar.setButtonStyleAsync(isDark ? "light" : "dark");

    return (
        <View style={{ flex: 1, backgroundColor: s.surfaceAlt }}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={s.surfaceAlt} />
            <Tabs
                screenOptions={{
                    headerShown: false,
                    animation: "shift",
                    sceneStyle: { backgroundColor: s.surfaceAlt },
                    tabBarActiveTintColor: isDark ? COLORS.accent : COLORS.accentStrong,
                    tabBarInactiveTintColor: isDark ? "#9ca3af" : "#6b7280",
                    tabBarStyle: {
                        position: "absolute",
                        left: 16,
                        right: 16,
                        bottom: 16,
                        height: 60,
                        borderRadius: 30,
                        backgroundColor: s.surface,
                        borderTopWidth: 0,
                        borderWidth: 1,
                        borderColor: COLORS.accent,
                        elevation: 10,
                        shadowColor: "#000",
                        shadowOpacity: 0.18,
                        shadowRadius: 12,
                        shadowOffset: { width: 0, height: 4 },
                        paddingTop: 4,
                        paddingBottom: 4,
                        display: overlayOpen ? "none" : "flex",
                    },
                    tabBarButton: (props) => <TabBarButton {...props} />,
                    tabBarLabelStyle: {
                        fontSize: 11,
                        fontWeight: "700",
                    },
                }}
            >
                <Tabs.Screen
                    name="GameStack"
                    options={{
                        title: t("tabGames"),
                        tabBarIcon: ({ color, size, focused }) => (
                            <Ionicons
                                name={focused ? "game-controller" : "game-controller-outline"}
                                color={color}
                                size={size}
                            />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="ProfileStack"
                    options={{
                        title: t("tabProfile"),
                        tabBarIcon: ({ color, size, focused }) => (
                            <Ionicons
                                name={focused ? "person-circle" : "person-circle-outline"}
                                color={color}
                                size={size}
                            />
                        ),
                    }}
                />
            </Tabs>
        </View>
    );
}
