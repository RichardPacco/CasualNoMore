import { Slot, Stack } from "expo-router";
import { RootSiblingParent } from "react-native-root-siblings";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider } from "../src/context/AuthContext";
import './globals.css';

export default function RootLayout() {
  return (
    <RootSiblingParent>
      <SafeAreaView style={{ flex: 1 }}>
        <AuthProvider>
          <Slot>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }}
              />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }}
              />
              <Stack.Screen name="(auth)/login" options={{ headerShown: false }}
              />
            </Stack>
          </Slot>
        </AuthProvider>
      </SafeAreaView>
    </RootSiblingParent>
  );
}
