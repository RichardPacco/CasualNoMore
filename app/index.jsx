import { useRouter } from "expo-router";
import { useContext, useEffect } from "react";
import AppSplash from "@/src/components/AppSplash";
import { AuthContext } from "@/src/context/AuthContext";

/**
 * Tela inicial (splash): redireciona para as tabs se já logado, senão para o login.
 */
export default function Index() {
    const { hasAnyAccount, loading } = useContext(AuthContext);
    const router = useRouter();

    useEffect(() => {
        if (loading) return;
        // Só vai para as tabs com pelo menos uma plataforma conectada com conta
        // E API key: sem a key nenhuma chamada funciona (ex.: key apagada).
        // O AuthProvider já carregou as keys antes de `loading` virar false.
        if (hasAnyAccount) router.replace("/(tabs)/GameStack");
        else router.replace("/(auth)/login");
    }, [loading, hasAnyAccount, router]);

    return <AppSplash />;
}
