import React, { createContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const AuthContext = createContext({ steamId: null, setSteamId: () => { }, clearSteamId: () => { }, loading: true });

export function AuthProvider({ children }) {
    const [steamId, setSteamIdState] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                console.log("[Auth] carregando steamId do AsyncStorage...");
                const stored = await AsyncStorage.getItem("@steam_id");
                console.log("[Auth] valor lido do AsyncStorage:", stored);
                if (!mounted) return;
                if (stored) setSteamIdState(stored);
            } catch (e) {
                console.error("[Auth] erro ao ler AsyncStorage:", e);
            } finally {
                if (!mounted) return;
                setLoading(false);
                console.log("[Auth] loading = false");
            }
        })();

        return () => { mounted = false; };
    }, []);

    const setSteamId = async (id) => {
        try {
            await AsyncStorage.setItem("@steam_id", id);
            setSteamIdState(id);
        } catch (e) {
            console.error(e);
        }
    };

    const clearSteamId = async () => {
        try {
            await AsyncStorage.removeItem("@steam_id");
            setSteamIdState(null);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <AuthContext.Provider value={{ steamId, setSteamId, clearSteamId, loading }}>
            {children}
        </AuthContext.Provider>
    );
}
