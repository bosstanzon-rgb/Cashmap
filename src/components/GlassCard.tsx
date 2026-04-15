import { ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";

type Props = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

/**
 * Frosted panel — blur + elevated surface for premium glass cards (readable on dark).
 */
export function GlassCard({ children, className = "", contentClassName = "p-6" }: Props) {
  const blur = Platform.OS === "ios" ? 48 : 32;
  return (
    <View
      className={`overflow-hidden rounded-3xl border border-white/[0.12] shadow-cm-card ${className}`}
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.5,
        shadowRadius: 32,
        elevation: 14,
      }}
    >
      <BlurView intensity={blur} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View
        className={`relative rounded-3xl border border-white/[0.06] bg-[#111111]/88 ${contentClassName}`}
      >
        {children}
      </View>
    </View>
  );
}
