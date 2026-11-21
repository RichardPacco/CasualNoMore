import { getGameInfoAndUserProgress } from "@/src/api/retroachievements";
import { saveRaGameInfo } from "@/src/database/raDb";
import { computeProgress } from "@/src/utils/achievements";
import { useCallback, useEffect, useRef, useState } from "react";
import { toAchievements, toDetails } from "./adapter";

/**
 * Dados de um jogo do RetroAchievements para a tela do jogo: conquistas
 * (formato comum), detalhes e a linha atualizada do banco. Com o jogo já
 * salvo, usa só o banco: busca GetGameInfoAndUserProgress apenas na primeira
 * vez que o jogo é aberto ou quando o usuário atualiza (`refresh`), gravando
 * o resultado no banco.
 *
 * Uma busca serve às duas abas (Conquistas e Detalhes): a GameScreen chama
 * este hook e repassa os dados. `row` null = não é jogo do RA (não faz nada).
 */
export default function useRaGame(row, account) {
    const ulid = account?.ulid ?? null;
    const gameId = row?.gameId ?? null;

    const [current, setCurrent] = useState(row);
    const [achievements, setAchievements] = useState(row?.achievements || []);
    const [loading, setLoading] = useState(!!row && !row?.achievements);
    const [error, setError] = useState(false);

    // a busca em andamento é descartada se o jogo mudar ou a tela fechar
    const genRef = useRef(0);

    /** Busca o jogo no RA e grava. Retorna as conquistas (ou null se falhar). */
    const fetchGame = useCallback(async () => {
        if (!ulid || !gameId) return null;
        const gen = ++genRef.current;
        try {
            const info = await getGameInfoAndUserProgress(ulid, gameId);
            if (genRef.current !== gen) return null;
            const list = toAchievements(info);
            const saved = await saveRaGameInfo(ulid, gameId, {
                achievements: list,
                details: toDetails(info),
                info,
            });
            if (genRef.current !== gen) return null;
            setAchievements(list);
            if (saved) setCurrent(saved);
            setError(false);
            return list;
        } catch (err) {
            console.warn("[RaGame] busca falhou", gameId, err?.message);
            if (genRef.current === gen) setError(true);
            return null;
        } finally {
            if (genRef.current === gen) setLoading(false);
        }
    }, [ulid, gameId]);

    useEffect(() => {
        if (!row) return;
        setCurrent(row);
        setAchievements(row.achievements || []);
        // Já buscado antes: fica com o banco (atualizar é manual)
        if (row.achievementsStatus === "done") {
            setLoading(false);
            return;
        }
        setLoading(true);
        fetchGame();
        return () => {
            // jogo trocou ou a tela fechou: a busca em andamento para de escrever
            // eslint-disable-next-line react-hooks/exhaustive-deps -- incremento intencional do counter
            genRef.current++;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando o jogo muda
    }, [gameId, ulid]);

    const { unlocked, total, percent } = computeProgress(achievements);
    const points = achievements.reduce((sum, a) => sum + (a.points || 0), 0);
    const pointsEarned = achievements.reduce((sum, a) => sum + (a.achieved ? a.points || 0 : 0), 0);

    return {
        row: current,
        details: current?.details ?? null,
        mergedCheevos: achievements,
        loading,
        error,
        unlocked,
        total,
        percent,
        points,
        pointsEarned,
        refresh: fetchGame,
    };
}
