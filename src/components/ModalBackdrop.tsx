import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";

type Props = {
  children: ReactNode;
  /** Blur strength (platform-dependent). */
  intensity?: number;
};

/** Frosted dim layer for modals — dark blur + ink wash; content sits above. */
export function ModalBackdrop({ children, intensity = 52 }: Props) {
  return (
    <View className="flex-1">
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(10,10,10,0.78)" }]}
      />
      <View className="flex-1" style={{ zIndex: 1 }}>
        {children}
      </View>
    </View>
  );
}
