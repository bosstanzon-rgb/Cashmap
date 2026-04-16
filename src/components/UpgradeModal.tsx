import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import {
  getDefaultOfferingPackages,
  mapPurchasesError,
  purchaseLifetime,
  purchaseMonthly,
  purchaseYearly,
} from "@/services/revenuecat";
import { useProStore } from "@/store/proStore";
import { useAppStore } from "@/store/useAppStore";
import { t } from "@/constants/i18n";
import { LaunchCodeSection } from "@/components/LaunchCodeSection";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { CommunityToolNotice } from "@/components/CommunityToolNotice";
import { DisclaimerFooter } from "@/components/DisclaimerFooter";
import { ModalBackdrop } from "@/components/ModalBackdrop";
import { PremiumPressable } from "@/components/PremiumPressable";
import { BTN_PRIMARY_TEXT } from "@/constants/buttonStyles";
import { showErrorAlert, showSuccessToast } from "@/lib/appToasts";
import { CM } from "@/constants/theme";

const BENEFITS = [
  "See exact driver counts in every zone — know when it's worth moving",
  "Predicted R/hr by suburb and platform (e.g. R380/hr in Sandton tonight)",
  "Automatic km tracking in the background — export for SARS tax deductions",
  "Weekly benchmarks — see how your earnings compare to other Joburg drivers",
  "Smart end-of-day shift logger with full zone history",
  "Surge-style alerts when a hot zone opens near you",
  "Ad-free experience",
] as const;

const getModalFallbacks = (mc: string) => {
  if (mc === "ZA") return { monthly: "R59/month", yearly: "R499/year (save 30%)", lifetime: "R999 once-off" };
  if (mc === "NG") return { monthly: "₦2,500/month", yearly: "₦19,999/year", lifetime: "₦39,999 once-off" };
  if (mc === "KE") return { monthly: "KSh 350/month", yearly: "KSh 2,800/year", lifetime: "KSh 5,500 once-off" };
  return { monthly: "$3.99/month", yearly: "$29.99/year", lifetime: "$59.99 once-off" };
};

export const UpgradeModal = () => {
  const languageCode = useAppStore((s) => s.languageCode);
  const marketCode = useAppStore((s) => s.marketCode);
  const visible = useProStore((s) => s.upgradeModalVisible);
  const isLifetimePro = useProStore((s) => s.isLifetimePro);
  const closeUpgradeModal = useProStore((s) => s.closeUpgradeModal);
  const [showLaunchCode, setShowLaunchCode] = useState(false);
  const [offeringsLoading, setOfferingsLoading] = useState(false);
  const [offeringsError, setOfferingsError] = useState<string | null>(null);
  const fallbacks = getModalFallbacks(marketCode);
  const [monthlyLabel, setMonthlyLabel] = useState(fallbacks.monthly);
  const [yearlyLabel, setYearlyLabel] = useState(fallbacks.yearly);
  const [lifetimeLabel, setLifetimeLabel] = useState(fallbacks.lifetime);
  const [purchasingPlan, setPurchasingPlan] = useState<null | "monthly" | "yearly" | "lifetime">(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const loadOfferings = useCallback(async () => {
    setOfferingsLoading(true);
    setOfferingsError(null);
    try {
      const { monthly, annual, lifetime } = await getDefaultOfferingPackages();
      const m = monthly?.product.priceString?.trim();
      const y = annual?.product.priceString?.trim();
      const l = lifetime?.product.priceString?.trim();
      setMonthlyLabel(m ? `${m}/month` : fallbacks.monthly);
      setYearlyLabel(y ? `${y}/year (save 30%)` : fallbacks.yearly);
      setLifetimeLabel(l ? `${l} once-off` : fallbacks.lifetime);
    } catch (e) {
      const msg = mapPurchasesError(e, "");
      setOfferingsError(
        msg || "Could not load subscription prices. Check your connection and try again."
      );
      setMonthlyLabel(fallbacks.monthly);
      setYearlyLabel(fallbacks.yearly);
      setLifetimeLabel(fallbacks.lifetime);
    } finally {
      setOfferingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLifetimePro) closeUpgradeModal();
  }, [isLifetimePro, closeUpgradeModal]);

  useEffect(() => {
    if (!visible) return;
    setLastError(null);
    void loadOfferings();
  }, [visible, loadOfferings]);

  if (isLifetimePro) {
    return null;
  }

  const onStartTrial = async () => {
    if (useProStore.getState().isLifetimePro) return;
    setShowLaunchCode(false);
    setLastError(null);
    setPurchasingPlan("monthly");
    try {
      await purchaseMonthly();
      showSuccessToast(t("toastCashMapProTrialWelcome", languageCode));
      closeUpgradeModal();
    } catch (e) {
      const msg = mapPurchasesError(e, "Purchase cancelled.");
      if (msg) setLastError(msg);
      if (!msg.toLowerCase().includes("cancel")) showErrorAlert(t("errSubscribeTitle", languageCode), msg);
    } finally {
      setPurchasingPlan(null);
    }
  };

  const onYearly = async () => {
    if (useProStore.getState().isLifetimePro) return;
    setLastError(null);
    setPurchasingPlan("yearly");
    try {
      await purchaseYearly();
      showSuccessToast(t("toastCashMapProYearlyActivated", languageCode));
      closeUpgradeModal();
    } catch (e) {
      const msg = mapPurchasesError(e, "Purchase cancelled.");
      if (msg) setLastError(msg);
      if (!msg.toLowerCase().includes("cancel")) showErrorAlert(t("errSubscribeTitle", languageCode), msg);
    } finally {
      setPurchasingPlan(null);
    }
  };

  const onMaybeLater = () => {
    setShowLaunchCode(false);
    closeUpgradeModal();
  };

  const onLifetime = async () => {
    if (useProStore.getState().isLifetimePro) return;
    setLastError(null);
    setPurchasingPlan("lifetime");
    try {
      await purchaseLifetime();
      showSuccessToast("CashMap Pro Lifetime activated.");
      closeUpgradeModal();
    } catch (e) {
      const msg = mapPurchasesError(e, "Purchase cancelled.");
      if (msg) setLastError(msg);
      if (!msg.toLowerCase().includes("cancel")) showErrorAlert(t("errSubscribeTitle", languageCode), msg);
    } finally {
      setPurchasingPlan(null);
    }
  };

  const purchaseBusy = purchasingPlan !== null;
  const busy = purchaseBusy || offeringsLoading;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onMaybeLater}
      onShow={() => setShowLaunchCode(false)}
    >
      <ModalBackdrop intensity={56}>
        <Pressable className="flex-1 items-center justify-center px-4 py-8" onPress={onMaybeLater}>
          <Pressable
            className="max-h-[92%] w-full max-w-md overflow-hidden rounded-3xl border border-white/[0.12] bg-cm-surface shadow-cm-card"
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView
              className="max-h-[640px]"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View className="border-b border-white/10 bg-cm-raised/60 px-6 pb-7 pt-8 shadow-cm-inner">
                <View className="self-start rounded-full border border-cm-accent/30 bg-cm-accent-soft px-3 py-1.5">
                  <Text className="text-[10px] font-bold uppercase tracking-[0.2em] text-cm-accent">CashMap Pro</Text>
                </View>
                <Text className="mt-6 text-[26px] font-bold leading-8 tracking-tight text-cm-ink">
                  {t("unlockCashMapProTitle", languageCode)}
                </Text>
                <Text className="mt-4 text-[15px] leading-[23px] text-cm-ink-secondary">
                  Upgrade to unlock live driver counts, R/hr predictions, smart alerts & benchmarks. Free tier keeps the map, mileage tracking, and manual logging.
                </Text>

                <View className="mt-5 rounded-3xl border border-cm-accent/35 bg-cm-accent-soft px-4 py-4 shadow-cm-inner">
                  <Text className="text-center text-[18px] font-extrabold text-cm-ink">R59/mo · R499/yr</Text>
                  <Text className="mt-1 text-center text-[14px] font-semibold text-cm-accent">14-day free trial</Text>
                  <Text className="mt-2 text-center text-[11px] text-cm-ink-secondary">
                    Gauteng launch pricing — shown live when store loads
                  </Text>
                </View>

                <View className="mt-6 gap-3.5 rounded-3xl border border-white/10 bg-cm-canvas/90 px-4 py-4 shadow-cm-inner">
                  {BENEFITS.map((line) => (
                    <View key={line} className="flex-row gap-3">
                      <Text className="text-base leading-5 text-cm-accent">•</Text>
                      <Text className="flex-1 text-[14px] leading-5 text-cm-ink-secondary">{line}</Text>
                    </View>
                  ))}
                </View>

                <View className="mt-6 gap-2 rounded-3xl border border-cm-accent/25 bg-cm-accent-soft px-4 py-4">
                  {offeringsLoading ? (
                    <View className="items-center py-2">
                      <ActivityIndicator color={CM.accent} />
                      <Text className="mt-2 text-center text-[12px] text-cm-accent">
                        {t("paywallLoadOfferings", languageCode)}
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text className="text-center text-[15px] font-semibold text-cm-ink">{monthlyLabel}</Text>
                      <Text className="text-center text-[15px] font-semibold text-cm-ink">{yearlyLabel}</Text>
                      <Text className="text-center text-[15px] font-semibold text-cm-ink">{lifetimeLabel}</Text>
                      <Text className="mt-1 text-center text-[12px] font-medium text-cm-ink-secondary">
                        {t("upgradeModalTrialNote", languageCode)}
                      </Text>
                    </>
                  )}
                  {offeringsError && !offeringsError.includes("not configured") ? (
                    <Text className="mt-2 text-center text-[12px] text-cm-warn">
                      Couldn&apos;t load live prices — shown amounts are indicative. Check your connection.
                    </Text>
                  ) : null}
                </View>
              </View>

              <View className="gap-4 bg-cm-surface px-6 py-6">
                <CommunityToolNotice />
                <LegalDisclaimer compact showPolicyLinks />
                {lastError ? (
                  <View className="rounded-2xl border border-red-900/50 bg-red-950/40 px-3 py-2.5">
                    <Text className="text-center text-xs leading-5 text-red-200">{lastError}</Text>
                  </View>
                ) : null}
                <PremiumPressable
                  variant="primary"
                  className={`w-full shadow-cm-glow-sm ${busy ? "opacity-60" : ""}`}
                  onPress={() => void onStartTrial()}
                  disabled={busy}
                >
                  {purchasingPlan === "monthly" ? (
                    <ActivityIndicator color={CM.onAccent} />
                  ) : (
                    <Text className={BTN_PRIMARY_TEXT}>{t("startFreeTrialCta", languageCode)}</Text>
                  )}
                </PremiumPressable>

                <PremiumPressable
                  variant="secondaryAccent"
                  className={`w-full ${busy ? "opacity-60" : ""}`}
                  onPress={() => void onYearly()}
                  disabled={busy}
                >
                  {purchasingPlan === "yearly" ? (
                    <ActivityIndicator color={CM.accent} />
                  ) : (
                    <Text className="text-center text-[16px] font-bold text-cm-accent">
                      {t("subscribeYearlyCta", languageCode)}
                    </Text>
                  )}
                </PremiumPressable>
                <PremiumPressable
                  variant="secondary"
                  className={`w-full ${busy ? "opacity-60" : ""}`}
                  onPress={() => void onLifetime()}
                  disabled={busy}
                >
                  {purchasingPlan === "lifetime" ? (
                    <ActivityIndicator color={CM.inkSecondary} />
                  ) : (
                    <Text className="text-center text-[16px] font-bold text-cm-ink-secondary">Buy Lifetime</Text>
                  )}
                </PremiumPressable>

                <PremiumPressable
                  variant="none"
                  className="min-h-14 w-full justify-center rounded-full border-[1.5px] border-cm-cyan/40 bg-cm-cyan-dim px-8 py-4 shadow-cm-inner"
                  onPress={() => setShowLaunchCode((v) => !v)}
                >
                  <Text className="text-center text-[15px] font-bold leading-5 text-cm-cyan">
                    {t("launch500CtaLine", languageCode)}
                  </Text>
                </PremiumPressable>

                {showLaunchCode ? (
                  <View className="mt-1">
                    <LaunchCodeSection
                      onLifetimeSuccess={() => {
                        setShowLaunchCode(false);
                        closeUpgradeModal();
                      }}
                    />
                  </View>
                ) : null}

                <DisclaimerFooter className="mt-2 border-t-0 pt-2" />
                <PremiumPressable variant="tertiary" className="w-full" onPress={onMaybeLater} disabled={purchasingPlan !== null}>
                  <Text className="text-center text-[16px] font-semibold text-cm-ink-secondary">Maybe later</Text>
                </PremiumPressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </ModalBackdrop>
    </Modal>
  );
};
