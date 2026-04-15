import { Text, View } from "react-native";
import { MVP_DISCLAIMER_SHORT } from "@/constants/legal";

type Props = {
  className?: string;
};

/** Strong risk line for Map / Earnings / Predictions — matches MVP launch requirement. */
export function MvpDisclaimerBanner({ className = "" }: Props) {
  return (
    <View className={`flex-row items-center justify-center gap-1.5 ${className}`}>
      <Text className="text-[11px] text-cm-ink-tertiary">⚠️</Text>
      <Text className="text-[11px] text-cm-ink-tertiary">{MVP_DISCLAIMER_SHORT}</Text>
    </View>
  );
}
