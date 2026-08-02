import { Stack } from "expo-router";
import { RootSiblingParent } from "react-native-root-siblings";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider } from "@/src/context/AuthContext";
import './globals.css';

export default function RootLayout() {
  return (
    <RootSiblingParent>
      <SafeAreaView style={{ flex: 1 }}>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)/login" />
          </Stack>
        </AuthProvider>
      </SafeAreaView>
    </RootSiblingParent>
  );
}
