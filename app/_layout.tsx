import './globals.css';
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar, useColorScheme } from "react-native";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: isDark ? "#111" : "#fff", // muda conforme tema
      }}
      edges={["top", "left", "right"]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"} // texto conforme tema
        backgroundColor={isDark ? "#111" : "#fff"}           // cor de fundo conforme tema
      />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaView>
  );
}

