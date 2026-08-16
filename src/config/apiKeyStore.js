import AsyncStorage from "@react-native-async-storage/async-storage";

const API_KEY_STORAGE_KEY = "@api_key";

let currentApiKey = null;

/** Retorna a API key atual em memória. */
export function getApiKeyStore() {
    return currentApiKey;
}

/** Define a API key em memória (sem persistir), normalizando espaços. */
export function setApiKeyStore(key) {
    currentApiKey = key && String(key).trim() ? String(key).trim() : null;
}

/** Carrega a API key salva do AsyncStorage para a memória. */
export async function loadApiKey() {
    try {
        const stored = await AsyncStorage.getItem(API_KEY_STORAGE_KEY);
        if (stored) {
            currentApiKey = stored;
            return stored;
        }
    } catch (e) {
        console.error("[ApiKey] erro ao ler AsyncStorage:", e);
    }
    return null;
}

/** Salva (ou remove) a API key no AsyncStorage e em memória. */
export async function saveApiKeyStore(key) {
    const trimmed = key ? String(key).trim() : "";
    currentApiKey = trimmed || null;
    try {
        if (trimmed) {
            await AsyncStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
        } else {
            await AsyncStorage.removeItem(API_KEY_STORAGE_KEY);
        }
    } catch (e) {
        console.error("[ApiKey] erro ao salvar:", e);
    }
    return currentApiKey;
}
