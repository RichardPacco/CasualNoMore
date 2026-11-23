import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Lista "Quero jogar" do RetroAchievements guardada no aparelho, por conta.
 * A sincronização da biblioteca (useRaLibrary) busca e grava; a tela
 * "Quero jogar" (RaWantToPlay) lê daqui e atualiza ao puxar para baixo.
 * Itens como vêm da API: ID, Title, ImageIcon, ConsoleID, ConsoleName,
 * PointsTotal, AchievementsPublished.
 */

const keyFor = (ulid) => `@ra_want_to_play_${ulid}`;

/** Lista salva da conta (vazia se não houver ou der erro). */
export async function loadWantToPlay(ulid) {
    if (!ulid) return [];
    try {
        return JSON.parse((await AsyncStorage.getItem(keyFor(ulid))) || "[]");
    } catch {
        return [];
    }
}

/** Grava a lista da conta. */
export async function saveWantToPlay(ulid, list) {
    if (!ulid) return;
    try {
        await AsyncStorage.setItem(keyFor(ulid), JSON.stringify(list || []));
    } catch (err) {
        console.warn("[wantToPlay] erro ao salvar", err?.message);
    }
}

