import { DarkTheme, type Theme } from "@react-navigation/native";
import { CM } from "@/constants/theme";

/** Ensures stack/tabs never flash default light or empty black — matches CashMap tokens */
export const cashMapNavigationTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: CM.accent,
    background: CM.canvas,
    card: CM.surface,
    text: "#FFFFFF",
    border: "rgba(255,255,255,0.1)",
    notification: CM.accent,
  },
};
