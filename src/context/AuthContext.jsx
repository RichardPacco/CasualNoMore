import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiKey, loadApiKeys } from "@/src/config/apiKeyStore";

const ACCOUNTS_KEY = "@accounts";
const SAVED_ACCOUNTS_KEY = "@saved_accounts";
const MAX_SAVED_ACCOUNTS = 3;

// Uma conta por plataforma, ou null quando a plataforma não está conectada:
// steam: { steamId }, ra: { user, ulid, userPic }
const NO_ACCOUNTS = { steam: null, ra: null };

export const AuthContext = createContext({
    accounts: NO_ACCOUNTS,
    connect: async () => { },
    disconnect: async () => { },
    hasAnyAccount: false,
    // atalhos da Steam, usados pelas telas que só conhecem a Steam
    steamId: null,
    setSteamId: async () => { },
    clearSteamId: async () => { },
    loading: true,
    savedAccounts: [],
    addSavedAccount: async () => { },
    removeSavedAccount: async () => { },
    clearSavedAccounts: async () => { },
});

/**
 * Provider do contexto de autenticação: as contas conectadas de cada
 * plataforma (Steam e RetroAchievements), o estado de loading e as contas
 * salvas da tela de login.
 */
export function AuthProvider({ children }) {
    const [accounts, setAccounts] = useState(NO_ACCOUNTS);
    const [loading, setLoading] = useState(true);
    const [savedAccounts, setSavedAccounts] = useState([]);

    // Sempre o valor mais recente, para connect/disconnect seguidos não
    // gravarem uma versão antiga das contas.
    const accountsRef = useRef(NO_ACCOUNTS);

    /** Troca as contas na memória e no AsyncStorage. */
    const writeAccounts = useCallback(async (next) => {
        accountsRef.current = next;
        setAccounts(next);
        try {
            await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next));
        } catch (e) {
            console.error("[Auth] erro ao salvar contas:", e);
        }
    }, []);

    /** Persiste a lista de contas salvas no AsyncStorage. */
    const persistSavedAccounts = async (list) => {
        try {
            await AsyncStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(list));
        } catch (e) {
            console.error("[Auth] erro ao salvar contas salvas:", e);
        }
    };

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                // As API keys são carregadas aqui, junto com as contas: `loading`
                // só vira false quando tudo está pronto. Senão a tela inicial
                // poderia ir para as tabs e chamar a API antes da key estar em
                // memória. (loadApiKeys já trata os próprios erros.)
                const [stored] = await Promise.all([
                    AsyncStorage.getItem(ACCOUNTS_KEY),
                    loadApiKeys(),
                ]);
                if (!mounted) return;
                const parsed = stored ? JSON.parse(stored) : null;
                const next = { ...NO_ACCOUNTS, ...(parsed || {}) };
                accountsRef.current = next;
                setAccounts(next);
            } catch (e) {
                console.error("[Auth] erro ao ler contas:", e);
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        (async () => {
            try {
                const stored = await AsyncStorage.getItem(SAVED_ACCOUNTS_KEY);
                if (!mounted) return;
                // só entradas no formato atual ({ platform, id, ... })
                if (stored) setSavedAccounts(JSON.parse(stored).filter(a => a?.platform && a?.id));
            } catch (e) {
                console.error("[Auth] erro ao ler contas salvas:", e);
            }
        })();

        return () => { mounted = false; };
    }, []);

    /** Conecta (ou atualiza) a conta de uma plataforma. */
    const connect = useCallback(
        (platform, account) => writeAccounts({ ...accountsRef.current, [platform]: account }),
        [writeAccounts]
    );

    /** Desconecta a conta de uma plataforma (a key é tratada por quem chama). */
    const disconnect = useCallback(
        (platform) => writeAccounts({ ...accountsRef.current, [platform]: null }),
        [writeAccounts]
    );

    /** Atalho da Steam: conecta a conta pelo steamId. */
    const setSteamId = useCallback((id) => connect("steam", { steamId: String(id) }), [connect]);

    /** Atalho da Steam: desconecta a conta. */
    const clearSteamId = useCallback(() => disconnect("steam"), [disconnect]);

    /**
     * Adiciona uma conta à lista salva da tela de login: `{ platform, id,
     * name, avatar }`. Sem duplicatas e no máximo MAX_SAVED_ACCOUNTS por
     * plataforma; a conta adicionada vai para o topo.
     */
    const addSavedAccount = async (account) => {
        if (!account?.platform || !account?.id) return;
        const same = (a) => a.platform === account.platform && a.id === account.id;
        const others = savedAccounts.filter(a => !same(a));
        const samePlatform = others.filter(a => a.platform === account.platform)
            .slice(0, MAX_SAVED_ACCOUNTS - 1);
        const next = [
            account,
            ...samePlatform,
            ...others.filter(a => a.platform !== account.platform),
        ];
        setSavedAccounts(next);
        await persistSavedAccounts(next);
    };

    /** Remove uma conta salva pela plataforma e id. */
    const removeSavedAccount = async (platform, id) => {
        const next = savedAccounts.filter(a => !(a.platform === platform && a.id === id));
        setSavedAccounts(next);
        await persistSavedAccounts(next);
    };

    /** Remove todas as contas salvas (memória e AsyncStorage). */
    const clearSavedAccounts = async () => {
        setSavedAccounts([]);
        try {
            await AsyncStorage.removeItem(SAVED_ACCOUNTS_KEY);
        } catch (e) {
            console.error("[Auth] erro ao limpar contas salvas:", e);
        }
    };

    // Uma plataforma só conta como conectada com a conta E a key em memória:
    // sem a key nenhuma chamada à API funciona.
    const hasAnyAccount = useMemo(
        () => Object.keys(accounts).some(p => accounts[p] && getApiKey(p)),
        [accounts]
    );

    const steamId = accounts.steam?.steamId ?? null;

    return (
        <AuthContext.Provider value={{
            accounts, connect, disconnect, hasAnyAccount,
            steamId, setSteamId, clearSteamId,
            loading,
            savedAccounts, addSavedAccount, removeSavedAccount, clearSavedAccounts,
        }}>
            {children}
        </AuthContext.Provider>
    );
}
