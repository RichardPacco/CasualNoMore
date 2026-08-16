import AsyncStorage from "@react-native-async-storage/async-storage";

const API_KEY_STORAGE_KEY = "@api_key";

let currentApiKey = null;

export function getApiKeyStore() {
    return currentApiKey;
}

export function setApiKeyStore(key) {
    currentApiKey = key && String(key).trim() ? String(key).trim() : null;
}

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
