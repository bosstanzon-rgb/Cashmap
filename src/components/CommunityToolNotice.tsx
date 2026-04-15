import { Text, View } from "react-native";
import { CASHMAP_COMMUNITY_ESTIMATE_NOTICE } from "@/constants/legal";

type Props = {
  className?: string;
};

export const CommunityToolNotice = ({ className = "" }: Props) => (
  <View
    className={`rounded-2xl border border-cm-warn/25 bg-cm-warn-dim px-3 py-2.5 shadow-cm-inner ${className}`}
  >
    <Text className="text-center text-[11px] leading-4 text-cm-warn">{CASHMAP_COMMUNITY_ESTIMATE_NOTICE}</Text>
  </View>
);
