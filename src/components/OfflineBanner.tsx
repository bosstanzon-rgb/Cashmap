import { Text, View } from "react-native";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

/**
 * Shows a non-intrusive banner at the top of any screen when offline.
 * Uses cached data silently — just informs the user.
 */
export const OfflineBanner = () => {
  const { isOnline } = useNetworkStatus();
  if (isOnline) return null;

  return (
    <View className="mx-4 mb-2 flex-row items-center gap-2 rounded-xl border border-cm-warn/30 bg-cm-warn-dim px-4 py-2.5">
      <Text className="text-[16px]">📡</Text>
      <Text className="flex-1 text-[12px] leading-5 text-cm-warn">
        You're offline — showing cached data. Connect to see live zones.
      </Text>
    </View>
  );
};
