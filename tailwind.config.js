const { COLORS, FONTS } = require("./src/theme/colors.js");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: '#030014',
        secondary: '#151312',
        light: {
          100: '#D6C6FF',
          200: '#A8B5DB',
          300: '#9CA4AB'
        },
        dark: {
          100: '#221F3D',
          200: '#0F0D23'
        },
        accent: COLORS.accent,
        'accent-strong': COLORS.accentStrong,
        danger: COLORS.danger,
        warning: COLORS.warning,

        // Arcade Night (redesign)
        bg: COLORS.bg,
        surface: COLORS.surface,
        'surface-2': COLORS.surface2,
        line: COLORS.border,
        'line-subtle': COLORS.borderSubtle,
        ink: COLORS.text,
        'ink-soft': COLORS.textSoft,
        muted: COLORS.textMuted,
        'on-accent': COLORS.onAccent,
        gold: COLORS.gold,
        success: COLORS.success
      },
      // Uma família por peso (ver FONTS em colors.js): use font-display,
      // font-body-semibold etc. em vez de font-bold com fontes próprias.
      fontFamily: {
        display: [FONTS.display],
        'display-semibold': [FONTS.displaySemibold],
        'display-medium': [FONTS.displayMedium],
        body: [FONTS.body],
        'body-medium': [FONTS.bodyMedium],
        'body-semibold': [FONTS.bodySemibold]
      },
      borderRadius: {
        field: '14px',
        row: '16px',
        card: '20px'
      }
    },
  },
  plugins: [],
}

