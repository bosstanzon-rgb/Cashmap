import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StackScreenProps } from "@react-navigation/stack";
import { RootStackParamList } from "@/types/navigation";
import { useAppStore } from "@/store/useAppStore";
import { t } from "@/constants/i18n";
import { CASHMAP_MVP_FOOTER } from "@/constants/legal";
import { CM } from "@/constants/theme";

type Props = StackScreenProps<RootStackParamList, "Splash">;

export const SplashScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const languageCode = useAppStore((s) => s.languageCode);
  useEffect(() => {
    const timer = setTimeout(() => navigation.replace("Welcome"), 600);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View className="flex-1 bg-cm-canvas" style={{ paddingTop: insets.top }}>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-[12px] font-bold uppercase tracking-widest text-cm-accent">CashMap</Text>
        <ActivityIndicator className="mt-6" color={CM.accent} />
        <Text className="mt-4 text-center text-[15px] text-cm-ink-secondary">{t("splashLoading", languageCode)}</Text>
      </View>
      <Text className="px-6 pb-8 text-center text-[12px] leading-[18px] text-cm-ink-secondary">{CASHMAP_MVP_FOOTER}</Text>
    </View>
  );
};
