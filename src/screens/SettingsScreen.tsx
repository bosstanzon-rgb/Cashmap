import { useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, Share, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { useOpenPaywall } from "@/navigation/useOpenPaywall";
import { useAppStore } from "@/store/useAppStore";
import { computeEntitledToPro, selectEntitledToPro, selectTrialActive, useProStore } from "@/store/proStore";
import { checkProStatus, mapPurchasesError, openRevenueCatManage, restorePurchases } from "@/services/revenuecat";
import { showErrorAlert, showSuccessToast } from "@/lib/appToasts";
import { LaunchCodeSection } from "@/components/LaunchCodeSection";
import {
  getMarketConfig,
  getRideHailTiers,
  isRideHailPlatform,
  MARKET_CODES,
} from "@/constants/markets";
import { COMMON_LANGUAGE_OPTIONS, t } from "@/constants/i18n";
import { isSupabaseConfigured } from "@/services/supabase";
import { navigationRef } from "@/navigation/navigationRef";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { DisclaimerFooter } from "@/components/DisclaimerFooter";
import { PlatformChipSelector } from "@/components/PlatformChipSelector";
import { CM, INPUT_PLACEHOLDER } from "@/constants/theme";
import { GlassCard } from "@/components/GlassCard";
import { MvpDisclaimerBanner } from "@/components/MvpDisclaimerBanner";
import { PremiumPressable } from "@/components/PremiumPressable";
import { BTN_DANGER, BTN_PRIMARY_TEXT } from "@/constants/buttonStyles";

const ToggleRow = ({
  label,
  value,
  onPress,
  enabledText,
  disabledText,
}: {
  label: string;
  value: boolean;
  onPress: () => void;
  enabledText: string;
  disabledText: string;
}) => (
  <View className="rounded-2xl border border-white/10 bg-cm-raised p-4">
    <View className="flex-row items-center justify-between gap-3">
      <Text className="min-w-0 flex-1 text-[15px] leading-6 text-cm-ink">{label}</Text>
      <PremiumPressable
        variant="none"
        className={`min-h-14 min-w-[120px] justify-center rounded-full px-6 py-3 ${value ? "bg-cm-accent shadow-cm-glow-sm" : "border border-white/20 bg-cm-raised"}`}
        onPress={onPress}
      >
        <Text className={`text-center text-[13px] font-bold uppercase tracking-wide ${value ? "text-cm-on-accent" : "text-cm-ink"}`}>
          {value ? enabledText : disabledText}
        </Text>
      </PremiumPressable>
    </View>
  </View>
);

export const SettingsScreen = () => {
  const insets = useSafeAreaInsets();
  const openPaywall = useOpenPaywall();
  const [customLanguage, setCustomLanguage] = useState("");
  const [manageBusy, setManageBusy] = useState(false);
  const {
    selectedPlatforms,
    hasLocationConsent,
    trackMileageWhenWorking,
    zoneAlertsEnabled,
    dailyShiftPromptEnabled,
    weatherTipsEnabled,
    weeklyRecapNotificationsEnabled,
    autoPauseAfterInactivity,
    autoDetectShiftEnd,
    togglePlatform,
    setTrackMileageWhenWorking,
    setLocationConsent,
    setZoneAlertsEnabled,
    setDailyShiftPromptEnabled,
    setWeatherTipsEnabled,
    setWeeklyRecapNotificationsEnabled,
    setAutoPauseAfterInactivity,
    setAutoDetectShiftEnd,
    marketCode,
    setMarketCode,
    languageCode,
    setLanguageCode,
    rideHailQualifiedTierIds,
    rideHailActiveTierId,
    setRideHailQualifiedTiers,
    setRideHailActiveTier,
    appSwitchTipsEnabled,
    setAppSwitchTipsEnabled,
    resetOnboarding,
    shareAnonymousHeatmapData,
    setShareAnonymousHeatmapData,
  } = useAppStore();
  const entitled = useProStore(selectEntitledToPro);
  const trialActive = useProStore(selectTrialActive);
  const isLifetimePro = useProStore((s) => s.isLifetimePro);
  const subscriptionActive = useProStore((s) => s.isPro);
  const setIsPro = useProStore((s) => s.setIsPro);
  const openUpgradeModal = useProStore((s) => s.openUpgradeModal);
  const market = getMarketConfig(marketCode);
  const backendOk = isSupabaseConfigured();

  const openNotificationSettings = () => {
    if (Platform.OS === "ios") {
      void Linking.openURL("app-settings:");
    } else {
      void Linking.openSettings();
    }
  };
  const appVersion = Constants.expoConfig?.version ?? "—";

  return (
    <ScrollView
      className="flex-1 bg-cm-canvas"
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: Math.max(insets.top, 12),
        paddingBottom: Math.max(insets.bottom, 48),
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled={Platform.OS === "android"}
    >
      <Text className="text-[11px] font-bold uppercase tracking-widest text-cm-accent">CashMap</Text>
      <Text className="mb-1 text-[28px] font-bold text-cm-ink">{t("settings", languageCode)}</Text>
      <Text className="mb-5 text-[13px] leading-5 text-cm-ink-tertiary">Manage your platforms, notifications, and subscription</Text>
      <MvpDisclaimerBanner className="mb-5" />
      <GlassCard contentClassName="p-5">
        <Text className="text-[15px] font-bold text-cm-ink">{t("aboutCashMapTitle", languageCode)}</Text>
        <Text className="mt-3 text-[14px] leading-6 text-cm-ink-secondary">{t("aboutCashMapBody", languageCode)}</Text>
        <PremiumPressable
          variant="primary"
          className="mt-5 w-full shadow-cm-glow-sm"
          onPress={() => {
            void (async () => {
              try {
                await Clipboard.setStringAsync(t("shareCashMapInviteFull", languageCode));
                showSuccessToast(t("toastCopiedInvite", languageCode));
              } catch {
                showErrorAlert("CashMap", "Could not copy. Try again.");
              }
            })();
          }}
        >
          <Text className={BTN_PRIMARY_TEXT}>{t("copyInviteText", languageCode)}</Text>
        </PremiumPressable>
        <PremiumPressable variant="secondaryAccent" className="mt-3 w-full" onPress={() => void Share.share({
              message: t("shareCashMapMessage", languageCode),
              title: t("shareCashMapDialogTitle", languageCode),
            })}>
          <Text className="text-center text-[16px] font-bold text-cm-accent">{t("shareCashMap", languageCode)}</Text>
        </PremiumPressable>
        <Text className="mt-2 text-center text-[11px] leading-4 text-cm-ink-tertiary">{t("shareCashMapHelper", languageCode)}</Text>
        <PremiumPressable variant="secondary" className="mt-4 w-full" onPress={() => {
            if (navigationRef.isReady()) navigationRef.navigate("Legal");
          }}>
          <Text className="text-center text-[16px] font-bold text-cm-ink-secondary">{t("legalPrivacyNav", languageCode)}</Text>
        </PremiumPressable>
      </GlassCard>
      <View className="mb-5 rounded-2xl border border-white/10 bg-cm-surface p-5">
        <Text className="text-[15px] font-bold text-cm-ink">Notifications</Text>
        <Text className="mt-1 text-[13px] leading-5 text-cm-ink-tertiary">
          Zone alerts and weekly recaps need notification permission. If alerts aren't arriving, tap below to check.
        </Text>
        <PremiumPressable
          variant="none"
          className="mt-3 min-h-12 justify-center rounded-full border border-white/15 bg-cm-raised px-6 py-3"
          onPress={openNotificationSettings}
        >
          <Text className="text-center text-[13px] font-semibold text-cm-ink-secondary">Open Notification Settings →</Text>
        </PremiumPressable>
      </View>

      {/* Only show connection status in dev builds — users don't need to see this */}
      {__DEV__ ? (
        <View
          className={`mb-5 rounded-2xl border p-4 ${
            backendOk ? "border-cm-accent/30 bg-cm-surface" : "border-cm-warn/30 bg-cm-surface"
          }`}
        >
          <Text className="text-[13px] font-semibold text-cm-ink">{t("backendStatus", languageCode)}</Text>
          <Text className="mt-2 text-[12px] text-cm-ink-tertiary">
            {backendOk ? "✅ Supabase connected" : "⚠️ Supabase not configured — check .env"}
          </Text>
        </View>
      ) : backendOk ? null : (
        <View className="mb-5 rounded-2xl border border-cm-warn/30 bg-cm-surface p-4">
          <Text className="text-[13px] font-semibold text-cm-ink">Connection</Text>
          <Text className="mt-2 text-[12px] text-cm-ink-tertiary">
            Live zone data requires an internet connection. Make sure you're connected.
          </Text>
        </View>
      )}
      <View className="mb-5 rounded-2xl border border-white/10 bg-cm-surface p-5">
        <Text className="text-[14px] font-semibold text-cm-ink">{t("homeRegion", languageCode)}</Text>
        <View className="mt-4 flex-row flex-wrap gap-2">
          {MARKET_CODES.map((code) => {
            const m = getMarketConfig(code);
            const selected = marketCode === code;
            return (
              <PremiumPressable
                key={code}
                variant="chip"
                className={`px-4 ${selected ? "border-cm-cyan/50 bg-cm-cyan-dim" : "border-white/10 bg-cm-raised"}`}
                onPress={() => setMarketCode(code)}
              >
                <Text className={`text-[13px] font-bold ${selected ? "text-cm-cyan" : "text-cm-ink-secondary"}`}>
                  {m.country} ({m.currency})
                </Text>
              </PremiumPressable>
            );
          })}
        </View>
      </View>
      <View className="mb-5 rounded-2xl border border-white/10 bg-cm-surface p-5">
        <Text className="text-[14px] font-semibold text-cm-ink">{t("manageSubscription", languageCode)}</Text>
        <Text className="mt-2 text-[12px] text-cm-ink-tertiary">{t("proTeaserLine", languageCode)}</Text>
        <Text className="mt-3 text-[13px] leading-5 text-cm-ink-secondary">
          {isLifetimePro
            ? t("proLifetime", languageCode)
            : entitled
              ? t("proActive", languageCode)
              : t("freeTier", languageCode)}
        </Text>
        {isLifetimePro ? (
          <View className="mt-3 self-start rounded-full border border-cm-accent/40 bg-cm-accent-soft px-3 py-1.5">
            <Text className="text-[12px] font-bold uppercase tracking-wide text-cm-accent">Lifetime Pro</Text>
          </View>
        ) : null}
        {trialActive && !isLifetimePro ? (
          <Text className="mt-2 text-[12px] text-cm-accent">{t("subscriptionStatusTrial", languageCode)}</Text>
        ) : null}
        {!isLifetimePro ? (
          <PremiumPressable
            variant="none"
            className="mt-4 min-h-14 w-full justify-center rounded-full border-[1.5px] border-cm-accent/45 bg-cm-accent-soft px-8 py-4 shadow-cm-inner"
            onPress={openPaywall}
          >
            <Text className="text-center text-[16px] font-bold text-cm-accent">
              {t("openPaywall", languageCode)}
            </Text>
          </PremiumPressable>
        ) : null}
        <PremiumPressable
          variant="secondary"
          className={`mt-3 w-full flex-row items-center justify-center gap-2 ${manageBusy ? "opacity-60" : ""}`}
          disabled={manageBusy}
          onPress={() => {
            void (async () => {
              if (isLifetimePro) {
                Alert.alert(
                  t("settingsLifetimeManageTitle", languageCode),
                  t("settingsLifetimeManageMessage", languageCode)
                );
                return;
              }
              if (entitled && subscriptionActive) {
                setManageBusy(true);
                try {
                  await openRevenueCatManage();
                } catch (e) {
                  showErrorAlert(t("errOpenManageTitle", languageCode), mapPurchasesError(e, ""));
                } finally {
                  setManageBusy(false);
                }
                return;
              }
              setManageBusy(true);
              try {
                await restorePurchases();
                await checkProStatus();
                const s = useProStore.getState();
                if (computeEntitledToPro(s)) {
                  showSuccessToast(t("toastPurchasesRestoredPro", languageCode));
                } else {
                  showErrorAlert(t("errNoSubscriptionTitle", languageCode), t("errNoSubscriptionBody", languageCode));
                  openUpgradeModal();
                }
              } catch (e) {
                showErrorAlert(t("errRestoreFailedTitle", languageCode), mapPurchasesError(e, "Purchase restore was cancelled."));
              } finally {
                setManageBusy(false);
              }
            })();
          }}
        >
          {manageBusy ? <ActivityIndicator color={CM.inkSecondary} size="small" /> : null}
          <Text className="text-center text-[16px] font-bold text-cm-ink-secondary">
            {t("manageSubscriptionLink", languageCode)}
          </Text>
        </PremiumPressable>
        {entitled ? (
          <Text className="mt-4 text-[12px] text-cm-accent">{t("proAdFree", languageCode)}</Text>
        ) : null}
      </View>
      {!isLifetimePro ? (
        <View className="mb-5">
          <LaunchCodeSection />
        </View>
      ) : null}
      {__DEV__ ? (
        <View className="mb-5 rounded-2xl border border-amber-800/40 bg-amber-950/22 p-4">
          <Text className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">Dev</Text>
          <ToggleRow
            label="Simulate paid subscription (QA — not in release builds)"
            value={subscriptionActive}
            onPress={() => setIsPro(!subscriptionActive)}
            enabledText="Pro simulated"
            disabledText="Free tier"
          />
        </View>
      ) : null}
      <View className="gap-4">
        <View className="rounded-2xl border border-white/10 bg-cm-surface p-5">
          <Text className="text-[14px] font-semibold text-cm-ink">{t("language", languageCode)}</Text>
          <View className="mt-4 flex-row flex-wrap gap-2">
            {COMMON_LANGUAGE_OPTIONS.map((item) => {
              const selected = languageCode.startsWith(item.code);
              return (
                <PremiumPressable
                  key={item.code}
                  variant="chip"
                  className={`px-4 ${selected ? "border-cm-accent/40 bg-cm-accent-soft" : "border-white/10 bg-cm-surface"}`}
                  onPress={() => setLanguageCode(item.code)}
                >
                  <Text className={`text-[13px] font-bold ${selected ? "text-cm-accent" : "text-cm-ink-secondary"}`}>
                    {item.label}
                  </Text>
                </PremiumPressable>
              );
            })}
          </View>
          <View className="mt-4 flex-row gap-2">
            <TextInput
              value={customLanguage}
              onChangeText={setCustomLanguage}
              placeholder={t("customLanguagePlaceholder", languageCode)}
              placeholderTextColor={INPUT_PLACEHOLDER}
              className="flex-1 rounded-xl border border-white/10 bg-cm-raised px-3 py-3 text-[15px] text-cm-ink"
            />
            <PremiumPressable
              variant="primary"
              className="min-w-[100px] px-6"
              onPress={() => {
                const code = customLanguage.trim();
                if (!code) return;
                setLanguageCode(code);
                setCustomLanguage("");
              }}
            >
              <Text className={BTN_PRIMARY_TEXT}>{t("apply", languageCode)}</Text>
            </PremiumPressable>
          </View>
          <Text className="mt-3 text-[12px] leading-5 text-cm-ink-tertiary">
            {t("customLanguageHint", languageCode)}
          </Text>
        </View>
        <View className="rounded-2xl border border-white/10 bg-cm-surface p-5">
          <PlatformChipSelector
            presets={market.allPlatforms}
            selectedPlatforms={selectedPlatforms}
            onTogglePlatform={togglePlatform}
          />
        </View>
        {selectedPlatforms.some((p) => isRideHailPlatform(p)) ? (
          <View className="gap-3">
            <Text className="text-[14px] font-bold text-cm-ink">{t("appMultiAppTips", languageCode)}</Text>
            {selectedPlatforms.filter(isRideHailPlatform).map((p) => {
              const tiers = getRideHailTiers(p);
              const q = rideHailQualifiedTierIds[p];
              const qualified = q?.length ? q : tiers[0] ? [tiers[0].id] : [];
              const active = rideHailActiveTierId[p] ?? qualified[0];
              return (
                <View key={p} className="rounded-2xl border border-white/10 bg-cm-surface p-5">
                  <Text className="text-[14px] text-cm-ink-secondary">
                    {t("rideHailServiceTypes", languageCode)} — {p}
                  </Text>
                  <Text className="mt-2 text-[12px] text-cm-ink-tertiary">{t("rideHailQualified", languageCode)}</Text>
                  <View className="mt-3 flex-row flex-wrap gap-2">
                    {tiers.map((tier) => {
                      const on = qualified.includes(tier.id);
                      return (
                        <PremiumPressable
                          key={tier.id}
                          variant="chip"
                          className={`px-3.5 ${on ? "border-cm-accent/50 bg-cm-accent-soft" : "border-white/10 bg-cm-raised"}`}
                          onPress={() => {
                            if (on && qualified.length <= 1) return;
                            const next = on
                              ? qualified.filter((id) => id !== tier.id)
                              : [...qualified, tier.id];
                            setRideHailQualifiedTiers(p, next);
                          }}
                        >
                          <Text className={`text-[13px] font-bold ${on ? "text-cm-accent" : "text-cm-ink-secondary"}`}>
                            {tier.label}
                          </Text>
                        </PremiumPressable>
                      );
                    })}
                  </View>
                  <Text className="mt-4 text-[12px] text-cm-ink-tertiary">{t("rideHailActive", languageCode)}</Text>
                  <View className="mt-2 flex-row flex-wrap gap-2">
                    {tiers
                      .filter((tier) => qualified.includes(tier.id))
                      .map((tier) => (
                        <PremiumPressable
                          key={`act-${tier.id}`}
                          variant="chip"
                          className={`px-3.5 ${
                            active === tier.id
                              ? "border-cm-accent/45 bg-cm-accent-soft"
                              : "border-white/10 bg-cm-raised"
                          }`}
                          onPress={() => setRideHailActiveTier(p, tier.id)}
                        >
                          <Text
                            className={`text-[13px] font-bold ${active === tier.id ? "text-cm-accent" : "text-cm-ink-secondary"}`}
                          >
                            {tier.label}
                          </Text>
                        </PremiumPressable>
                      ))}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
        <ToggleRow
          label={t("shareHeatmapData", languageCode)}
          value={shareAnonymousHeatmapData}
          onPress={() => {
            if (!shareAnonymousHeatmapData && !hasLocationConsent) {
              Alert.alert("CashMap", t("heatmapNeedsLocationConsent", languageCode));
              return;
            }
            setShareAnonymousHeatmapData(!shareAnonymousHeatmapData);
          }}
          enabledText={t("enabled", languageCode)}
          disabledText={t("disabled", languageCode)}
        />
        <Text className="-mt-1 mb-3 text-[12px] leading-5 text-cm-ink-tertiary">{t("shareHeatmapDataHint", languageCode)}</Text>
        <ToggleRow
          label={t("locationConsent", languageCode)}
          value={hasLocationConsent}
          onPress={() => setLocationConsent(!hasLocationConsent)}
          enabledText={t("enabled", languageCode)}
          disabledText={t("disabled", languageCode)}
        />
        <ToggleRow
          label={`${t("trackMileageWhenWorking", languageCode)}\nRuns in the background — km is logged for tax export`}
          value={trackMileageWhenWorking}
          onPress={() => setTrackMileageWhenWorking(!trackMileageWhenWorking)}
          enabledText={t("enabled", languageCode)}
          disabledText={t("disabled", languageCode)}
        />
        <Text className="-mt-1 mb-3 text-xs text-amber-200/90">{t("mileageBatteryWarning", languageCode)}</Text>
        <ToggleRow label={`${t("zoneAlerts", languageCode)}\nNotify me when a nearby zone has high demand`} value={zoneAlertsEnabled} onPress={() => setZoneAlertsEnabled(!zoneAlertsEnabled)} enabledText={t("enabled", languageCode)} disabledText={t("disabled", languageCode)} />
        <ToggleRow
          label={t("appSwitchTips", languageCode)}
          value={appSwitchTipsEnabled}
          onPress={() => setAppSwitchTipsEnabled(!appSwitchTipsEnabled)}
          enabledText={t("enabled", languageCode)}
          disabledText={t("disabled", languageCode)}
        />
        <Text className="-mt-1 text-[12px] leading-5 text-cm-ink-tertiary">{t("appSwitchTipsHint", languageCode)}</Text>
        <ToggleRow label={`${t("dailySummaryPrompt", languageCode)}\nRemind me to log earnings at end of day`} value={dailyShiftPromptEnabled} onPress={() => setDailyShiftPromptEnabled(!dailyShiftPromptEnabled)} enabledText={t("enabled", languageCode)} disabledText={t("disabled", languageCode)} />
        <ToggleRow
          label={`${t("autoDetectShiftEnd", languageCode)}\nAutomatically stops tracking when you've been stationary for 25+ min`}
          value={autoDetectShiftEnd}
          onPress={() => setAutoDetectShiftEnd(!autoDetectShiftEnd)}
          enabledText={t("enabled", languageCode)}
          disabledText={t("disabled", languageCode)}
        />
        <ToggleRow label={t("weatherTips", languageCode)} value={weatherTipsEnabled} onPress={() => setWeatherTipsEnabled(!weatherTipsEnabled)} enabledText={t("enabled", languageCode)} disabledText={t("disabled", languageCode)} />
        <ToggleRow label={t("weeklyRecapNotifications", languageCode)} value={weeklyRecapNotificationsEnabled} onPress={() => setWeeklyRecapNotificationsEnabled(!weeklyRecapNotificationsEnabled)} enabledText={t("enabled", languageCode)} disabledText={t("disabled", languageCode)} />
        <ToggleRow label={t("autoPause", languageCode)} value={autoPauseAfterInactivity} onPress={() => setAutoPauseAfterInactivity(!autoPauseAfterInactivity)} enabledText={t("enabled", languageCode)} disabledText={t("disabled", languageCode)} />
      </View>
      <View className="mt-5 rounded-2xl border border-white/10 bg-cm-surface/90 p-5">
        <LegalDisclaimer compact showPolicyLinks />
      </View>
      <PremiumPressable
        variant="none"
        className={`mt-6 w-full ${BTN_DANGER}`}
        onPress={() =>
          Alert.alert(t("resetAppData", languageCode), t("resetAppConfirm", languageCode), [
            { text: t("cancel", languageCode), style: "cancel" },
            {
              text: t("continue", languageCode),
              style: "destructive",
              onPress: () => resetOnboarding(),
            },
          ])
        }
      >
        <Text className="text-center text-[16px] font-bold text-red-300">
          {t("resetAppData", languageCode)}
        </Text>
      </PremiumPressable>
      <Text className="mt-5 text-[12px] leading-5 text-cm-ink-tertiary">
        {t("locationAccuracyHint", languageCode)}
      </Text>
      <View className="mt-6 rounded-2xl border border-white/10 bg-cm-raised/80 px-4 py-3">
        <Text className="text-center text-[11px] font-bold uppercase tracking-widest text-cm-accent">CashMap</Text>
        <Text className="mt-1 text-center text-[15px] font-semibold text-cm-ink">Version {appVersion}</Text>
        <Text className="mt-1 text-center text-[11px] text-cm-ink-tertiary">Gauteng-focused MVP · estimates only</Text>
      </View>
      <DisclaimerFooter />
    </ScrollView>
  );
};
