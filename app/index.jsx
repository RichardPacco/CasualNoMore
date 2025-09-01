import { useRouter } from "expo-router";
import { useContext, useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { AuthContext } from "../src/context/AuthContext";

export default function Index() {
    const { steamId, loading } = useContext(AuthContext);
    const router = useRouter();

    useEffect(() => {
        if (loading) return;
        // Se tiver steamId vai para grupo das tabs, senão vai para login
        if (steamId) router.replace("/(tabs)/GameStack");
        else router.replace("/(auth)/login");
    }, [loading, steamId]);

    return (
        <View style={{ flex: 1, backgroundColor: "#111", justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color="#fff" />
        </View>
    );
}
