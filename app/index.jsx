import { useRouter } from "expo-router";
import { useContext, useEffect } from "react";
import AppSplash from "@/src/components/AppSplash";
import { getApiKeyStore } from "@/src/config/apiKeyStore";
import { AuthContext } from "@/src/context/AuthContext";

/**
 * Tela inicial (splash): redireciona para as tabs se já logado, senão para o login.
 */
export default function Index() {
    const { steamId, loading } = useContext(AuthContext);
    const router = useRouter();

    useEffect(() => {
        if (loading) return;
        // Só vai para as tabs com steamId E API key: sem a key nenhuma chamada à
        // Steam funciona (ex.: key apagada, ou perdida na troca para o SecureStore).
        // O AuthProvider já carregou a key antes de `loading` virar false.
        if (steamId && getApiKeyStore()) router.replace("/(tabs)/GameStack");
        else router.replace("/(auth)/login");
    }, [loading, steamId, router]);

    return <AppSplash />;
}
