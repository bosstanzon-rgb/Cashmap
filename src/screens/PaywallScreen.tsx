import { useCallback, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  checkProStatus,
  getDefaultOfferingPackages,
  mapPurchasesError,
  purchaseLifetime,
  purchaseMonthly,
  purchaseYearly,
  restorePurchases,
} from "@/services/revenuecat";
import { useAppStore } from "@/store/useAppStore";
import { computeEntitledToPro, selectEntitledToPro, selectTrialActive, useProStore } from "@/store/proStore";
import { t } from "@/constants/i18n";
import { showErrorAlert, showSuccessToast } from "@/lib/appToasts";
import { CommunityToolNotice } from "@/components/CommunityToolNotice";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { DisclaimerFooter } from "@/components/DisclaimerFooter";
import { PremiumPressable } from "@/components/PremiumPressable";
import { BTN_PRIMARY_TEXT } from "@/constants/buttonStyles";
import { CM } from "@/constants/theme";

const getFallbackPrices = (marketCode: string) => {
  if (marketCode === "ZA") return { monthly: "R59", yearly: "R499", lifetime: "R999" };
  if (marketCode === "NG") return { monthly: "₦2,500", yearly: "₦19,999", lifetime: "₦39,999" };
  if (marketCode === "KE") return { monthly: "KSh 350", yearly: "KSh 2,800", lifetime: "KSh 5,500" };
  if (marketCode === "GH") return { monthly: "GH₵ 25", yearly: "GH₵ 199", lifetime: "GH₵ 399" };
  return { monthly: "$3.99", yearly: "$29.99", lifetime: "$59.99" };
};

export const PaywallScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { languageCode, marketCode } = useAppStore();
  const entitled = useProStore(selectEntitledToPro);
  const trialActive = useProStore(selectTrialActive);
  const isLifetimePro = useProStore((s) => s.isLifetimePro);
  const [purchasing, setPurchasing] = useState<null | "monthly" | "yearly" | "lifetime" | "restore">(null);
  const [pricesLoading, setPricesLoading] = useState(true);
  const fallback = getFallbackPrices(marketCode);
  const [monthlyPrice, setMonthlyPrice] = useState(fallback.monthly);
  const [yearlyPrice, setYearlyPrice] = useState(fallback.yearly);
  const [lifetimePrice, setLifetimePrice] = useState(fallback.lifetime);

  useFocusEffect(
    useCallback(() => {
      if (useProStore.getState().isLifetimePro) {
        navigation.goBack();
      }
    }, [navigation])
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setPricesLoading(true);
      void (async () => {
        try {
          const { monthly, annual, lifetime } = await getDefaultOfferingPackages();
          if (cancelled) return;
          const m = monthly?.product.priceString?.trim();
          const y = annual?.product.priceString?.trim();
          const l = lifetime?.product.priceString?.trim();
          if (m) setMonthlyPrice(m);
          if (y) setYearlyPrice(y);
          if (l) setLifetimePrice(l);
        } catch (e) {
          if (!cancelled) {
            setMonthlyPrice(fallback.monthly);
            setYearlyPrice(fallback.yearly);
            setLifetimePrice(fallback.lifetime);
            // Always show user-friendly message, never technical "not configured" errors
            const msg = e instanceof Error
              ? e.message
              : "Could not load subscription prices. Check your connection and try again.";
            // Don't show alert for config issues — just use fallback prices silently
            if (!msg.includes("not configured")) {
              showErrorAlert(t("errSubscribeTitle", languageCode), msg);
            }
          }
        } finally {
          if (!cancelled) setPricesLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const onPlan = async (kind: "monthly" | "yearly") => {
    setPurchasing(kind);
    try {
      if (kind === "monthly") await purchaseMonthly();
      else await purchaseYearly();
      await checkProStatus();
      showSuccessToast(
        kind === "monthly"
          ? t("toastCashMapProTrialWelcome", languageCode)
          : t("toastCashMapProYearlyActivated", languageCode)
      );
      navigation.goBack();
    } catch (e) {
      const msg = mapPurchasesError(e, "Purchase cancelled.");
      if (!msg.toLowerCase().includes("cancel")) showErrorAlert(t("errSubscribeTitle", languageCode), msg);
    } finally {
      setPurchasing(null);
    }
  };

  const onLifetime = async () => {
    setPurchasing("lifetime");
    try {
      await purchaseLifetime();
      await checkProStatus();
      showSuccessToast("CashMap Pro Lifetime activated.");
      navigation.goBack();
    } catch (e) {
      const msg = mapPurchasesError(e, "Purchase cancelled.");
      if (!msg.toLowerCase().includes("cancel")) showErrorAlert(t("errSubscribeTitle", languageCode), msg);
    } finally {
      setPurchasing(null);
    }
  };

  const onRestore = async () => {
    setPurchasing("restore");
    try {
      await restorePurchases();
      await checkProStatus();
      if (computeEntitledToPro(useProStore.getState())) {
        showSuccessToast(t("toastPurchasesRestoredPro", languageCode));
        navigation.goBack();
      } else {
        showErrorAlert(t("errNoSubscriptionTitle", languageCode), t("errNoSubscriptionPaywallBody", languageCode));
      }
    } catch (e) {
      showErrorAlert(t("errRestoreFailedTitle", languageCode), mapPurchasesError(e, "Restore cancelled."));
    } finally {
      setPurchasing(null);
    }
  };

  const statusLine = isLifetimePro
    ? t("subscriptionLifetimeLine", languageCode)
    : trialActive
      ? t("subscriptionStatusTrial", languageCode)
      : entitled
        ? t("subscriptionStatusPro", languageCode)
        : t("subscriptionStatusFree", languageCode);

  if (isLifetimePro) {
    return (
      <View className="flex-1 bg-cm-canvas px-5 pt-14">
        <PremiumPressable variant="secondary" className="self-end px-7" onPress={() => navigation.goBack()}>
          <Text className="text-center text-[15px] font-bold text-cm-ink">{t("close", languageCode)}</Text>
        </PremiumPressable>
      </View>
    );
  }

  const busy = purchasing !== null;

  return (
    <ScrollView
      className="flex-1 bg-cm-canvas"
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: Math.max(insets.top, 20),
        paddingBottom: Math.max(insets.bottom, 40),
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled={Platform.OS === "android"}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-[13px] font-bold uppercase tracking-widest text-cm-accent">CashMap Pro</Text>
        <PremiumPressable variant="none" className="min-h-10 justify-center rounded-full border border-white/15 px-5 py-2" onPress={() => navigation.goBack()}>
          <Text className="text-center text-[14px] font-semibold text-cm-ink">{t("close", languageCode)}</Text>
        </PremiumPressable>
      </View>
      <Text className="mt-4 text-[28px] font-bold text-cm-ink">{t("unlockCashMapProTitle", languageCode)}</Text>
      <Text className="mt-2 text-[15px] leading-6 text-cm-ink-secondary">Everything you need to earn smarter as a gig driver in Gauteng.</Text>
      <View className="mt-5 rounded-2xl border border-white/10 bg-cm-surface p-4">
        <Text className="mb-3 text-[13px] font-bold uppercase tracking-wide text-cm-ink-tertiary">What you get with Pro</Text>
        {[
          "Live driver density — see exactly how many drivers are in each zone",
          "R/hr predictions — estimated earnings per hour by suburb and platform",
          "Surge-style zone alerts — get notified when a hot zone opens up near you",
          "Automatic km tracking — runs in the background for SARS tax deductions",
          "Weekly earnings benchmarks — see how you compare to other drivers",
          "Full shift logger + CSV tax export",
          "Ad-free experience",
        ].map((feature) => (
          <View key={feature} className="mb-2 flex-row items-start gap-3">
            <Text className="text-[16px] text-cm-accent">✓</Text>
            <Text className="flex-1 text-[14px] leading-5 text-cm-ink-secondary">{feature}</Text>
          </View>
        ))}
      </View>
      <View className="mt-4">
        <CommunityToolNotice />
      </View>
      <View className="mt-4">
        <LegalDisclaimer compact showPolicyLinks />
      </View>

      {pricesLoading ? (
        <View className="mt-4 flex-row items-center gap-2">
          <ActivityIndicator color={CM.accent} size="small" />
          <Text className="text-[12px] text-cm-ink-tertiary">Loading prices…</Text>
        </View>
      ) : null}

      <PremiumPressable
        variant="primary"
        className={`mt-8 w-full shadow-cm-glow ${busy ? "opacity-60" : ""}`}
        onPress={() => void onPlan("monthly")}
        disabled={busy}
      >
        {purchasing === "monthly" ? (
          <ActivityIndicator color={CM.onAccent} />
        ) : (
          <View className="items-center">
            <Text className={BTN_PRIMARY_TEXT}>{monthlyPrice} / month</Text>
            <Text className="mt-0.5 text-[12px] text-cm-on-accent/80">Start free 14-day trial</Text>
          </View>
        )}
      </PremiumPressable>
      <PremiumPressable
        variant="secondaryAccent"
        className={`mt-4 w-full ${busy ? "opacity-60" : ""}`}
        onPress={() => void onPlan("yearly")}
        disabled={busy}
      >
        {purchasing === "yearly" ? (
          <ActivityIndicator color={CM.accent} />
        ) : (
          <View className="items-center">
            <Text className="text-center text-[16px] font-bold text-cm-accent">{yearlyPrice} / year</Text>
            <Text className="mt-0.5 text-center text-[12px] text-cm-accent/70">Save ~30% vs monthly</Text>
          </View>
        )}
      </PremiumPressable>
      <PremiumPressable
        variant="secondary"
        className={`mt-4 w-full ${busy ? "opacity-60" : ""}`}
        onPress={() => void onLifetime()}
        disabled={busy}
      >
        {purchasing === "lifetime" ? (
          <ActivityIndicator color={CM.inkSecondary} />
        ) : (
          <View className="items-center">
            <Text className="text-center text-[16px] font-bold text-cm-ink-secondary">{lifetimePrice} once-off</Text>
            <Text className="mt-0.5 text-center text-[12px] text-cm-ink-tertiary">Pay once, keep forever</Text>
          </View>
        )}
      </PremiumPressable>
      <PremiumPressable
        variant="secondary"
        className={`mt-5 w-full ${busy ? "opacity-60" : ""}`}
        onPress={() => void onRestore()}
        disabled={busy}
      >
        {purchasing === "restore" ? (
          <ActivityIndicator color={CM.inkSecondary} />
        ) : (
          <Text className="text-center text-[16px] font-bold text-cm-ink-secondary">{t("restorePurchases", languageCode)}</Text>
        )}
      </PremiumPressable>

      <View className="mt-8 rounded-2xl border border-white/10 bg-cm-surface p-5">
        <Text className="text-[11px] font-semibold uppercase tracking-wide text-cm-ink-tertiary">
          {t("manageSubscription", languageCode)}
        </Text>
        <Text className="mt-2 text-[14px] leading-6 text-cm-ink-secondary">{statusLine}</Text>
      </View>
      <DisclaimerFooter />
    </ScrollView>
  );
};
