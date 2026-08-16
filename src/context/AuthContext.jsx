import React, { createContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SAVED_ACCOUNTS_KEY = "@saved_accounts";
const MAX_SAVED_ACCOUNTS = 3;

export const AuthContext = createContext({
    steamId: null,
    setSteamId: () => { },
    clearSteamId: () => { },
    loading: true,
    savedAccounts: [],
    addSavedAccount: () => { },
    removeSavedAccount: () => { },
});

/** Provider do contexto de autenticação: gerencia o steamId atual, estado de loading e contas salvas. */
export function AuthProvider({ children }) {
    const [steamId, setSteamIdState] = useState(null);
    const [loading, setLoading] = useState(true);
    const [savedAccounts, setSavedAccounts] = useState([]);

    /** Persiste a lista de contas salvas no AsyncStorage. */
    const persistSavedAccounts = async (accounts) => {
        try {
            await AsyncStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
        } catch (e) {
            console.error("[Auth] erro ao salvar contas:", e);
        }
    };

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

        (async () => {
            try {
                const stored = await AsyncStorage.getItem(SAVED_ACCOUNTS_KEY);
                if (!mounted) return;
                if (stored) setSavedAccounts(JSON.parse(stored));
            } catch (e) {
                console.error("[Auth] erro ao ler contas salvas:", e);
            }
        })();

        return () => { mounted = false; };
    }, []);

    /** Define o steamId atual e o persiste no AsyncStorage. */
    const setSteamId = async (id) => {
        try {
            await AsyncStorage.setItem("@steam_id", id);
            setSteamIdState(id);
        } catch (e) {
            console.error(e);
        }
    };

    /** Limpa o steamId atual e remove do AsyncStorage. */
    const clearSteamId = async () => {
        try {
            await AsyncStorage.removeItem("@steam_id");
            setSteamIdState(null);
        } catch (e) {
            console.error(e);
        }
    };

    /** Adiciona uma conta à lista salva (sem duplicatas, limitada). */
    const addSavedAccount = async (account) => {
        if (!account?.steamId) return;
        const next = [
            account,
            ...savedAccounts.filter(a => a.steamId !== account.steamId),
        ].slice(0, MAX_SAVED_ACCOUNTS);
        setSavedAccounts(next);
        await persistSavedAccounts(next);
    };

    /** Remove uma conta salva pelo steamId. */
    const removeSavedAccount = async (steamId) => {
        const next = savedAccounts.filter(a => a.steamId !== steamId);
        setSavedAccounts(next);
        await persistSavedAccounts(next);
    };

    return (
        <AuthContext.Provider value={{ steamId, setSteamId, clearSteamId, loading, savedAccounts, addSavedAccount, removeSavedAccount }}>
            {children}
        </AuthContext.Provider>
    );
}
