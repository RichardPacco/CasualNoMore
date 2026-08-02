const { COLORS } = require("./src/theme/colors.js");

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
        danger: COLORS.danger
      }
    },
  },
  plugins: [],
}

