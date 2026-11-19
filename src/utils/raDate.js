/**
 * Converte uma data do RetroAchievements em milissegundos (ou null).
 * A API usa dois formatos: ISO com fuso ("2023-10-27T02:52:34+00:00") e
 * "YYYY-MM-DD HH:MM:SS" sem fuso, que é UTC. Datas só com o dia
 * ("1981-01-01") também funcionam.
 */
export function parseRaDate(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") return value;

    const text = String(value).trim();
    const plain = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(text);
    if (plain) {
        const [, y, mo, d, h, mi, s] = plain.map(Number);
        return Date.UTC(y, mo - 1, d, h, mi, s);
    }

    const ms = Date.parse(text);
    return Number.isNaN(ms) ? null : ms;
}
