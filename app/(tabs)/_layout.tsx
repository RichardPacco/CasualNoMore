import { Stack, Tabs } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar, useColorScheme } from "react-native";
import * as NavigationBar from "expo-navigation-bar";
import '../globals.css';

export default function _Layout() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

    NavigationBar.setBackgroundColorAsync("transparent");
    NavigationBar.setButtonStyleAsync(isDark ? "light" : "dark");

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? "#111" : "#fff" }}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#111" : "#fff"} />
            <Tabs>
                <Tabs.Screen name="GameStack" options={{ title: "Games", headerShown: false }}
                />
                <Tabs.Screen name="profile" options={{ title: "Profile", headerShown: false }}
                />
            </Tabs>
        </SafeAreaView>
    );
}
