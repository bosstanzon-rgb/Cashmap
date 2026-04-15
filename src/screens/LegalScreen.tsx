import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/types/navigation";
import { ONBOARDING_HEATMAP_CONSENT_TEXT } from "@/constants/legal";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { PremiumPressable } from "@/components/PremiumPressable";

type LegalNav = StackNavigationProp<RootStackParamList, "Legal">;

export const LegalScreen = () => {
  const navigation = useNavigation<LegalNav>();
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-cm-canvas px-5" style={{ paddingTop: Math.max(insets.top, 16) }}>
      <PremiumPressable variant="secondary" className="mb-5 self-end px-8 shadow-cm-inner" onPress={() => navigation.goBack()}>
        <Text className="text-center text-[15px] font-bold text-cm-ink">Close</Text>
      </PremiumPressable>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Text className="text-[11px] font-bold uppercase tracking-widest text-cm-accent">CashMap</Text>
        <Text className="mt-2 text-3xl font-bold tracking-tight text-cm-ink">Legal & Privacy</Text>
        <Text className="mt-2 text-[13px] text-cm-ink-tertiary">Short summaries for drivers — not legal advice.</Text>

        <View className="mt-8 rounded-3xl border border-white/10 bg-cm-surface/95 p-5 shadow-cm-card">
          <Text className="text-[15px] font-semibold text-cm-ink">Onboarding consent</Text>
          <Text className="mt-3 text-[14px] leading-6 text-cm-ink-secondary">
            On first setup, you must agree to this before continuing:
          </Text>
          <Text className="mt-4 rounded-2xl border border-cm-cyan/25 bg-cm-cyan-dim p-4 text-[14px] leading-6 text-cm-ink-secondary">
            {ONBOARDING_HEATMAP_CONSENT_TEXT}
          </Text>
          <Text className="mt-4 text-[12px] leading-5 text-cm-ink-tertiary">
            Sending pings to the community map is also controlled by{" "}
            <Text className="font-semibold text-cm-ink-secondary">Share anonymous data for heatmaps</Text> in Settings (off
            by default).
          </Text>
        </View>

        <View className="mt-6">
          <LegalDisclaimer showPolicyLinks />
        </View>

        <View className="mt-8 flex-row flex-wrap gap-3">
          <PremiumPressable
            variant="none"
            className="min-h-14 min-w-[46%] flex-1 justify-center rounded-full border-[1.5px] border-cm-cyan/40 bg-cm-cyan-dim px-6 py-4 shadow-cm-inner"
            onPress={() => navigation.navigate("PrivacyPolicy")}
          >
            <Text className="text-center text-[14px] font-bold text-cm-cyan">Full Privacy Policy</Text>
          </PremiumPressable>
          <PremiumPressable
            variant="none"
            className="min-h-14 min-w-[46%] flex-1 justify-center rounded-full border-[1.5px] border-cm-cyan/40 bg-cm-cyan-dim px-6 py-4 shadow-cm-inner"
            onPress={() => navigation.navigate("TermsOfService")}
          >
            <Text className="text-center text-[14px] font-bold text-cm-cyan">Full Terms of Service</Text>
          </PremiumPressable>
        </View>
      </ScrollView>
    </View>
  );
};
