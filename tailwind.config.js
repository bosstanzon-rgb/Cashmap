/** @type {import('tailwindcss').Config} */
/** CashMap premium dark — high contrast, readable, 2026 fintech */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        cm: {
          canvas: "#0F0F0F",
          surface: "#1A1A1A",
          raised: "#242424",
          muted: "#2E2E2E",
          border: "rgba(255, 255, 255, 0.12)",
          accent: "#00FF9D",
          "accent-dim": "rgba(0, 255, 157, 0.14)",
          "accent-soft": "rgba(0, 255, 157, 0.18)",
          "accent-glow": "rgba(0, 255, 157, 0.4)",
          cyan: "#00E5FF",
          "cyan-dim": "rgba(0, 229, 255, 0.14)",
          ink: "#FFFFFF",
          /** Body / secondary — high contrast on dark */
          "ink-secondary": "#E0E0E0",
          /** Captions — clearly readable */
          "ink-tertiary": "#AAAAAA",
          "on-accent": "#0A0A0A",
          warn: "#FBBF24",
          "warn-dim": "rgba(251, 191, 36, 0.12)",
          danger: "#F87171",
        },
      },
      boxShadow: {
        "cm-glow": "0 0 36px rgba(0, 255, 157, 0.32)",
        "cm-glow-sm": "0 0 20px rgba(0, 255, 157, 0.26)",
        "cm-card": "0 20px 56px rgba(0, 0, 0, 0.55)",
        "cm-inner": "inset 0 1px 0 rgba(255, 255, 255, 0.09)",
        "cm-float": "0 10px 40px rgba(0, 0, 0, 0.45)",
      },
      fontFamily: {
        sans: ["System"],
      },
    },
  },
  plugins: [],
};
