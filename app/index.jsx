import { useRouter } from "expo-router";
import { useContext, useEffect } from "react";
import AppSplash from "@/src/components/AppSplash";
import { AuthContext } from "@/src/context/AuthContext";

export default function Index() {
    const { steamId, loading } = useContext(AuthContext);
    const router = useRouter();

    useEffect(() => {
        if (loading) return;
        // Se tiver steamId vai para grupo das tabs, senão vai para login
        if (steamId) router.replace("/(tabs)/GameStack");
        else router.replace("/(auth)/login");
    }, [loading, steamId, router]);

    return <AppSplash />;
}
