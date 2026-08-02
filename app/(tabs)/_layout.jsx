import Ionicons from "@expo/vector-icons/Ionicons";
import * as NavigationBar from "expo-navigation-bar";
import { Tabs } from "expo-router";
import { StatusBar, useColorScheme, View } from "react-native";
import '../globals.css';

export default function TabsLayout() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

    NavigationBar.setBackgroundColorAsync(isDark ? "#111" : "#fff");
    NavigationBar.setButtonStyleAsync(isDark ? "light" : "dark");

    const tabBarStyle = {
        backgroundColor: isDark ? "#111" : "#fff",
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
        <View style={{ flex: 1, backgroundColor: isDark ? "#111" : "#fff" }}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#111" : "#fff"} />
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
        </View>
    );
}
