import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StackScreenProps } from "@react-navigation/stack";
import { RootStackParamList } from "@/types/navigation";
import { getMarketConfig, MARKET_CODES } from "@/constants/markets";
import { useAppStore } from "@/store/useAppStore";
import { t } from "@/constants/i18n";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { DisclaimerFooter } from "@/components/DisclaimerFooter";
import { PremiumPressable } from "@/components/PremiumPressable";
import { BTN_PRIMARY_TEXT } from "@/constants/buttonStyles";
import { GlassCard } from "@/components/GlassCard";

type Props = StackScreenProps<RootStackParamList, "Welcome">;

export const WelcomeScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const languageCode = useAppStore((s) => s.languageCode);
  const marketCode = useAppStore((s) => s.marketCode);
  const setMarketCode = useAppStore((s) => s.setMarketCode);
  const setLanguageCode = useAppStore((s) => s.setLanguageCode);
  return (
    <ScrollView
      className="flex-1 bg-cm-canvas"
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: Math.max(insets.top, 52),
        paddingBottom: Math.max(insets.bottom, 36),
        justifyContent: "space-between",
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <GlassCard contentClassName="px-6 pb-4 pt-8">
        <View className="self-start rounded-full border border-cm-accent/25 bg-cm-accent-soft px-3 py-1.5">
          <Text className="text-[11px] font-bold uppercase tracking-widest text-cm-accent">CashMap</Text>
        </View>
        <Text className="mt-6 text-[34px] font-extrabold leading-[40px] tracking-tight text-cm-ink">
          {t("welcomeToCashMap", languageCode)}
        </Text>
        <Text className="mt-4 text-[17px] leading-6 text-cm-ink-secondary">{t("welcomeCashMapTagline", languageCode)}</Text>
        <View className="mt-6 gap-3">
          {[
            { icon: "📍", title: "Track your km", body: "Tap 'I\'m Working' before your shift. CashMap logs your km in the background for tax deductions." },
            { icon: "🔥", title: "Find hot zones", body: "See live demand heatmaps across the city. Green = high orders, cyan = predicted surge zones." },
            { icon: "💰", title: "Log your earnings", body: "After each shift, log your earnings. CashMap builds your weekly income history automatically." },
          ].map((item) => (
            <View key={item.title} className="flex-row items-start gap-3 rounded-xl border border-white/8 bg-cm-raised px-4 py-3">
              <Text className="text-[22px]">{item.icon}</Text>
              <View className="flex-1">
                <Text className="text-[14px] font-bold text-cm-ink">{item.title}</Text>
                <Text className="mt-0.5 text-[12px] leading-5 text-cm-ink-tertiary">{item.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text className="mt-6 text-[15px] font-semibold text-cm-ink-secondary">{t("chooseHomeRegion", languageCode)}</Text>
        <Text className="mt-1.5 text-[13px] leading-5 text-cm-ink-secondary">{t("chooseHomeRegionHint", languageCode)}</Text>
        <View className="mt-5 gap-2">
          {MARKET_CODES.map((code) => {
            const m = getMarketConfig(code);
            const selected = marketCode === code;
            return (
              <PremiumPressable
                key={code}
                variant="none"
                className={`flex-row items-center justify-between rounded-2xl border px-4 py-3.5 ${
                  selected ? "border-cm-accent/50 bg-cm-accent-soft" : "border-white/10 bg-cm-raised"
                }`}
                onPress={() => setMarketCode(code)}
              >
                <View className="flex-1">
                  <Text className={`text-[15px] font-bold ${selected ? "text-cm-accent" : "text-cm-ink"}`}>
                    {m.country}
                  </Text>
                  <Text className="mt-0.5 text-[12px] text-cm-ink-tertiary">{m.city} · {m.currency}</Text>
                </View>
                {selected ? (
                  <Text className="text-[18px]">✓</Text>
                ) : null}
              </PremiumPressable>
            );
          })}
        </View>
      </GlassCard>
      <View className="mt-6 rounded-2xl border border-white/10 bg-cm-surface p-4">
        <Text className="text-[14px] font-semibold text-cm-ink">Language</Text>
        <Text className="mt-1 text-[12px] text-cm-ink-tertiary">Choose your preferred language</Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {[
            { code: "en", label: "English" },
            { code: "es", label: "Español" },
            { code: "fr", label: "Français" },
            { code: "pt", label: "Português" },
            { code: "ar", label: "العربية" },
            { code: "zh", label: "中文" },
            { code: "hi", label: "हिन्दी" },
            { code: "sw", label: "Swahili" },
            { code: "de", label: "Deutsch" },
            { code: "ru", label: "Русский" },
          ].map((lang) => {
            const selected = languageCode.startsWith(lang.code);
            return (
              <PremiumPressable
                key={lang.code}
                variant="none"
                className={`min-h-10 justify-center rounded-full border px-4 py-2 ${selected ? "border-cm-accent/50 bg-cm-accent-soft" : "border-white/10 bg-cm-raised"}`}
                onPress={() => setLanguageCode(lang.code)}
              >
                <Text className={`text-[13px] font-semibold ${selected ? "text-cm-accent" : "text-cm-ink-secondary"}`}>
                  {lang.label}
                </Text>
              </PremiumPressable>
            );
          })}
        </View>
      </View>
      <View className="mt-6">
        <LegalDisclaimer compact showPolicyLinks />
        <PremiumPressable variant="primary" className="mt-6 w-full shadow-cm-glow" onPress={() => navigation.navigate("ProfileSetup")}>
          <Text className={`${BTN_PRIMARY_TEXT} text-[17px]`}>{t("getStarted", languageCode)}</Text>
        </PremiumPressable>
        <DisclaimerFooter />
      </View>
    </ScrollView>
  );
};
