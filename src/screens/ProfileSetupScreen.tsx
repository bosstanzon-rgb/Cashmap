import { useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { useAppStore } from "@/store/useAppStore";
import { getMarketConfig } from "@/constants/markets";
import { t } from "@/constants/i18n";
import { LaunchCodeSection } from "@/components/LaunchCodeSection";
import { PlatformChipSelector } from "@/components/PlatformChipSelector";
import { DisclaimerFooter } from "@/components/DisclaimerFooter";
import { PremiumPressable } from "@/components/PremiumPressable";
import { BTN_PRIMARY_TEXT } from "@/constants/buttonStyles";
import { INPUT_PLACEHOLDER } from "@/constants/theme";

export const ProfileSetupScreen = () => {
  const insets = useSafeAreaInsets();
  const marketCode = useAppStore((s) => s.marketCode);
  const PLATFORMS = getMarketConfig(marketCode).allPlatforms;
  const [nicknameInput, setNicknameInput] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLaunchCode, setShowLaunchCode] = useState(false);
  const { selectedPlatforms, togglePlatform, setUserProfile, setShareAnonymousHeatmapData, languageCode } = useAppStore();
  const generatedId = useMemo(
    () => `drv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    []
  );
  const nickname = nicknameInput.trim() || `Driver-${Math.floor(Math.random() * 9000 + 1000)}`;

  const onSubmit = async () => {
    if (!consent) {
      setError(t("consentRequired", languageCode));
      return;
    }
    if (selectedPlatforms.length === 0) {
      setError(t("selectOnePlatform", languageCode));
      return;
    }
    setUserProfile({
      userId: generatedId,
      nickname,
      selectedPlatforms,
      hasLocationConsent: consent,
      marketCode,
    });
    setShareAnonymousHeatmapData(consent);
    try {
      await Notifications.requestPermissionsAsync();
    } catch {
      // Non-blocking: onboarding should proceed even if permission flow fails.
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-cm-canvas"
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: Math.max(insets.top, 16),
        paddingBottom: Math.max(insets.bottom, 24),
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text className="text-[30px] font-bold tracking-tight text-cm-ink">{t("quickSetup", languageCode)}</Text>
      <Text className="mt-3 text-[16px] leading-6 text-cm-ink-secondary">{t("noEmailNeeded", languageCode)}</Text>

      <Text className="mt-8 text-[14px] font-medium text-cm-ink-secondary">{t("nicknameDriverId", languageCode)}</Text>
      <TextInput
        value={nicknameInput}
        onChangeText={setNicknameInput}
        placeholder="Driver-1234"
        placeholderTextColor={INPUT_PLACEHOLDER}
        className="mt-2 rounded-3xl bg-cm-raised/90 px-4 py-3.5 text-[16px] text-cm-ink shadow-cm-inner"
      />

      <View className="mt-8 rounded-3xl bg-cm-surface/90 p-4 shadow-cm-card">
        <PlatformChipSelector
          presets={PLATFORMS}
          selectedPlatforms={selectedPlatforms}
          onTogglePlatform={togglePlatform}
        />
      </View>

      {showLaunchCode ? (
        <View className="mt-6">
          <LaunchCodeSection />
        </View>
      ) : (
        <PremiumPressable
          variant="none"
          className="mt-6 self-start min-h-12 justify-center rounded-full border-[1.5px] border-cm-cyan/40 bg-cm-cyan-dim/25 px-8 py-3"
          onPress={() => setShowLaunchCode(true)}
        >
          <Text className="text-center text-[14px] font-bold text-cm-cyan">{t("haveLaunchCode", languageCode)}</Text>
        </PremiumPressable>
      )}

      <PremiumPressable variant="none" className="mt-8 flex-row items-start gap-3" onPress={() => setConsent((v) => !v)}>
        <View
          className={`mt-0.5 h-7 w-7 rounded-xl border-2 ${
            consent ? "border-cm-accent bg-cm-accent" : "border-white/20 bg-cm-raised"
          }`}
        />
        <Text className="flex-1 text-[14px] leading-5 text-cm-ink-secondary">{t("consentText", languageCode)}</Text>
      </PremiumPressable>
      {error ? <Text className="mt-4 text-[13px] text-red-400">{error}</Text> : null}

      <PremiumPressable variant="primary" className="mt-8 w-full shadow-cm-glow" onPress={() => void onSubmit()}>
        <Text className={BTN_PRIMARY_TEXT}>{t("continue", languageCode)}</Text>
      </PremiumPressable>
      <DisclaimerFooter />
    </ScrollView>
  );
};
