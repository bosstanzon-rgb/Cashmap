import { Text } from "react-native";

/** Simple emoji “icons” for platform names — no extra native deps; reads well on dark UI. */
export function platformEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("uber")) return "🚗";
  if (n.includes("bolt")) return "⚡";
  if (n.includes("mr d") || n.includes("mrd")) return "🍔";
  if (n.includes("eats") || n.includes("deliver")) return "📦";
  if (n.includes("in_drive") || n.includes("indrive")) return "🅿️";
  return "◎";
}

type Props = { name: string; size?: "sm" | "md" };
export function PlatformGlyph({ name, size = "md" }: Props) {
  const em = platformEmoji(name);
  const textClass = size === "sm" ? "text-base" : "text-xl";
  return (
    <Text className={`${textClass} leading-none`} accessibilityLabel={name}>
      {em}
    </Text>
  );
}
