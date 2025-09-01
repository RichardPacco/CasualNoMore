import { Slot, Stack } from "expo-router";
import { RootSiblingParent } from "react-native-root-siblings";
import { AuthProvider } from "../src/context/AuthContext";
import './globals.css';

export default function RootLayout() {
  return (
    <RootSiblingParent>
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
    </RootSiblingParent>
  );
}
