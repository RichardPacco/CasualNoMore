import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// As API keys ficam no armazenamento seguro do aparelho (Keystore no Android,
// Keychain no iOS), criptografadas, e não no AsyncStorage em texto puro.
// Uma key por plataforma. O SecureStore só aceita letras, números, ".", "-"
// e "_" no nome da chave.
const STORAGE_KEYS = {
    steam: "steam_api_key",
    ra: "ra_api_key",
};

// SecureStore não existe na web: lá as keys continuam no AsyncStorage.
const useSecureStore = Platform.OS !== "web";

/** Nome da chave no armazenamento para a plataforma (erro se desconhecida). */
function storageKey(platform) {
    const key = STORAGE_KEYS[platform];
    if (!key) throw new Error(`[ApiKey] plataforma desconhecida: ${platform}`);
    return key;
}

/** Lê o valor salvo da key (SecureStore no celular, AsyncStorage na web). */
function readStoredKey(platform) {
    const name = storageKey(platform);
    return useSecureStore ? SecureStore.getItemAsync(name) : AsyncStorage.getItem(name);
}

/** Grava o valor da key (SecureStore no celular, AsyncStorage na web). */
function writeStoredKey(platform, value) {
    const name = storageKey(platform);
    return useSecureStore ? SecureStore.setItemAsync(name, value) : AsyncStorage.setItem(name, value);
}

/** Apaga a key salva (SecureStore no celular, AsyncStorage na web). */
function deleteStoredKey(platform) {
    const name = storageKey(platform);
    return useSecureStore ? SecureStore.deleteItemAsync(name) : AsyncStorage.removeItem(name);
}

// Keys em memória, por plataforma
const currentKeys = { steam: null, ra: null };

/** Retorna a API key da plataforma em memória (ou null). */
export function getApiKey(platform) {
    return currentKeys[platform] ?? null;
}

/** Carrega a key salva da plataforma para a memória e a retorna (ou null). */
export async function loadApiKey(platform) {
    try {
        const stored = await readStoredKey(platform);
        currentKeys[platform] = stored || null;
    } catch (e) {
        console.error(`[ApiKey] erro ao ler armazenamento seguro (${platform}):`, e);
    }
    return currentKeys[platform] ?? null;
}

/** Carrega as keys de todas as plataformas para a memória. */
export async function loadApiKeys() {
    await Promise.all(Object.keys(STORAGE_KEYS).map(loadApiKey));
    return { ...currentKeys };
}

/** Salva (ou remove, se vazia) a key da plataforma no armazenamento seguro e em memória. */
export async function saveApiKey(platform, key) {
    const trimmed = key ? String(key).trim() : "";
    currentKeys[platform] = trimmed || null;
    try {
        if (trimmed) {
            await writeStoredKey(platform, trimmed);
        } else {
            await deleteStoredKey(platform);
        }
    } catch (e) {
        console.error(`[ApiKey] erro ao salvar (${platform}):`, e);
    }
    return currentKeys[platform];
}
