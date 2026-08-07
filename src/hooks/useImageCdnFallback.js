import { useEffect, useState } from "react";

/**
 * Manages a two-stage CDN fallback: stage 0 tries the primary URL, stage 1
 * switches to the fallback URL after a load error. Stage 2 signals "given up"
 * (callers can swap in a placeholder). State resets whenever `resetKey`
 * changes (e.g. when the appid changes).
 */
export function useImageCdnFallback(resetKey) {
    const [stage, setStage] = useState(0);

    useEffect(() => {
        setStage(0);
    }, [resetKey]);

    const onError = () => setStage(s => Math.min(s + 1, 2));

    return { stage, useFallback: stage >= 1, onError };
}
