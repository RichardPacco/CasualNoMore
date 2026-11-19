import { getOwnedGames, GetSchemaForGame, getStoreAssets } from "@/src/api/steam";
import { deleteGamesNotOwned, getAllGames, getGame, getPinnedAppIds, parseJson, saveGame, saveGamesBatch, togglePin as dbTogglePin } from "@/src/database/db";
import { getLanguageStore } from "@/src/i18n/langStore";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { computeProgress, fetchAndMergeAchievements } from "@/src/utils/achievements";
import { showToast } from "@/src/utils/toast";
import { useCallback, useEffect, useRef, useState } from "react";

// Jogos enriquecidos ao mesmo tempo na sincronização (cada um faz ~4 chamadas
// à Steam). O turbo não trata erro 429: se a Steam limitar, os jogos que
// falharem ficam pendentes e são buscados de novo na próxima sincronização.
const CONCURRENCY_NORMAL = 5;
const CONCURRENCY_TURBO = 20;

// A cada quantos jogos a lista é re-renderizada e gravada durante a carga
const UI_BATCH = 10;

/**
 * Biblioteca da Steam: carrega os jogos do banco, sincroniza com a Steam
 * (schema, conquistas e progresso de cada jogo, com cache e lotes) e mantém
 * a lista em memória. As linhas devolvidas (`rows`) são as do banco;
 * a conversão para o formato comum fica no useLibrary.
 *
 * `steamId` null = Steam não conectada: lista vazia, nada é buscado.
 */
export default function useSteamLibrary(steamId) {
    const { t: tr, language } = useLanguage();

    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(!!steamId);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [refreshingRecent, setRefreshingRecent] = useState(false);

    // Turbo: mais jogos ao mesmo tempo na sincronização. O state é para o
    // botão; o ref é lido pelo laço de carga a cada rodada.
    const [turbo, setTurbo] = useState(false);
    const turboRef = useRef(false);
    const toggleTurbo = useCallback(() => {
        turboRef.current = !turboRef.current;
        setTurbo(turboRef.current);
    }, []);

    // geração da carga atual: quando uma nova carga começa (ou o componente
    // desmonta), o número muda e execuções antigas param de escrever na UI/DB.
    // Um simples boolean não serve — a nova carga rearmaria o flag e a execução
    // antiga continuaria rodando em paralelo (progresso e lista "bugados").
    const loadGenRef = useRef(0);

    // Lista de trabalho da carga em andamento ({ gamesList, gameMap }), ou null
    // quando nenhuma carga está rodando. Permite que outras partes da tela
    // (ex.: volta da GameScreen) atualizem a cópia que a carga vai gravar, e
    // que o refresh de recentes saiba que não deve rodar em paralelo.
    const activeLoadRef = useRef(null);

    // Trava síncrona do refresh de recentes (o state demora um render para
    // atualizar, então dois toques rápidos passariam pela checagem do state).
    const refreshingRecentRef = useRef(false);

    // Sempre a lista mais recente, para callbacks que rodam depois de awaits.
    const gamesRef = useRef(games);
    gamesRef.current = games;

    /**
     * Completa um jogo com toda a informação disponível:
     * schema, conquistas (com progresso) e detalhes da loja.
     * Só busca o que ainda não foi cacheado. Se uma busca falhar,
     * mantém o dado antigo (fallback) e deixa o status "pending"
     * para tentar de novo na próxima carga.
     */
    const enrichGame = useCallback(async (baseGame, cached, force = false, pinnedIds = null) => {
        const lang = getLanguageStore();
        const stale = force || (cached ? cached.lang !== lang : false);
        const cachedSchema = parseJson(cached?.schema);
        const cachedAchievements = parseJson(cached?.achievements);
        const cachedDetails = parseJson(cached?.details);

        let schema = stale ? null : (cachedSchema ?? null);
        let schemaStatus = stale ? "pending" : (cached?.schemaStatus || "pending");
        let achievements = stale ? null : (cachedAchievements ?? null);
        let achievementsStatus = stale ? "pending" : (cached?.achievementsStatus || "pending");
        // Detalhes da loja: em troca de idioma ou long-press (stale/force) são
        // zerados para serem re-adquiridos sob demanda pelo GameDetailsTab.
        let details = stale ? null : (cachedDetails ?? null);
        let detailsStatus = stale ? "pending" : (cached?.detailsStatus || "pending");

        if (schemaStatus === "pending") {
            try {
                schema = await GetSchemaForGame(baseGame.appid, steamId);
                schemaStatus = "done";
            } catch (err) {
                console.error("[SteamLibrary] Erro schema", baseGame.appid, err);
                schema = cachedSchema ?? null;
                schemaStatus = "pending";
            }
        }

        if (achievementsStatus === "pending") {
            // Sem schema a lista de conquistas não é montável (o merge usa o schema
            // para os nomes). Se o schema falhou, mantém o cache e tenta depois.
            if (schemaStatus === "done") {
                try {
                    achievements = await fetchAndMergeAchievements(baseGame.appid, steamId, schema);
                    achievementsStatus = "done";
                } catch (err) {
                    console.error("[SteamLibrary] Erro achievements", baseGame.appid, err);
                    achievements = cachedAchievements ?? null;
                    achievementsStatus = "pending";
                }
            } else {
                achievements = cachedAchievements ?? null;
                achievementsStatus = "pending";
            }
        }

        // Detalhes da loja são buscados sob demanda no GameDetailsTab e persistidos no DB.
        // Steam mascara tempo de jogo privado como 0 (não omite o campo). Se o jogo tem
        // conquistas desbloqueadas ele foi jogado — logo playtime 0 significa tempo privado.
        const rawPlaytime = baseGame.playtime_forever || 0;
        const unlockedCount = (achievements || []).filter(a => a.achieved).length;
        const playtimeHidden = rawPlaytime === 0 && unlockedCount > 0;
        const { unlocked, total } = computeProgress(achievements || []);
        return {
            ...baseGame,
            playtime_forever: rawPlaytime,
            playtime_2weeks: baseGame.playtime_2weeks || 0,
            playtimeHidden,
            unlocked, totalAchievements: total,
            schema, schemaStatus, achievements, achievementsStatus, details, detailsStatus,
            // idioma dos detalhes da loja: zerado junto com eles quando stale
            detailsLang: details ? (cached?.detailsLang ?? null) : null,
            // URLs das imagens da loja (com hash): as recém-buscadas vêm no
            // baseGame (getStoreAssets); senão mantém as do cache.
            capsuleUrl: baseGame.capsuleUrl ?? cached?.capsuleUrl ?? null,
            headerUrl: baseGame.headerUrl ?? cached?.headerUrl ?? null,
            lang,
            pinned: cached?.pinned || (pinnedIds?.has(baseGame.appid) ? 1 : 0),
        };
    }, [steamId]);

    /**
     * Força refetch completo de um jogo (playtime, schema, conquistas).
     * `existing` (jogo atual da lista) serve de fallback se algo falhar.
     */
    const forceRefreshGame = useCallback(async (baseGame, existing, pinnedIds = null, isStale = () => false) => {
        const fresh = await enrichGame(baseGame, existing, true, pinnedIds);
        // Descarta o resultado se o refresh foi substituído durante a busca
        if (isStale()) return;

        setGames(prev => prev.map(g => g.appid === fresh.appid ? fresh : g));
        await saveGame(steamId, fresh);
    }, [steamId, enrichGame]);

    /**
     * Atualiza um único jogo por completo (toque longo no card).
     */
    const refreshGame = useCallback(async (appid) => {
        showToast(tr("gameRefreshing"), "info");
        try {
            const owned = await getOwnedGames(steamId);
            const ownedGame = owned?.games?.find(g => g.appid === appid);
            if (!ownedGame) throw new Error("game not in owned list");

            // Rebusca também as URLs das imagens (o hash muda se a arte mudar)
            const assets = await getStoreAssets([appid]);
            const baseGame = { ...ownedGame, ...assets.get(appid) };

            const existing = gamesRef.current.find(g => g.appid === appid);
            await forceRefreshGame(baseGame, existing);
            showToast(tr("gameRefreshed"), "success");
        } catch (err) {
            console.error("[SteamLibrary] refreshGame failed", appid, err);
            showToast(tr("gameRefreshFailed"), "error");
        }
    }, [steamId, forceRefreshGame, tr]);

    /**
     * Alterna o estado pinned de um jogo (fixar/desfixar).
     */
    const togglePin = useCallback(async (appid) => {
        const newPinned = await dbTogglePin(steamId, appid);
        setGames(prev => prev.map(g =>
            g.appid === appid ? { ...g, pinned: newPinned } : g
        ));
        showToast(newPinned ? tr("gamePinned") : tr("gameUnpinned"), "success");
    }, [steamId, tr]);

    /**
     * Relê um jogo do banco (ex.: ao voltar da GameScreen, que pode ter salvo
     * conquistas e detalhes novos).
     */
    const reloadGame = useCallback(async (appid) => {
        if (!steamId) return;
        const row = await getGame(steamId, appid);
        if (!row) return;
        // Se uma carga está rodando, atualiza também a cópia dela; senão o
        // próximo lote da carga traria de volta a versão antiga do jogo.
        const active = activeLoadRef.current;
        const idx = active?.gameMap.get(appid);
        if (idx !== undefined) active.gamesList[idx] = row;
        setGames(prev => prev.map(g => g.appid === appid ? row : g));
    }, [steamId]);

    /**
     * Atualiza por completo os jogos jogados nas últimas 2 semanas
     * (playtime_2weeks > 0) e todos os jogos fixados.
     * `silent` sem toasts (disparo automático ao abrir a lista).
     */
    const refreshRecent = useCallback(async (silent = false) => {
        if (!steamId) return;
        // Nunca roda junto com a carga completa (as duas gravariam os mesmos
        // jogos e a última a terminar venceria) nem duas vezes ao mesmo tempo.
        if (refreshingRecentRef.current || activeLoadRef.current) return;
        refreshingRecentRef.current = true;
        setRefreshingRecent(true);

        // Mesma geração da carga: se uma nova carga começar (pull-to-refresh,
        // troca de idioma) ou a tela desmontar, este refresh para de escrever.
        const gen = loadGenRef.current;
        const isStale = () => loadGenRef.current !== gen;

        if (!silent) showToast(tr("gameRecentRefresh"), "info");
        try {
            const owned = await getOwnedGames(steamId);
            if (isStale()) return;
            if (!owned?.games) throw new Error("no games");

            const pinnedIds = new Set(await getPinnedAppIds(steamId));
            if (isStale()) return;

            const toRefresh = owned.games.filter(g =>
                (g.playtime_2weeks || 0) > 0 || pinnedIds.has(g.appid)
            );
            if (toRefresh.length === 0) {
                if (!silent) showToast(tr("noRecentGames"), "info");
                return;
            }

            // Rebusca as URLs das imagens desses jogos (o hash muda se a arte mudar)
            const assets = await getStoreAssets(toRefresh.map(g => g.appid));
            if (isStale()) return;

            for (const ownedGame of toRefresh) {
                if (isStale()) return;
                const baseGame = { ...ownedGame, ...assets.get(ownedGame.appid) };
                const existing = gamesRef.current.find(g => g.appid === baseGame.appid);
                await forceRefreshGame(baseGame, existing, pinnedIds, isStale);
            }

            if (!silent && !isStale()) showToast(tr("gameRecentRefreshed"), "success");
        } catch (err) {
            console.error("[SteamLibrary] refreshRecent failed", err);
            if (!silent && !isStale()) showToast(tr("gameRefreshFailed"), "error");
        } finally {
            refreshingRecentRef.current = false;
            setRefreshingRecent(false);
        }
    }, [steamId, forceRefreshGame, tr]);

    // Ref para disparar o refresh de recentes ao abrir a lista sem colocar
    // refreshRecent nas dependências do useEffect de carga.
    const refreshRecentRef = useRef(null);
    refreshRecentRef.current = refreshRecent;

    /**
     * Carrega os jogos do banco e sincroniza com a Steam, enriquecendo
     * cada jogo com schema, conquistas e progresso (com cache e lotes).
     * Retorna true se a sincronização terminou.
     */
    const reload = useCallback(async () => {
        if (!steamId) return false;
        const gen = ++loadGenRef.current;

        // Map appid -> índice na lista: lookups O(1) no lugar do findIndex
        const gameMap = new Map();
        const gamesList = [];
        const work = { gamesList, gameMap };
        activeLoadRef.current = work;

        try {
            // 1️⃣ Load games from DB
            const cachedGames = await getAllGames(steamId);
            if (loadGenRef.current !== gen) return false;

            for (const g of cachedGames) {
                if (!gameMap.has(g.appid)) {
                    gameMap.set(g.appid, gamesList.length);
                    gamesList.push(g);
                }
            }

            if (gamesList.length > 0) {
                setGames(gamesList);
                setProgress({ current: gamesList.length, total: gamesList.length });
                setLoading(false);
            }

            // 2️⃣ Fetch fresh games from Steam
            const fresh = await getOwnedGames(steamId);
            if (loadGenRef.current !== gen) return false;
            if (!fresh?.games) {
                if (gamesList.length === 0) setLoading(false);
                return false;
            }

            const total = fresh.games.length;
            setProgress({ current: gamesList.length, total });

            // Processa primeiro os jogos mais relevantes (mais jogados recentemente)
            // para que o topo da lista ganhe dados (progresso) antes do resto
            const sortedFresh = [...fresh.games].sort((a, b) => {
                const a2 = a.playtime_2weeks || 0;
                const b2 = b.playtime_2weeks || 0;
                if (b2 !== a2) return b2 - a2;
                const a0 = a.playtime_forever || 0;
                const b0 = b.playtime_forever || 0;
                if (b0 !== a0) return b0 - a0;
                return (a.name || "").localeCompare(b.name || "");
            });

            // URLs das imagens da loja só para quem ainda não tem no cache
            // (jogos novos na conta ou nunca buscados): em lotes de 100 por chamada.
            const missingAssets = sortedFresh
                .filter(g => {
                    const idx = gameMap.get(g.appid);
                    return !(idx !== undefined && gamesList[idx].capsuleUrl);
                })
                .map(g => g.appid);
            const assets = await getStoreAssets(missingAssets);
            if (loadGenRef.current !== gen) return false;
            const freshGames = sortedFresh.map(g => ({ ...g, ...assets.get(g.appid) }));

            // Enriquecimento em paralelo (poucos por vez para não estourar a API)
            // e atualização da UI + persistência em lotes (reduz re-renders e I/O).
            let batchToSave = [];
            let updatedAny = false;

            for (let i = 0; i < freshGames.length;) {
                if (loadGenRef.current !== gen) return false;

                // Quantos jogos ao mesmo tempo: lido a cada rodada, então
                // ligar/desligar o turbo vale na hora, no meio da sincronização.
                const step = turboRef.current ? CONCURRENCY_TURBO : CONCURRENCY_NORMAL;
                const next = i + step;
                const chunk = freshGames.slice(i, next);
                const enrichedChunk = await Promise.all(chunk.map(baseGame => {
                    const idx = gameMap.get(baseGame.appid);
                    const cachedEntry = idx !== undefined ? gamesList[idx] : null;
                    return enrichGame(baseGame, cachedEntry);
                }));
                if (loadGenRef.current !== gen) return false;

                for (const enriched of enrichedChunk) {
                    const idx = gameMap.get(enriched.appid);

                    if (idx !== undefined) {
                        const prev = gamesList[idx];
                        const changed = prev.playtime_forever !== enriched.playtime_forever
                            || prev.playtime_2weeks !== enriched.playtime_2weeks
                            || !!prev.playtimeHidden !== !!enriched.playtimeHidden
                            || prev.schemaStatus !== enriched.schemaStatus
                            || prev.achievementsStatus !== enriched.achievementsStatus
                            || prev.detailsStatus !== enriched.detailsStatus
                            || prev.lang !== enriched.lang
                            || prev.capsuleUrl !== enriched.capsuleUrl
                            || prev.headerUrl !== enriched.headerUrl;
                        if (!changed) continue;
                        gamesList[idx] = enriched;
                    } else {
                        gameMap.set(enriched.appid, gamesList.length);
                        gamesList.push(enriched);
                    }

                    updatedAny = true;
                    batchToSave.push(enriched);
                }

                setProgress({ current: Math.min(next, total), total });

                // Atualiza a lista e persiste em lotes, não a cada jogo
                if (updatedAny && (batchToSave.length >= UI_BATCH || next >= freshGames.length)) {
                    setGames([...gamesList]);
                    await saveGamesBatch(steamId, batchToSave);
                    batchToSave = [];
                }

                i = next;
            }

            if (loadGenRef.current !== gen) return false;

            // 3️⃣ Remove do cache (e da tela) os jogos que saíram da biblioteca.
            // Só chega aqui com a lista da Steam em mãos: lista privada ou erro
            // retornam antes, então o cache nunca é apagado por engano.
            const removed = await deleteGamesNotOwned(steamId, fresh.games.map(g => g.appid));
            if (loadGenRef.current !== gen) return false;
            if (removed.length > 0) {
                const removedSet = new Set(removed);
                setGames(prev => prev.filter(g => !removedSet.has(g.appid)));
            }

            // Finish sync: clear progress header even if nothing was updated
            setProgress({ current: total, total });
            setLoading(false);
            return true;
        } catch (err) {
            console.error("[SteamLibrary] reload failed", err);
            setLoading(false);
            return false;
        } finally {
            // Só libera se ninguém tiver iniciado uma carga nova nesse meio-tempo
            if (activeLoadRef.current === work) activeLoadRef.current = null;
        }
    }, [steamId, enrichGame]);

    useEffect(() => {
        if (!steamId) {
            // Steam desconectada: nada para mostrar nem carregar
            setGames([]);
            setProgress({ current: 0, total: 0 });
            setLoading(false);
            return;
        }
        // Steam conectada agora (ex.: pelo Perfil): mostra a primeira carga
        setLoading(true);
        // Sempre que a lista abre, força refresh completo dos jogos recentes
        // e fixados — mas só DEPOIS da carga completa terminar, para as duas
        // não buscarem e gravarem os mesmos jogos em paralelo. Se a carga foi
        // substituída (troca de idioma, unmount), o refresh não roda.
        reload().then(completed => {
            if (completed) refreshRecentRef.current?.(true);
        });
        return () => {
            // Cancela a carga e o refresh de recentes em andamento (troca de
            // idioma ou unmount): as execuções antigas detectam a geração nova
            // e param de escrever.
            // eslint-disable-next-line react-hooks/exhaustive-deps -- incremento intencional do counter
            loadGenRef.current++;
        };
    }, [steamId, reload, language]);

    return {
        rows: games,
        loading,
        progress,
        syncing: progress.current < progress.total,
        refreshingRecent,
        turbo,
        toggleTurbo,
        reload,
        refreshRecent,
        refreshGame,
        togglePin,
        reloadGame,
    };
}
