import { GetSchemaForGame } from "@/src/api/steam";
import { AuthContext } from "@/src/context/AuthContext";
import { parseJson } from "@/src/database/db";
import { getLanguageStore } from "@/src/i18n/langStore";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { computeProgress, fetchAndMergeAchievements } from "@/src/utils/achievements";
import { useContext, useEffect, useMemo, useState } from "react";

/**
 * Hook que carrega e mescla as conquistas de um jogo (cache, schema e API),
 * retornando `mergedCheevos`, `loading` e o progresso (desbloqueadas/total/%).
 */
export default function useAchievements(game) {
    const { steamId } = useContext(AuthContext);
    const { language } = useLanguage();

    const appid = game?.appid;
    const gameName = game?.name;
    const gameSchema = useMemo(() => parseJson(game?.schema), [game?.schema]);
    const cachedAchievements = useMemo(() => parseJson(game?.achievements), [game?.achievements]);
    const stale = cachedAchievements && game?.lang !== getLanguageStore();

    const [mergedCheevos, setMergedCheevos] = useState(!stale ? (cachedAchievements || []) : []);
    const [loading, setLoading] = useState(!cachedAchievements || stale);

    useEffect(() => {
        if (!appid) return;

        // Já temos tudo cacheado no idioma atual, não precisa buscar de novo
        if (cachedAchievements && !stale) {
            setMergedCheevos(cachedAchievements);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);

        /** Busca schema e conquistas da API e mescla os resultados. */
        async function fetchAll() {
            try {
                // Quando o idioma mudou, o schema cacheado está no idioma antigo:
                // busca um schema novo no idioma atual antes de mesclar.
                let schema = gameSchema;
                if (stale || !schema) {
                    schema = await GetSchemaForGame(appid, steamId).catch(() => null);
                }
                const merged = await fetchAndMergeAchievements(appid, steamId, schema || []);
                if (!cancelled) setMergedCheevos(merged);
            } catch (err) {
                console.error("Error fetching achievements for", gameName, err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchAll();
        return () => {
            cancelled = true;
        };
    }, [appid, gameName, gameSchema, cachedAchievements, steamId, stale, language]);

    const { unlocked, total, percent } = computeProgress(mergedCheevos);

    return { mergedCheevos, loading, unlocked, total, percent };
}
