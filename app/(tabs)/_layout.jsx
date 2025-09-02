import Ionicons from "@expo/vector-icons/Ionicons";
import * as NavigationBar from "expo-navigation-bar";
import { Tabs } from "expo-router";
import { StatusBar, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import '../globals.css';

export default function _Layout() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

    const pageBg = isDark ? "#111" : "#fff";

    // Set navigation bar color safely now that edge-to-edge is disabled
    NavigationBar.setBackgroundColorAsync(pageBg);
    NavigationBar.setButtonStyleAsync(isDark ? "light" : "dark");

    const tabBarStyle = {
        backgroundColor: pageBg,
        borderTopWidth: 0,
        elevation: 5,
        shadowColor: isDark ? "#000" : "#aaa",
        shadowOpacity: 0.1,
        shadowRadius: 5,
        height: 60,
        paddingBottom: 5,
    };

    const tabBarLabelStyle = {
        fontSize: 12,
        fontWeight: "600",
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: pageBg }}>
            <StatusBar
                barStyle={isDark ? "light-content" : "dark-content"}
                backgroundColor={pageBg}
            />
            <Tabs
                screenOptions={{
                    tabBarActiveTintColor: isDark ? "#4ade80" : "#16a34a",
                    tabBarInactiveTintColor: isDark ? "#9ca3af" : "#6b7280",
                    tabBarStyle,
                    tabBarLabelStyle,
                    headerShown: false,
                }}
            >
                <Tabs.Screen
                    name="GameStack"
                    options={{
                        title: "Games",
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="game-controller-outline" color={color} size={size} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="Profile"
                    options={{
                        title: "Profile",
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="person-circle-outline" color={color} size={size} />
                        ),
                    }}
                />
            </Tabs>
        </SafeAreaView>
    );
}
