import { useEffect, useState } from "react";

/**
 * Hook que gerencia o fallback de imagens: `stage` é o índice da URL atual
 * numa lista de candidatas; a cada erro de carregamento avança para a próxima.
 * `stage >= maxStage` significa "desistiu" (todas falharam: use o placeholder).
 * Retorna `stage`, `useFallback` (já passou da primeira) e `onError`.
 * O estado é reiniciado sempre que `resetKey` muda.
 * `maxStage` padrão = 2 (primária + fallback), o comportamento antigo.
 */
export function useImageCdnFallback(resetKey, maxStage = 2) {
    const [stage, setStage] = useState(0);

    useEffect(() => {
        setStage(0);
    }, [resetKey]);

    const onError = () => setStage(s => Math.min(s + 1, maxStage));

    return { stage, useFallback: stage >= 1, onError };
}
