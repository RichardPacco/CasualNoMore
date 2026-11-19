import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// A API key fica no armazenamento seguro do aparelho (Keystore no Android,
// Keychain no iOS), criptografada, e não no AsyncStorage em texto puro.
// O SecureStore só aceita letras, números, ".", "-" e "_" no nome da chave.
const API_KEY_STORAGE_KEY = "steam_api_key";

// SecureStore não existe na web: lá a key continua no AsyncStorage.
const useSecureStore = Platform.OS !== "web";

/** Lê o valor salvo da key (SecureStore no celular, AsyncStorage na web). */
function readStoredKey() {
    return useSecureStore
        ? SecureStore.getItemAsync(API_KEY_STORAGE_KEY)
        : AsyncStorage.getItem(API_KEY_STORAGE_KEY);
}

/** Grava o valor da key (SecureStore no celular, AsyncStorage na web). */
function writeStoredKey(value) {
    return useSecureStore
        ? SecureStore.setItemAsync(API_KEY_STORAGE_KEY, value)
        : AsyncStorage.setItem(API_KEY_STORAGE_KEY, value);
}

/** Apaga a key salva (SecureStore no celular, AsyncStorage na web). */
function deleteStoredKey() {
    return useSecureStore
        ? SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY)
        : AsyncStorage.removeItem(API_KEY_STORAGE_KEY);
}

let currentApiKey = null;

/** Retorna a API key atual em memória. */
export function getApiKeyStore() {
    return currentApiKey;
}

/** Define a API key em memória (sem persistir), normalizando espaços. */
export function setApiKeyStore(key) {
    currentApiKey = key && String(key).trim() ? String(key).trim() : null;
}

/** Carrega a API key salva do armazenamento seguro para a memória. */
export async function loadApiKey() {
    try {
        const stored = await readStoredKey();
        if (stored) {
            currentApiKey = stored;
            return stored;
        }
    } catch (e) {
        console.error("[ApiKey] erro ao ler armazenamento seguro:", e);
    }
    return null;
}

/** Salva (ou remove, se vazia) a API key no armazenamento seguro e em memória. */
export async function saveApiKeyStore(key) {
    const trimmed = key ? String(key).trim() : "";
    currentApiKey = trimmed || null;
    try {
        if (trimmed) {
            await writeStoredKey(trimmed);
        } else {
            await deleteStoredKey();
        }
    } catch (e) {
        console.error("[ApiKey] erro ao salvar:", e);
    }
    return currentApiKey;
}
