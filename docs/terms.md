Termsofservicescreen · TSX
Copy

import { Linking, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { TERMS_OF_SERVICE_PLACEHOLDER, TERMS_OF_SERVICE_URL } from "@/constants/legal";
import { PremiumPressable } from "@/components/PremiumPressable";
 
export const TermsOfServiceScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-cm-canvas px-5" style={{ paddingTop: Math.max(insets.top, 16) }}>
      <PremiumPressable variant="secondary" className="mb-5 self-end px-8 shadow-cm-inner" onPress={() => navigation.goBack()}>
        <Text className="text-center text-[15px] font-bold text-cm-ink">Close</Text>
      </PremiumPressable>
      <Text className="text-[11px] font-bold uppercase tracking-widest text-cm-accent">CashMap</Text>
      <Text className="mt-2 text-3xl font-bold tracking-tight text-cm-ink">Terms of Service</Text>
      <PremiumPressable variant="none" className="mt-2 self-start" onPress={() => void Linking.openURL(TERMS_OF_SERVICE_URL)}>
        <Text className="text-[12px] text-cm-accent underline">View latest version online →</Text>
      </PremiumPressable>
      <ScrollView className="mt-4 flex-1" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text className="text-[14px] leading-7 text-cm-ink-secondary">{TERMS_OF_SERVICE_PLACEHOLDER}</Text>
      </ScrollView>
    </View>
  );
};
 
