/**
 * Duração compacta a partir de minutos: "40 min", "46 h", "46 h 10 min".
 */
export function formatDuration(minutes) {
    const m = Math.max(0, Math.round(Number(minutes) || 0));
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest > 0 ? `${h} h ${rest} min` : `${h} h`;
}

/**
 * Tempo total de jogo no formato do card da biblioteca (o mesmo de antes do
 * redesign): "46 horas 10 minutos", "40 minutos", "Tempo de jogo oculto" ou
 * "Nunca jogado". `tr` = função de tradução.
 */
export function totalPlaytimeText(game, tr) {
    if (game?.playtimeHidden) return tr("playtimeHidden");
    const total = game?.playtime_forever || 0;
    if (total <= 0) return tr("playtimeNeverPlayed");
    if (total < 60) return tr("playtimeMinutes", { minutes: total });
    return tr("playtimeHours", { hours: Math.floor(total / 60), minutes: total % 60 });
}

/**
 * Linha de tempo de jogo de um card: "46 h no total · 6 h em 2 semanas",
 * "Tempo de jogo oculto" ou "Nunca jogado". `tr` = função de tradução.
 */
export function playtimeLine(game, tr) {
    if (game?.playtimeHidden) return tr("playtimeHidden");
    const total = game?.playtime_forever || 0;
    if (total <= 0) return tr("playtimeNeverPlayed");

    const recent = game?.playtime_2weeks || 0;
    const totalText = tr("playtimeTotal", { time: formatDuration(total) });
    return recent > 0
        ? `${totalText} · ${tr("playtimeRecent", { time: formatDuration(recent) })}`
        : totalText;
}
