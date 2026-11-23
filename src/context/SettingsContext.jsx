import AsyncStorage from "@react-native-async-storage/async-storage";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const SETTINGS_KEY = "@settings";

/**
 * Preferências do app (RETROACHIEVEMENTS_PLAN.md, seção 4.6):
 * - hideHacks / hideSubsets: esconder hacks e subsets da biblioteca do RA
 * - keepAwake: manter a tela ligada enquanto o app está aberto (Perfil)
 */
export const DEFAULT_SETTINGS = {
    hideHacks: true,
    hideSubsets: false,
    keepAwake: false,
};

// Identifica o pedido de "tela ligada" deste app no expo-keep-awake
const KEEP_AWAKE_TAG = "casualnomore-settings";

const SettingsContext = createContext({
    settings: DEFAULT_SETTINGS,
    updateSettings: () => { },
});

/** Provider das preferências: lê do AsyncStorage na montagem e salva a cada mudança. */
export function SettingsProvider({ children }) {
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);

    useEffect(() => {
        AsyncStorage.getItem(SETTINGS_KEY)
            .then(stored => {
                if (stored) setSettings(s => ({ ...s, ...JSON.parse(stored) }));
            })
            .catch(e => console.error("[Settings] erro ao ler:", e));
    }, []);

    /** Muda uma ou mais preferências (`patch` = { chave: valor }). */
    const updateSettings = useCallback((patch) => {
        setSettings(prev => {
            const next = { ...prev, ...patch };
            AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
                .catch(e => console.error("[Settings] erro ao salvar:", e));
            return next;
        });
    }, []);

    // Tela ligada: vale para o app inteiro enquanto a opção estiver ativa
    useEffect(() => {
        if (settings.keepAwake) {
            activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(e => console.warn("[Settings] keep awake falhou:", e?.message));
        } else {
            Promise.resolve(deactivateKeepAwake(KEEP_AWAKE_TAG)).catch(() => { });
        }
    }, [settings.keepAwake]);

    const value = useMemo(() => ({ settings, updateSettings }), [settings, updateSettings]);
    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/** Preferências do app e a função para mudá-las. */
export function useSettings() {
    return useContext(SettingsContext);
}
