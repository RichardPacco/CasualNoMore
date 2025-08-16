import * as NavigationBar from 'expo-navigation-bar';
import { Stack } from "expo-router";
import { StatusBar, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import './globals.css';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  NavigationBar.setBackgroundColorAsync('transparent');
  NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: isDark ? "#111" : "#fff",
      }}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={isDark ? "#111" : "#fff"}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: isDark ? "#111" : "#fff" },
        }}
      />
    </SafeAreaView>
  );
}
