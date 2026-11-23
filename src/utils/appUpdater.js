import * as Application from "expo-application";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as FileSystem from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import { Platform } from "react-native";

/**
 * Atualização do app pelas releases do GitHub (Android).
 *
 * O workflow .github/workflows/release.yml publica, a cada tag "vX.Y.Z", uma
 * release com o APK assinado. Aqui o app consulta a última release, compara a
 * versão com a instalada, baixa o APK e abre o instalador do Android. O
 * Android sempre pede confirmação (não existe atualização silenciosa) e, na
 * primeira vez, pede para liberar "instalar apps desconhecidos" para o app.
 * A atualização só instala se o APK novo tiver a mesma assinatura do
 * instalado (ver plugins/withReleaseSigning.js).
 */

const REPO = "RichardPacco/CasualNoMore";
const LATEST_RELEASE_URL = `https://api.github.com/repos/${REPO}/releases/latest`;

/** O botão de atualizar só existe no Android (APK fora da loja). */
export const UPDATES_SUPPORTED = Platform.OS === "android";

/**
 * Versão instalada ("3.2.0"). No Expo Go a versão nativa é a do Expo Go,
 * então usa a do app.config.js.
 */
export function installedVersion() {
    const config = Constants.expoConfig?.version ?? "0.0.0";
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return config;
    return Application.nativeApplicationVersion ?? config;
}

/** Compara versões "a.b.c": > 0 se `a` é mais nova, 0 se igual, < 0 se mais velha. */
export function compareVersions(a, b) {
    const pa = String(a).replace(/^v/i, "").split(".").map(n => parseInt(n, 10) || 0);
    const pb = String(b).replace(/^v/i, "").split(".").map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

/**
 * Consulta a última release no GitHub. Retorna
 * `{ available, current, version, notes, url, size }`; `available` só é true
 * se a release for mais nova que a instalada e tiver um .apk anexado.
 * Sem nenhuma release publicada ainda, retorna `available: false`.
 */
export async function checkForUpdate() {
    const current = installedVersion();
    const res = await fetch(LATEST_RELEASE_URL, { headers: { Accept: "application/vnd.github+json" } });
    if (res.status === 404) return { available: false, current, version: current };
    if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);

    const release = await res.json();
    const version = String(release.tag_name || "").replace(/^v/i, "");
    const apk = (release.assets || []).find(a => /\.apk$/i.test(a.name));
    return {
        available: !!apk && compareVersions(version, current) > 0,
        current,
        version,
        notes: (release.body || "").trim(),
        url: apk?.browser_download_url ?? null,
        size: apk?.size ?? 0,
    };
}

/**
 * Baixa o APK da atualização e abre o instalador do Android.
 * `onProgress(fração 0..1)` acompanha o download.
 */
export async function downloadAndInstall(update, onProgress) {
    if (!UPDATES_SUPPORTED || !update?.url) throw new Error("atualização indisponível");

    // Apaga APKs baixados antes (versões antigas ou download interrompido)
    const cached = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory).catch(() => []);
    await Promise.all(cached
        .filter(name => /^CasualNoMore-.*\.apk$/.test(name))
        .map(name => FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${name}`, { idempotent: true })));

    const target = `${FileSystem.cacheDirectory}CasualNoMore-${update.version}.apk`;

    const download = FileSystem.createDownloadResumable(update.url, target, {}, (p) => {
        const total = p.totalBytesExpectedToWrite || update.size;
        if (total > 0) onProgress?.(Math.min(1, p.totalBytesWritten / total));
    });
    const result = await download.downloadAsync();
    if (!result?.uri || (result.status && result.status >= 400)) {
        throw new Error(`download falhou (HTTP ${result?.status})`);
    }

    // O instalador precisa de um content:// com permissão de leitura
    const contentUri = await FileSystem.getContentUriAsync(result.uri);
    await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: "application/vnd.android.package-archive",
    });
}
