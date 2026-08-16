import { useEffect, useState } from "react";

/**
 * Hook que gerencia fallback de CDN em dois estágios: tenta a URL primária e,
 * em caso de erro de carregamento, troca para a URL de fallback (estágio 2
 * significa "desistiu"). Retorna `stage`, `useFallback` e `onError`.
 * O estado é reiniciado sempre que `resetKey` muda.
 */
export function useImageCdnFallback(resetKey) {
    const [stage, setStage] = useState(0);

    useEffect(() => {
        setStage(0);
    }, [resetKey]);

    const onError = () => setStage(s => Math.min(s + 1, 2));

    return { stage, useFallback: stage >= 1, onError };
}
