import { AuthProvider } from "@/src/context/AuthContext";
import { LanguageProvider } from "@/src/i18n/LanguageContext";
import { COLORS } from "@/src/theme/colors";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Appearance } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { RootSiblingParent } from "react-native-root-siblings";
import { SafeAreaView } from "react-native-safe-area-context";
import './globals.css';

// Mantém a abertura nativa na tela até as fontes carregarem (sem "piscar"
// texto na fonte do sistema).
SplashScreen.preventAutoHideAsync().catch(() => { });

// Tema único escuro: telas que ainda consultam useColorScheme recebem "dark".
Appearance.setColorScheme?.("dark");

/**
 * Layout raiz: carrega as fontes do redesign, providers (Language, Auth) e o
 * Stack de telas (index, tabs, login).
 * As API keys salvas são carregadas pelo AuthProvider, junto com as contas.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  const ready = fontsLoaded || !!fontError; // com erro, segue com a fonte do sistema

  useEffect(() => {
    if (fontError) console.error("[Fonts] falha ao carregar fontes:", fontError);
    if (ready) SplashScreen.hideAsync().catch(() => { });
  }, [ready, fontError]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <RootSiblingParent>
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
          <LanguageProvider>
            <AuthProvider>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.bg } }}>
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
