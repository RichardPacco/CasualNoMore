// Central color palette — change a color here and it updates everywhere.
// Keep this file CommonJS (module.exports) so both tailwind.config.js
// (Node require) and app files (Babel import interop) can consume it.
//
// Paleta "Arcade Night" (redesign): tema único escuro.

module.exports = {
    COLORS: {
        // --- base ---
        bg: "#0A0E15",          // fundo das telas
        surface: "#121823",     // cards, linhas, campos
        surface2: "#1A2230",    // superfície elevada (dentro de cards, sheets)
        tabBar: "#161D29",      // tab bar flutuante
        border: "#253042",      // bordas e trilho de progresso
        borderSubtle: "#1F2836",// bordas discretas

        // --- texto ---
        text: "#E8EEF6",        // texto principal
        textSoft: "#C9D3E0",    // texto de corpo em cards
        textMuted: "#8B97A8",   // texto de apoio (4.5:1 sobre surface)
        onAccent: "#06101C",    // texto sobre o azul de destaque

        // --- destaque e estados ---
        accent: "#4FB3FF",
        accentStrong: "#1A9FFF",
        accentSoft: "rgba(79, 179, 255, 0.14)",
        accentSoftLight: "#dbeafe",
        gold: "#FFB300",        // 100% de conquistas, fixados
        success: "#4ADE80",     // online, chave salva
        danger: "#F87171",
        error: "#ef4444",
        warning: "#FFB300",

        // --- raridade das conquistas ---
        rarityCommon: "#D7DEE8",
        rarityUncommon: "#4ADE80",
        rarityRare: "#60A5FA",
        rarityEpic: "#C084FC",
        rarityLegendary: "#FFB300",
        rarityPearlescent: "#00E5FF",
    },

    // Famílias de fonte carregadas em app/_layout.jsx. Em React Native cada
    // peso é uma família própria (fontWeight não troca o arquivo da fonte).
    FONTS: {
        display: "SpaceGrotesk_700Bold",
        displaySemibold: "SpaceGrotesk_600SemiBold",
        displayMedium: "SpaceGrotesk_500Medium",
        body: "Inter_400Regular",
        bodyMedium: "Inter_500Medium",
        bodySemibold: "Inter_600SemiBold",
    },
};
