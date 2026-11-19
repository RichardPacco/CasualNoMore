import { getUserCompletionProgress, getUserRecentlyPlayedGames } from "@/src/api/retroachievements";
import { deleteRaGamesNotPresent, getAllRaGames, getRaGame, saveRaProgressBatch, saveRaRecentlyPlayed, toggleRaPin } from "@/src/database/raDb";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { showToast } from "@/src/utils/toast";
import { useCallback, useEffect, useRef, useState } from "react";

// Consoles que não são jogos (Hubs = coleções do site, Events = eventos)
const NON_GAME_CONSOLES = new Set([100, 101]);

/**
 * Biblioteca do RetroAchievements: mostra o que está no banco e sincroniza
 * com o RA. Diferente da Steam, a biblioteca inteira (com o progresso de cada
 * jogo) vem em 1 a 3 chamadas (GetUserCompletionProgress, 500 jogos por
 * página), então não há fila por jogo nem turbo. Depois busca os 50 jogos
 * jogados mais recentemente para saber quando cada um foi jogado.
 * As conquistas de cada jogo são buscadas só ao abrir o jogo (etapa 3).
 *
 * `account` null = RA não conectado: lista vazia, nada é buscado.
 */
export default function useRaLibrary(account) {
    const { t: tr } = useLanguage();
    const ulid = account?.ulid ?? null;

    // tradução por ref: trocar o idioma não deve sincronizar de novo (o RA só
    // tem inglês), e `reload` não pode depender de `tr`
    const trRef = useRef(tr);
    trRef.current = tr;

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(!!ulid);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState(false);

    // geração da sincronização: uma nova (ou a troca de conta) faz a antiga
    // parar de escrever na tela
    const genRef = useRef(0);

    /**
     * Sincroniza a biblioteca com o RA. Retorna true se terminou.
     * `silent` sem toast de erro.
     */
    const reload = useCallback(async ({ silent = true } = {}) => {
        if (!ulid) return false;
        const gen = ++genRef.current;
        const stale = () => genRef.current !== gen;
        setSyncing(true);

        try {
            // 1️⃣ O que já está no banco aparece na hora
            const cached = await getAllRaGames(ulid);
            if (stale()) return false;
            if (cached.length > 0) {
                setRows(cached);
                setLoading(false);
            }

            // 2️⃣ Biblioteca e progresso (todas as páginas), pelo ULID
            const { results } = await getUserCompletionProgress(ulid);
            if (stale()) return false;
            const games = results.filter(r => !NON_GAME_CONSOLES.has(Number(r.ConsoleID)));
            await saveRaProgressBatch(ulid, games);
            if (stale()) return false;

            // 3️⃣ Quando cada jogo recente foi jogado + imagens grandes. Se
            // falhar, a biblioteca continua valendo (usa a data da última conquista).
            try {
                const recent = await getUserRecentlyPlayedGames(ulid, 50);
                if (stale()) return false;
                await saveRaRecentlyPlayed(ulid, recent);
            } catch (err) {
                console.warn("[RaLibrary] recently played falhou", err?.message);
            }

            // 4️⃣ Tira do banco o que não veio mais (a lista veio inteira)
            await deleteRaGamesNotPresent(ulid, games.map(g => Number(g.GameID)));
            if (stale()) return false;

            setRows(await getAllRaGames(ulid));
            setError(false);
            return true;
        } catch (err) {
            console.warn("[RaLibrary] sincronização falhou", err?.message);
            if (!stale()) {
                // "key" = key inválida/revogada (401); true = outro erro
                setError(err?.status === 401 ? "key" : true);
                if (!silent) showToast(trRef.current("raConnectionError"), "error");
            }
            return false;
        } finally {
            if (!stale()) {
                setSyncing(false);
                setLoading(false);
            }
        }
    }, [ulid]);

    /** Sincronização disparada pelo usuário (puxar para atualizar): com toast de erro. */
    const manualReload = useCallback(() => reload({ silent: false }), [reload]);

    /** Relê um jogo do banco (ex.: ao voltar da tela do jogo). */
    const reloadGame = useCallback(async (gameId) => {
        if (!ulid) return;
        const row = await getRaGame(ulid, gameId);
        if (!row) return;
        setRows(prev => prev.map(g => g.gameId === gameId ? row : g));
    }, [ulid]);

    /** Fixa/desfixa um jogo. */
    const togglePin = useCallback(async (gameId) => {
        if (!ulid) return;
        const pinned = await toggleRaPin(ulid, gameId);
        setRows(prev => prev.map(g => g.gameId === gameId ? { ...g, pinned } : g));
        showToast(pinned ? tr("gamePinned") : tr("gameUnpinned"), "success");
    }, [ulid, tr]);

    /**
     * Toque longo no card / botão de atualizar: no RA sincronizar a biblioteca
     * inteira custa poucas chamadas, então atualiza tudo.
     */
    const refreshGame = useCallback(async () => {
        showToast(tr("gameRefreshing"), "info");
        const ok = await reload({ silent: false });
        if (ok) showToast(tr("gameRefreshed"), "success");
    }, [reload, tr]);

    useEffect(() => {
        if (!ulid) {
            genRef.current++;
            setRows([]);
            setLoading(false);
            setSyncing(false);
            return;
        }
        setLoading(true);
        reload();
        return () => {
            // troca de conta ou unmount: a sincronização antiga para de escrever
            // eslint-disable-next-line react-hooks/exhaustive-deps -- incremento intencional do counter
            genRef.current++;
        };
    }, [ulid, reload]);

    return {
        rows,
        loading,
        syncing,
        error,
        reload: manualReload,
        refreshRecent: refreshGame,
        refreshGame,
        togglePin,
        reloadGame,
    };
}
