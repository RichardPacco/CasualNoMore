let overlayOpen = false;
const listeners = new Set();

export function setOverlayOpen(open) {
    if (overlayOpen === open) return;
    overlayOpen = open;
    listeners.forEach((cb) => cb(open));
}

export function getOverlayOpen() {
    return overlayOpen;
}

export function subscribeOverlay(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
}
