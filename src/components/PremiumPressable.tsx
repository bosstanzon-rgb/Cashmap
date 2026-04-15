import { ReactNode, useEffect } from "react";
import { Pressable, PressableProps } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import {
  BTN_CHIP,
  BTN_HERO,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_SECONDARY_ACCENT,
  BTN_TERTIARY,
} from "@/constants/buttonStyles";

const spring = { damping: 16, stiffness: 420 };

export type PremiumButtonVariant =
  | "none"
  | "primary"
  | "secondary"
  | "secondaryAccent"
  | "tertiary"
  | "hero"
  | "chip";

const VARIANT_CLASS: Record<Exclude<PremiumButtonVariant, "none">, string> = {
  primary: BTN_PRIMARY,
  secondary: BTN_SECONDARY,
  secondaryAccent: BTN_SECONDARY_ACCENT,
  tertiary: BTN_TERTIARY,
  hero: BTN_HERO,
  chip: BTN_CHIP,
};

type Props = Omit<PressableProps, "children"> & {
  className?: string;
  children: ReactNode;
  /** Merges standard pill sizing + press scale. Use `none` for fully custom `className`. */
  variant?: PremiumButtonVariant;
};

/**
 * Premium buttons — scale spring on press (~0.95), disabled resets scale + lowers opacity.
 */
export function PremiumPressable({
  children,
  className,
  variant = "none",
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    if (disabled) {
      scale.value = withSpring(1, spring);
    }
  }, [disabled, scale]);

  const base = variant !== "none" && variant ? VARIANT_CLASS[variant] : "";

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled) {
          scale.value = withSpring(0.95, spring);
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!disabled) {
          scale.value = withSpring(1, spring);
        }
        onPressOut?.(e);
      }}
    >
      <Animated.View
        className={`${base}${base && className ? " " : ""}${className ?? ""}${disabled ? " opacity-50" : ""}`}
        style={style}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
