import { COLORS } from "./colors";

// Semantic theme tokens. Class tokens go into `className`, hex tokens into
// inline `style` props. Class strings are plain literals so NativeWind
// generates them via the ./src/** content glob.
//
// Redesign "Arcade Night": o app tem um tema único, escuro. `theme.light`
// continua existindo só como apelido do escuro, para as telas que ainda
// escolhem o tema pelo sistema funcionarem sem mudança até serem refeitas.
const dark = {
    pageBg: "bg-bg",
    cardBg: "bg-surface",
    elevatedCardBg: "bg-surface",
    cardBorder: "border-line-subtle",
    coverBg: "bg-surface-2",
    avatarBorder: "border-bg",
    progressTrack: "bg-line",
    textPrimary: "text-ink",
    textSecondary: "text-muted",
    textHeader: "text-ink",
    textInline: COLORS.text,
    textInlineSecondary: COLORS.textMuted,
    surface: COLORS.surface,
    surfaceAlt: COLORS.bg,
    borderInline: COLORS.border,
    placeholderText: COLORS.textMuted,
    inputBg: "bg-surface",
    inputBorder: "border-line",
    inputText: "text-ink",
};

export const theme = {
    dark,
    light: dark,
};

/** Tokens do tema (sempre o escuro). `isDark` fica true para o código existente. */
export function useTheme() {
    return { isDark: true, ...dark };
}
