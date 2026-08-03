// Central color palette — change a color here and it updates everywhere.
// Keep this file CommonJS (module.exports) so both tailwind.config.js
// (Node require) and app files (Babel import interop) can consume it.

module.exports = {
    COLORS: {
        accent: "#55A8E8",
        accentStrong: "#1A9FFF",
        accentSoft: "rgba(85, 168, 232, 0.12)",
        accentSoftLight: "#dbeafe",
        danger: "#F87171",
        error: "#ef4444",
        warning: "#facc15",
    },
};
