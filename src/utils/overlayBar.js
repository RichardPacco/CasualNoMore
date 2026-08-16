let overlayOpen = false;
const listeners = new Set();

/** Define se o overlay está aberto e notifica os inscritos. */
export function setOverlayOpen(open) {
    if (overlayOpen === open) return;
    overlayOpen = open;
    listeners.forEach((cb) => cb(open));
}

/** Retorna se o overlay está aberto. */
export function getOverlayOpen() {
    return overlayOpen;
}

/** Inscreve um callback nas mudanças do overlay e retorna a função de remoção. */
export function subscribeOverlay(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
}
