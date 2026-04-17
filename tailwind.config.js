/** @type {import('tailwindcss').Config} */
/** CashMap — refined dark driver UI, pass 1 refinement */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        cm: {
          // ── Elevation system — no borders, depth through color ──
          canvas:  "#0B0E11",   // true dark base
          surface: "#1B1F23",   // level 1 cards
          raised:  "#2C3136",   // level 2 active elements / inputs
          muted:   "#363B42",   // disabled / subtle

          // ── Accent ──
          accent:       "#00FF9D",
          "accent-dim": "rgba(0, 255, 157, 0.12)",
          "accent-soft":"rgba(0, 255, 157, 0.16)",
          "accent-glow":"rgba(0, 255, 157, 0.38)",

          // ── Cyan removed from small text — kept only for map circles ──
          cyan:      "#00E5FF",
          "cyan-dim":"rgba(0, 229, 255, 0.12)",

          // ── Typography ──
          ink:           "#FFFFFF",          // headers
          "ink-secondary":"#A0AEC0",         // body / descriptions (was E0E0E0)
          "ink-tertiary": "#6B7280",         // captions
          "on-accent":    "#0A0A0A",

          // ── Semantic ──
          warn:      "#F59E0B",
          "warn-dim":"rgba(245, 158, 11, 0.12)",
          danger:    "#F87171",

          // ── Legacy border (kept for gradual removal) ──
          border: "rgba(255, 255, 255, 0.08)",
        },
      },
      borderRadius: {
        // Standardised radius — 12px for chips/inputs, 16px for cards
        "cm-sm": "12px",
        "cm-md": "16px",
        "cm-lg": "20px",
        "cm-xl": "24px",
      },
      boxShadow: {
        "cm-glow":    "0 0 32px rgba(0, 255, 157, 0.28)",
        "cm-glow-sm": "0 0 16px rgba(0, 255, 157, 0.22)",
        "cm-card":    "0 8px 32px rgba(0, 0, 0, 0.6)",
        "cm-inner":   "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        "cm-float":   "0 12px 40px rgba(0, 0, 0, 0.5)",
      },
      fontFamily: {
        sans: ["System"],
      },
      spacing: {
        "card": "16px",   // standard card gap
      },
    },
  },
  plugins: [],
};
