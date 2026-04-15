import { Text, View } from "react-native";
import { CASHMAP_MVP_FOOTER } from "@/constants/legal";

type Props = {
  /** Extra top margin (tailwind class fragment without `mt-` prefix number handled by className) */
  className?: string;
};

/** Compact legal line for bottom of scroll areas — matches MVP “every screen” requirement. */
export const DisclaimerFooter = ({ className = "" }: Props) => (
  <View className={`mt-8 border-t border-white/[0.07] pt-5 ${className}`}>
    <Text className="text-center text-[12px] leading-[18px] text-cm-ink-secondary">{CASHMAP_MVP_FOOTER}</Text>
  </View>
);
