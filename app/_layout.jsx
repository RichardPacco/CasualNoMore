import { AuthProvider } from "@/src/context/AuthContext";
import { LanguageProvider } from "@/src/i18n/LanguageContext";
import { loadApiKey } from "@/src/config/apiKeyStore";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { RootSiblingParent } from "react-native-root-siblings";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect } from "react";
import './globals.css';

/**
 * Layout raiz: providers (Language, Auth) + Stack de telas (index, tabs, login).
 * Carrega a API key salva ao montar.
 */
export default function RootLayout() {
  useEffect(() => {
    loadApiKey();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RootSiblingParent>
        <SafeAreaView style={{ flex: 1 }}>
          <LanguageProvider>
            <AuthProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="(auth)/login" />
              </Stack>
            </AuthProvider>
          </LanguageProvider>
        </SafeAreaView>
      </RootSiblingParent>
    </GestureHandlerRootView>
  );
}
