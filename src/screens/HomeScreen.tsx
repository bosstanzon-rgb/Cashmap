import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScrollView as GHScrollView } from "react-native-gesture-handler";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as Battery from "expo-battery";
import Constants from "expo-constants";
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  SHIFT_PROMPT_PENDING_KEY,
  SHIFT_PROMPT_SNOOZE_DATE_KEY,
} from "@/constants/storage";
import { useAppStore } from "@/store/useAppStore";
import { selectEntitledToPro, useProStore } from "@/store/proStore";
import { useMileageStore } from "@/store/mileageStore";
import { usePredictBestZones } from "@/hooks/usePredictBestZones";
import { useZoneAdvice } from "@/hooks/useZoneAdvice";
import { formatMoney, getMarketConfig, getPlatformLink } from "@/constants/markets";
import { formatDrivingOptionLabel, rankDrivingOptions } from "@/lib/rankDrivingOptions";
import { basePlatformFromSegment, formatPingSegmentLabel } from "@/lib/locationPingSegments";
import { t } from "@/constants/i18n";
import {
  BACKGROUND_LOCATION_PERMISSION_ERROR,
  LOCATION_CONSENT_REQUIRED,
  startBackgroundLocationTracking,
  startWorkingMileageTracking,
  stopBackgroundLocationTracking,
  stopWorkingMileageTracking,
  enforceAutoPauseAfterInactivity,
} from "@/services/locationTasks";
import { insertShiftLog } from "@/services/supabase";
import { scheduleAppAlert } from "@/services/alerts";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { CommunityToolNotice } from "@/components/CommunityToolNotice";
import { DisclaimerFooter } from "@/components/DisclaimerFooter";
import { MvpDisclaimerBanner } from "@/components/MvpDisclaimerBanner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { PlatformGlyph } from "@/lib/platformVisuals";
import { GOOGLE_MAP_DARK_STYLE } from "@/theme/googleMapDarkStyle";
import { zoneHeatRgba } from "@/lib/zoneHeatColors";
import { ModalBackdrop } from "@/components/ModalBackdrop";
import { PremiumPressable } from "@/components/PremiumPressable";
import { BTN_ICON, BTN_PRIMARY_TEXT } from "@/constants/buttonStyles";
import { CM, INPUT_PLACEHOLDER } from "@/constants/theme";
import { getGoogleMapsApiKey } from "@/config/env";

/** Default map camera — Johannesburg CBD (heatmap / Gauteng focus). */
const JOHANNESBURG_REGION = {
  latitude: -26.2041,
  longitude: 28.0473,
  latitudeDelta: 0.14,
  longitudeDelta: 0.14,
};

export const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [toast, setToast] = useState<{
    title: string;
    body: string;
    platform?: string;
    tierId?: string;
  } | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<{ timestamp: string; lat: number; lng: number } | null>(
    null
  );
  const [earnings, setEarnings] = useState("");
  const [deliveries, setDeliveries] = useState(0);
  const [rating, setRating] = useState<"Great day" | "Average" | "Slow day">("Average");
  const [summaryPlatforms, setSummaryPlatforms] = useState<string[]>([]);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [shiftSaving, setShiftSaving] = useState(false);
  const [mapLegalOpen, setMapLegalOpen] = useState(false);
  const {
    isWorking,
    setWorking,
    setTracking,
    selectedPlatforms,
    userId,
    marketCode,
    zoneAlertsEnabled,
    weatherTipsEnabled,
    dailyShiftPromptEnabled,
    languageCode,
    trackMileageWhenWorking,
    rideHailQualifiedTierIds,
    rideHailActiveTierId,
    appSwitchTipsEnabled,
    setRideHailActiveTier,
    hasLocationConsent,
    shareAnonymousHeatmapData,
  } = useAppStore();
  const isPro = useProStore(selectEntitledToPro);
  const openUpgradeModal = useProStore((s) => s.openUpgradeModal);
  const todayKm = useMileageStore((s) => s.todayKm);
  const weeklyKm = useMileageStore((s) => s.weeklyKm);
  const refreshMileage = useMileageStore((s) => s.refreshAll);
  const setMileageTracking = useMileageStore((s) => s.setIsTracking);
  const market = getMarketConfig(marketCode);
  const hasGoogleMapsKey = Boolean(
    getGoogleMapsApiKey() ||
      Constants.expoConfig?.android?.config?.googleMaps?.apiKey ||
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
  );
  const defaultPrimary = (selectedPlatforms.length > 0
    ? selectedPlatforms
    : market.primaryPlatforms
  ).slice(0, 3);
  const fakePlatformScores = [
    { platform: defaultPrimary[0] ?? "Platform A", suburb: market.defaultSuburbs[0] ?? market.city, score: 9.2, est: 320 },
    { platform: defaultPrimary[1] ?? "Platform B", suburb: market.defaultSuburbs[1] ?? market.city, score: 8.1, est: 280 },
    { platform: defaultPrimary[2] ?? "Platform C", suburb: market.defaultSuburbs[2] ?? market.city, score: 7.9, est: 260 },
  ];
  const [selectedPlatform, setSelectedPlatform] = useState<string>(defaultPrimary[0] ?? "Platform A");
  const { predictedZones, allPredictedZones, refresh: refreshPredictions } = usePredictBestZones({
    selectedPlatform,
    location: currentLocation,
    marketCode,
  });
  const {
    zones: realtimeZones,
    getTopZoneForPlatform,
    getTopZoneForSegment,
    refresh: refreshZoneAdvice,
  } = useZoneAdvice({ selectedPlatform, location: currentLocation, marketCode });

  useEffect(() => {
    const paramPlatform = (route as { params?: { platform?: string } }).params?.platform;
    if (
      paramPlatform &&
      defaultPrimary.includes(paramPlatform)
    ) {
      setSelectedPlatform(paramPlatform);
    }
  }, [defaultPrimary, route]);
  const seenHighZoneRef = useRef<string | null>(null);
  const weatherNotifiedRef = useRef<string | null>(null);
  const lowBatteryRef = useRef<string | null>(null);
  const lastAppSwitchNotifyRef = useRef<string | null>(null);

  const drivingRank = useMemo(
    () =>
      rankDrivingOptions({
        selectedPlatforms,
        rideHailQualifiedTierIds,
        rideHailActiveTierId,
        getTopZoneForPlatform,
        getTopZoneForSegment,
        allPredictedZones,
        userLocation: currentLocation,
        selectedPlatformTab: selectedPlatform,
      }),
    [
      selectedPlatforms,
      rideHailQualifiedTierIds,
      rideHailActiveTierId,
      getTopZoneForPlatform,
      getTopZoneForSegment,
      allPredictedZones,
      currentLocation,
      selectedPlatform,
    ]
  );
  const recommendedPlatforms = useMemo(() => {
    const top = drivingRank.ranked.slice(0, 5);
    const uniq: string[] = [];
    for (const row of top) {
      if (!uniq.includes(row.platform)) uniq.push(row.platform);
      if (uniq.length >= 3) break;
    }
    return uniq;
  }, [drivingRank.ranked]);

  const bestNow = useMemo(() => {
    const top = drivingRank.ranked[0];
    if (top) {
      return {
        platform: top.platform,
        displayName: formatDrivingOptionLabel(top),
        suburb: top.suburb,
        score: top.score,
        est: top.estMidRph,
        tierId: top.tierId,
      };
    }
    const realtimeTop = getTopZoneForPlatform(selectedPlatform);
    if (realtimeTop) {
      const base = basePlatformFromSegment(realtimeTop.platform);
      return {
        platform: base,
        displayName: formatPingSegmentLabel(realtimeTop.platform),
        suburb: realtimeTop.suburb,
        score: realtimeTop.score,
        est: Math.round((realtimeTop.estimatedMinRph + realtimeTop.estimatedMaxRph) / 2),
      };
    }
    const active = new Set(selectedPlatforms);
    const predictedBestRaw = allPredictedZones
      .filter((row) => active.has(basePlatformFromSegment(row.platform)))
      .sort((a, b) => b.predictedScore - a.predictedScore)[0];
    if (predictedBestRaw) {
      const base = basePlatformFromSegment(predictedBestRaw.platform);
      return {
        platform: base,
        displayName: formatPingSegmentLabel(predictedBestRaw.platform),
        suburb: predictedBestRaw.suburb,
        score: predictedBestRaw.predictedScore,
        est: Math.round((predictedBestRaw.predictedMinRph + predictedBestRaw.predictedMaxRph) / 2),
      };
    }
    const ranked = fakePlatformScores.filter((row) => active.has(row.platform)).sort((a, b) => b.score - a.score);
    const row = ranked[0] ?? fakePlatformScores[0];
    return {
      platform: row.platform,
      displayName: row.platform,
      suburb: row.suburb,
      score: row.score,
      est: row.est,
    };
  }, [drivingRank.ranked, allPredictedZones, fakePlatformScores, getTopZoneForPlatform, selectedPlatform, selectedPlatforms]);

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setCurrentLocation({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
        });
      }
      await Promise.all([refreshZoneAdvice(), refreshPredictions(), checkShiftPrompt()]);
    } finally {
      setRefreshing(false);
    }
  };

  const toggleWorking = async () => {
    setBusy(true);
    try {
      await enforceAutoPauseAfterInactivity();
      if (isWorking) {
        await stopWorkingMileageTracking();
        await stopBackgroundLocationTracking();
        setWorking(false);
        setTracking(false);
        setMileageTracking(false);
        await useMileageStore.getState().refreshLocalTotals();
      } else {
        if (!trackMileageWhenWorking) {
          Alert.alert(
            "CashMap",
            "Enable automatic mileage tracking in Settings to track your kilometres."
          );
          setBusy(false);
          return;
        }
        await startWorkingMileageTracking();
        if (shareAnonymousHeatmapData && hasLocationConsent) {
          await startBackgroundLocationTracking();
        }
        setWorking(true);
        setTracking(true);
        setMileageTracking(true);
        await useMileageStore.getState().refreshLocalTotals();
        void useMileageStore.getState().refreshWeekly();
      }
    } catch (e) {
      if (e instanceof Error && e.message === BACKGROUND_LOCATION_PERMISSION_ERROR) {
        setToast({
          title: t("errStartTrackingTitle", languageCode),
          body: t("errBackgroundLocation", languageCode),
        });
        setTimeout(() => setToast(null), 5000);
      } else if (e instanceof Error && e.message === LOCATION_CONSENT_REQUIRED) {
        setToast({
          title: "CashMap",
          body: "Turn on location consent in Settings first so CashMap can track mileage for your tax records.",
        });
        setTimeout(() => setToast(null), 5000);
      }
    } finally {
      setBusy(false);
    }
  };

  const checkShiftPrompt = async (force = false) => {
    if (!force && !dailyShiftPromptEnabled) return;
    const raw = await AsyncStorage.getItem(SHIFT_PROMPT_PENDING_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { timestamp: string; lat: number; lng: number };
      setPendingPrompt(parsed);
      // Prefill with today's active platforms (editable).
      setSummaryPlatforms(selectedPlatforms);
    } catch {
      await AsyncStorage.removeItem(SHIFT_PROMPT_PENDING_KEY);
    }
  };

  const forceShiftLogger = (route as { params?: { forceShiftLogger?: boolean } }).params?.forceShiftLogger;

  useEffect(() => {
    void refreshAll();
    void checkShiftPrompt();
    void refreshMileage();
    const appSub = AppState.addEventListener("change", (state) => {
      if (state === "active") void checkShiftPrompt();
    });
    const notifSub = Notifications.addNotificationReceivedListener((event) => {
      const platformRaw = event.request.content.data?.platform;
      const tierRaw = event.request.content.data?.tierId;
      setToast({
        title: event.request.content.title ?? t("alertDefaultTitle", languageCode),
        body: event.request.content.body ?? "",
        platform: typeof platformRaw === "string" ? platformRaw : undefined,
        tierId: typeof tierRaw === "string" && tierRaw.length > 0 ? tierRaw : undefined,
      });
      setTimeout(() => setToast(null), 4000);
    });
    return () => {
      appSub.remove();
      notifSub.remove();
    };
  }, [dailyShiftPromptEnabled, languageCode, selectedPlatforms, summaryPlatforms.length]);

  useEffect(() => {
    if (!forceShiftLogger) return;
    void checkShiftPrompt(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceShiftLogger]);

  useEffect(() => {
    const top = predictedZones[0];
    if (!top || !zoneAlertsEnabled || !isPro) return;
    if (top.predictedScore >= 9 && seenHighZoneRef.current !== top.id) {
      void scheduleAppAlert({
        type: "zone",
        title: t("notifyGoldenZoneTitle", languageCode, { suburb: top.suburb }),
        body: t("notifyGoldenZoneBody", languageCode),
        data: { targetTab: "HomeMap" },
      });
      seenHighZoneRef.current = top.id;
    }
  }, [predictedZones, zoneAlertsEnabled, languageCode, isPro]);

  useEffect(() => {
    const hour = new Date().getHours();
    const top = predictedZones[0];
    if (!top || !weatherTipsEnabled || !isPro) return;
    if (hour >= 18 && hour <= 22 && top.predictedScore >= 8.5) {
      const key = `${new Date().toISOString().slice(0, 10)}-${hour}`;
      if (weatherNotifiedRef.current === key) return;
      void scheduleAppAlert({
        type: "weather",
        title: t("notifyEveningSurgeTitle", languageCode),
        body: t("notifyEveningSurgeBody", languageCode),
        data: { targetTab: "HomeMap" },
      });
      weatherNotifiedRef.current = key;
    }
  }, [predictedZones, weatherTipsEnabled, languageCode, isPro]);

  useEffect(() => {
    const checkBattery = async () => {
      if (!isWorking || !zoneAlertsEnabled || !isPro) return;
      const level = await Battery.getBatteryLevelAsync();
      if (level > 0.2) return;
      const today = new Date().toISOString().slice(0, 10);
      if (lowBatteryRef.current === today) return;
      await scheduleAppAlert({
        type: "battery",
        title: t("notifyChargeUpTitle", languageCode),
        body: t("notifyChargeUpBody", languageCode),
        data: { targetTab: "HomeMap" },
      });
      lowBatteryRef.current = today;
    };
    void checkBattery();
  }, [isWorking, zoneAlertsEnabled, languageCode, isPro]);

  useEffect(() => {
    if (!isWorking) return;
    if (shareAnonymousHeatmapData && hasLocationConsent) {
      void startBackgroundLocationTracking();
    } else {
      void stopBackgroundLocationTracking();
    }
  }, [isWorking, shareAnonymousHeatmapData, hasLocationConsent]);

  useEffect(() => {
    if (!isWorking || !appSwitchTipsEnabled || !zoneAlertsEnabled || !isPro) return;
    const best = drivingRank.ranked[0];
    const cur = drivingRank.current;
    if (!best || !cur || best.key === cur.key) return;
    if (best.estMidRph < cur.estMidRph * 1.12) return;
    const bucket = Math.floor(Date.now() / 900000);
    const nKey = `${best.key}-vs-${cur.key}-${bucket}`;
    if (lastAppSwitchNotifyRef.current === nKey) return;
    lastAppSwitchNotifyRef.current = nKey;
    void scheduleAppAlert({
      type: "app_switch",
      title: t("notifyBetterOptionTitle", languageCode, { option: formatDrivingOptionLabel(best) }),
      body: t("notifyBetterOptionBody", languageCode, { option: formatDrivingOptionLabel(best) }),
      data: {
        platform: best.platform,
        tierId: best.tierId ?? "",
        targetTab: "HomeMap",
      },
    });
  }, [
    isWorking,
    appSwitchTipsEnabled,
    zoneAlertsEnabled,
    drivingRank.ranked,
    drivingRank.current,
    languageCode,
    isPro,
  ]);

  const saveShiftSummary = async () => {
    if (!pendingPrompt) return;
    if (shiftSaving) return;
    try {
      setShiftSaving(true);
      setSummaryError(null);

      const earningsValue = earnings.trim() ? Number(earnings) : undefined;
      const earningsNum = earningsValue !== undefined && Number.isFinite(earningsValue) ? earningsValue : undefined;
      const deliveriesNum = deliveries > 0 ? deliveries : undefined;

      if (shareAnonymousHeatmapData) {
        const dateIso = new Date(pendingPrompt.timestamp).toISOString().slice(0, 10);
        await insertShiftLog({
          date: dateIso,
          approxZone: bestNow.suburb,
          earnings: earningsNum,
          deliveries: deliveriesNum,
          platforms: summaryPlatforms.length > 0 ? summaryPlatforms : [],
          rating,
        });
      } else {
        Alert.alert("CashMap", t("shiftSummaryNotUploaded", languageCode));
      }
      await AsyncStorage.removeItem(SHIFT_PROMPT_PENDING_KEY);
      setPendingPrompt(null);
      setSummaryError(null);
      setEarnings("");
      setDeliveries(0);
      setRating("Average");
      setShiftSaving(false);
    } catch (error) {
      setSummaryError(
        error instanceof Error ? error.message : t("errFailedSaveSummary", languageCode)
      );
      setShiftSaving(false);
    }
  };

  const dontShowToday = async () => {
    await AsyncStorage.setItem(SHIFT_PROMPT_SNOOZE_DATE_KEY, new Date().toISOString().slice(0, 10));
    await AsyncStorage.removeItem(SHIFT_PROMPT_PENDING_KEY);
    setPendingPrompt(null);
    setSummaryError(null);
    setEarnings("");
    setDeliveries(0);
    setRating("Average");
  };

  const fabBottom = insets.bottom + 68;

  return (
    <View
      className="flex-1 bg-cm-canvas px-5"
      style={{ paddingTop: Math.max(insets.top, 10), paddingBottom: Math.max(insets.bottom, 12) }}
    >
      {toast ? (
        <View
          className="absolute left-5 right-5 z-50 rounded-2xl border border-white/10 bg-cm-raised p-4 shadow-lg"
          style={{ top: insets.top + 8 }}
        >
          <Text className="text-[15px] font-semibold leading-5 text-cm-accent">{toast.title}</Text>
          <Text className="mt-2 text-[13px] leading-5 text-cm-ink-secondary">{toast.body}</Text>
          <PremiumPressable
            variant="primary"
            className="mt-3 w-full"
            onPress={() => {
              if (toast.platform && selectedPlatforms.includes(toast.platform)) {
                setSelectedPlatform(toast.platform);
                if (toast.tierId) setRideHailActiveTier(toast.platform, toast.tierId);
              }
              setToast(null);
            }}
          >
            <Text className={`${BTN_PRIMARY_TEXT} text-[13px]`}>{t("openMap", languageCode)}</Text>
          </PremiumPressable>
        </View>
      ) : null}

      <GHScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 96) }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={Platform.OS === "android"}
      >
      <OfflineBanner />
      <MvpDisclaimerBanner className="mb-4" />

      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-[12px] leading-4 text-cm-ink-tertiary">Select your platform to see live zone data for that app</Text>
        {lastUpdated ? (
          <Text className="text-[11px] text-cm-ink-tertiary">
            Updated {new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        ) : null}
      </View>
      <View className="mb-4 flex-row gap-2 rounded-2xl border border-white/10 bg-cm-surface p-1.5">
        {defaultPrimary.map((platform) => (
          <PremiumPressable
            key={platform}
            variant="chip"
            className={`flex-1 flex-row items-center justify-center gap-1 px-1 py-1 rounded-xl ${
              selectedPlatform === platform ? "bg-cm-accent" : "bg-transparent"
            }`}
            onPress={() => setSelectedPlatform(platform)}
          >
            <PlatformGlyph name={platform} size="sm" />
            <Text
              numberOfLines={1}
              className={`max-w-[80%] text-center text-[12px] font-bold ${
                selectedPlatform === platform ? "text-cm-on-accent" : "text-cm-ink-secondary"
              }`}
            >
              {platform}
            </Text>
          </PremiumPressable>
        ))}
      </View>

      {/* Primary “I’m Working” control — starts background mileage task (Haversine) + optional heatmap pings */}
      <View className="mb-4 rounded-2xl border border-white/10 bg-cm-surface p-5 shadow-cm-card">
        <View className="mb-3 flex-row items-center justify-between">
          <View>
            <Text className="text-[13px] font-bold text-cm-ink">{isWorking ? "Shift in progress" : "Start your shift"}</Text>
            <Text className="text-[11px] text-cm-ink-tertiary">{isWorking ? "Tracking active" : "Tap below to begin"}</Text>
          </View>
          <View className="items-end">
            <Text className="text-[22px] font-bold tabular-nums text-cm-accent">{todayKm.toFixed(1)} km</Text>
            <Text className="text-[10px] text-cm-ink-tertiary">today · {weeklyKm.toFixed(1)} km week</Text>
          </View>
        </View>
        <PremiumPressable
          variant="hero"
          className={`w-full ${busy ? "bg-cm-muted shadow-none" : isWorking ? "border-transparent bg-cm-accent shadow-cm-glow" : "border-[1.5px] border-white/10 bg-cm-raised shadow-cm-inner"}`}
          onPress={() => void toggleWorking()}
          disabled={busy || (!trackMileageWhenWorking && !isWorking)}
        >
          {busy ? (
            <View className="flex-row items-center justify-center gap-3">
              <ActivityIndicator color={CM.accent} />
              <Text className="text-[18px] font-bold text-cm-ink-secondary">{t("updating", languageCode)}</Text>
            </View>
          ) : (
            <View className="items-center py-1">
              <Text
                className={`text-center text-[20px] font-bold tracking-tight ${isWorking ? "text-cm-on-accent" : "text-cm-ink"}`}
              >
                {isWorking ? t("trackingToggleOn", languageCode) : t("trackingToggleOff", languageCode)}
              </Text>
              <Text
                className={`mt-1 text-center text-[13px] leading-5 ${isWorking ? "text-cm-on-accent/80" : "text-cm-ink-secondary"}`}
              >
                {isWorking ? t("trackingToggleHintOn", languageCode) : t("trackingToggleHintOff", languageCode)}
              </Text>
            </View>
          )}
        </PremiumPressable>
        <Text className="mt-3 text-center text-[11px] leading-4 text-cm-ink-tertiary">{t("workingHint", languageCode)}</Text>
      </View>
      {/* Quick zone summary — most valuable info above the fold */}
      {bestNow && isWorking ? (
        <View className="mb-4 rounded-2xl border border-cm-accent/25 bg-cm-accent-soft p-4">
          <Text className="text-[11px] font-bold uppercase tracking-widest text-cm-accent">Best zone right now</Text>
          <View className="mt-2 flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-[17px] font-bold text-cm-ink">{bestNow.suburb}</Text>
              <Text className="mt-0.5 text-[13px] text-cm-ink-secondary">{bestNow.displayName}</Text>
            </View>
            {isPro ? (
              <Text className="text-[20px] font-bold text-cm-accent">~{formatMoney(bestNow.est, marketCode)}/hr</Text>
            ) : (
              <PremiumPressable variant="none" className="rounded-full border border-cm-accent/40 bg-cm-canvas px-4 py-2" onPress={() => openUpgradeModal()}>
                <Text className="text-[12px] font-bold text-cm-accent">Unlock R/hr →</Text>
              </PremiumPressable>
            )}
          </View>
        </View>
      ) : null}

      {!isPro ? (
        <PremiumPressable
          variant="none"
          className="mb-4 min-h-14 w-full justify-center rounded-full border-[1.5px] border-cm-cyan/35 bg-cm-cyan-dim px-6 py-5 shadow-cm-inner"
          onPress={() => openUpgradeModal()}
        >
          <View>
            <Text className="text-[16px] font-bold leading-6 text-cm-ink">
              {t("launchGiveawayBannerHeadline", languageCode)}
            </Text>
            <Text className="mt-2 text-[14px] leading-5 text-cm-cyan">{t("launchGiveawayBannerSub", languageCode)}</Text>
            <Text className="mt-3 text-[13px] font-bold uppercase tracking-wide text-cm-cyan">{t("launchGiveawayBannerTap", languageCode)}</Text>
          </View>
        </PremiumPressable>
      ) : null}
      {drivingRank.ranked.length >= 1 &&
      drivingRank.current &&
      drivingRank.ranked[0] &&
      drivingRank.ranked[0].key !== drivingRank.current.key &&
      drivingRank.ranked[0].estMidRph >= drivingRank.current.estMidRph * 1.08 ? (
        isPro ? (
          <View className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-950/30 px-4 py-4">
            <Text className="text-[11px] font-bold uppercase tracking-wider text-amber-200/95">{t("smartPickTitle", languageCode)}</Text>
            <Text className="mt-2 text-[13px] leading-5 text-amber-50/95">
              {t("smartPickBody", languageCode, {
                winner: formatDrivingOptionLabel(drivingRank.ranked[0]),
                current: formatDrivingOptionLabel(drivingRank.current),
              })}
            </Text>
            <PremiumPressable
              variant="none"
              className="mt-3 self-start min-h-12 justify-center rounded-full bg-amber-400 px-8 py-3.5 shadow-cm-glow-sm"
              onPress={() => {
                const w = drivingRank.ranked[0];
                setSelectedPlatform(w.platform);
                if (w.tierId) setRideHailActiveTier(w.platform, w.tierId);
              }}
            >
              <Text className="text-center text-[14px] font-bold text-cm-on-accent">{t("smartPickFocus", languageCode)}</Text>
            </PremiumPressable>
          </View>
        ) : (
          <PremiumPressable
            variant="none"
            className="mb-4 min-h-14 w-full justify-center rounded-[28px] border-[1.5px] border-amber-600/40 bg-amber-950/30 px-5 py-4 shadow-cm-inner"
            onPress={() => openUpgradeModal()}
          >
            <Text className="text-[11px] font-bold uppercase tracking-wider text-amber-200">{t("smartPickTitle", languageCode)}</Text>
            <Text className="mt-2 text-[13px] leading-5 text-amber-100/90">{t("homeEarningsLocked", languageCode)}</Text>
          </PremiumPressable>
        )
      ) : null}
      <View className="mb-3 flex-row items-center gap-3 rounded-xl border border-cm-accent/20 bg-cm-accent-soft px-4 py-3">
        <Text className="min-w-0 flex-1 text-[12px] leading-5 text-cm-cyan/90">
          {t("privacyBanner", languageCode)}
        </Text>
        <PremiumPressable
          variant={refreshing ? "none" : "primary"}
          className={
            refreshing
              ? "min-h-14 shrink-0 justify-center rounded-full bg-cm-muted px-7 py-4 shadow-cm-inner"
              : "shrink-0 px-7"
          }
          disabled={refreshing}
          onPress={() => void refreshAll()}
        >
          <Text className={`text-center text-[13px] font-bold uppercase tracking-wide ${refreshing ? "text-cm-ink-tertiary" : "text-cm-on-accent"}`}>
            {refreshing ? t("refreshing", languageCode) : t("refresh", languageCode)}
          </Text>
        </PremiumPressable>
      </View>
      <Text className="mb-2 text-[12px] leading-4 text-cm-ink-tertiary">Live heatmap — green zones have high demand, red zones are busy with drivers</Text>
      <View className="relative mb-3 h-72 overflow-hidden rounded-2xl border border-white/10 bg-cm-raised shadow-cm-card">
        <View className="absolute right-2 top-2 z-10 rounded-2xl border border-cm-accent/25 bg-cm-surface/90 px-3 py-1.5 shadow-cm-glow-sm" pointerEvents="none">
          <Text className="text-[10px] font-bold uppercase tracking-wide text-cm-ink-tertiary">Today</Text>
          <Text className="text-[16px] font-extrabold tabular-nums text-cm-accent">{todayKm.toFixed(1)} km</Text>
        </View>
        {hasGoogleMapsKey ? (
          <MapView
            provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
            style={{ flex: 1, backgroundColor: CM.raised }}
            initialRegion={JOHANNESBURG_REGION}
            customMapStyle={GOOGLE_MAP_DARK_STYLE}
            scrollEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            zoomEnabled
            loadingEnabled
            loadingIndicatorColor={CM.accent}
          >
            {realtimeZones.map((zone) => {
              const heat = zoneHeatRgba(zone.score);
              return (
                <Circle
                  key={zone.id}
                  center={{ latitude: zone.centerLat, longitude: zone.centerLng }}
                  radius={900}
                  fillColor={heat.fill}
                  strokeColor={heat.stroke}
                  strokeWidth={2}
                />
              );
            })}
            {realtimeZones.map((zone) => (
              <Marker
                key={`m-${zone.id}`}
                coordinate={{ latitude: zone.centerLat, longitude: zone.centerLng }}
                title={
                  isPro
                    ? `${formatMoney(zone.estimatedMinRph, marketCode)}-${formatMoney(zone.estimatedMaxRph, marketCode)}/hr - ${zone.competitionLabel}`
                    : t("mapMarkerTitleLocked", languageCode)
                }
                description={
                  isPro
                    ? `${formatPingSegmentLabel(zone.platform)} · ${zone.suburb} · ~${zone.driverCount} drivers`
                    : `${formatPingSegmentLabel(zone.platform)} · ${zone.suburb} · ${t("mapMarkerDriversLocked", languageCode)}`
                }
              />
            ))}
            {/* Pro: two prediction rings; Free: one faint teaser ring */}
            {(isPro ? predictedZones.slice(0, 2) : predictedZones.slice(0, 1)).map((zone) => (
              <Circle
                key={`pred-${zone.id}`}
                center={{ latitude: zone.centerLat, longitude: zone.centerLng }}
                radius={650}
                fillColor={isPro ? "rgba(0, 229, 255, 0.16)" : "rgba(0, 229, 255, 0.05)"}
                strokeColor={isPro ? "rgba(0, 229, 255, 0.82)" : "rgba(0, 229, 255, 0.32)"}
                strokeWidth={isPro ? 1 : 1}
              />
            ))}
          </MapView>
        ) : (
          <View className="flex-1 items-center justify-center bg-cm-raised px-5">
            <Text className="text-[32px]">🗺️</Text>
            <Text className="mt-3 text-center text-[15px] font-bold text-cm-ink">Map not available</Text>
            <Text className="mt-2 text-center text-[13px] leading-5 text-cm-ink-secondary">
              A Google Maps API key is required to show the live map. Add GOOGLE_MAPS_API_KEY to your .env file and rebuild.
            </Text>
          </View>
        )}
        {hasGoogleMapsKey && realtimeZones.length === 0 ? (
          <View className="absolute bottom-3 left-3 right-3 rounded-xl border border-white/10 bg-cm-surface/90 px-4 py-3" pointerEvents="none">
            <Text className="text-center text-[12px] leading-5 text-cm-ink-secondary">
              No zone data yet — data builds up as more drivers use CashMap in your area. Start a shift to contribute!
            </Text>
          </View>
        ) : null}

        {/* Floating “best platforms” snapshot — quick read while map is visible */}
        {drivingRank.ranked.length > 0 ? (
          <View className="absolute bottom-2 left-2 right-2" pointerEvents="box-none" style={{ elevation: 6 }}>
            <View className="rounded-2xl border border-white/15 bg-cm-surface/95 px-3 py-3 shadow-cm-card" pointerEvents="auto">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-cm-accent">Best platforms right now</Text>
              {drivingRank.ranked.slice(0, 3).map((row, idx) => (
                <View key={row.key} className={`mt-1.5 flex-row items-center gap-2 ${idx > 0 ? "opacity-95" : ""}`}>
                  <Text className="w-4 text-center text-[11px] font-bold text-cm-ink-tertiary">{idx + 1}</Text>
                  <PlatformGlyph name={row.platform} size="sm" />
                  <Text className="min-w-0 flex-1 text-[12px] font-semibold text-cm-ink" numberOfLines={1}>
                    {formatDrivingOptionLabel(row)}
                  </Text>
                  {isPro ? (
                    <Text className="text-[11px] font-bold text-cm-accent">
                      ~{formatMoney(row.estMidRph, marketCode)}/hr
                    </Text>
                  ) : (
                    <PremiumPressable
                      variant="none"
                      className="min-h-10 min-w-[40px] items-center justify-center rounded-full border-[1.5px] border-cm-warn/40 bg-cm-warn-dim px-2"
                      onPress={() => openUpgradeModal()}
                    >
                      <Text className="text-[10px] font-extrabold uppercase tracking-wide text-cm-warn">Pro</Text>
                    </PremiumPressable>
                  )}
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      {/* Heatmap legend — green → red demand gradient + cyan prediction */}
      <View className="mb-3 flex-row items-center gap-4 px-1">
        <View className="flex-row items-center gap-1.5"><View className="h-2.5 w-2.5 rounded-full bg-cm-accent" /><Text className="text-[11px] text-cm-ink-tertiary">High demand</Text></View>
        <View className="flex-row items-center gap-1.5"><View className="h-2.5 w-2.5 rounded-full bg-[#FBBF24]" /><Text className="text-[11px] text-cm-ink-tertiary">Moderate</Text></View>
        <View className="flex-row items-center gap-1.5"><View className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" /><Text className="text-[11px] text-cm-ink-tertiary">High competition</Text></View>
        <View className="flex-row items-center gap-1.5"><View className="h-2.5 w-2.5 rounded-full bg-cm-cyan" /><Text className="text-[11px] text-cm-ink-tertiary">Predicted</Text></View>
      </View>
      <View className="mb-3 flex-row items-start justify-between gap-3">
        <Text className="min-w-0 flex-1 text-[12px] leading-5 text-cm-ink-secondary">
          Estimates from anonymous community data — not financial advice.
        </Text>
        <PremiumPressable
          variant="secondary"
          className="min-h-12 shrink-0 px-5 py-3"
          onPress={() => setMapLegalOpen(true)}
        >
          <Text className="text-center text-[13px] font-bold text-cm-accent">Legal</Text>
        </PremiumPressable>
      </View>
      <View className="rounded-3xl border border-cm-accent/20 bg-cm-raised/90 p-5 shadow-cm-card">
        <Text className="text-[11px] font-bold uppercase tracking-[0.2em] text-cm-accent">
          {drivingRank.ranked[0] ? t("bestNowRanked", languageCode) : t("homeBestNow", languageCode)}
        </Text>
        {isPro ? (
          <Text className="mt-3 text-[18px] font-bold leading-6 text-cm-ink">
            {bestNow.displayName} — {formatMoney(bestNow.est, marketCode)}/hr est
          </Text>
        ) : (
          <PremiumPressable
            variant="none"
            className="mt-2 w-full min-h-16 justify-center rounded-[28px] border-[1.5px] border-white/12 bg-cm-raised/60 px-5 py-4"
            onPress={() => openUpgradeModal()}
          >
            <Text className="text-center text-[18px] font-bold leading-6 text-cm-ink">
              {bestNow.displayName} — —
            </Text>
            <Text className="mt-2 text-center text-[12px] font-semibold text-cm-warn">{t("homeEarningsLocked", languageCode)}</Text>
          </PremiumPressable>
        )}
        <Text className="mt-2 text-[13px] leading-5 text-cm-ink-secondary">
          {bestNow.suburb ? `${bestNow.displayName} · ${bestNow.suburb}` : bestNow.displayName}
        </Text>
        {isPro && drivingRank.current && drivingRank.ranked[0]?.key !== drivingRank.current.key ? (
          <Text className="mt-2 text-[12px] leading-5 text-cm-cyan/90">
            {t("youreViewing", languageCode, { option: formatDrivingOptionLabel(drivingRank.current) })}
          </Text>
        ) : null}
        {recommendedPlatforms.length >= 2 ? (
          <Text className="mt-2 text-[12px] leading-5 text-cm-ink-secondary">
            {t("strongestPlatformsNow", languageCode, { platforms: `${recommendedPlatforms[0]} and ${recommendedPlatforms[1]}` })}
          </Text>
        ) : null}
        <View className="mt-4">
          <CommunityToolNotice />
        </View>
        <PremiumPressable
          variant="primary"
          className="mt-4 w-full"
          onPress={() => void Linking.openURL(getPlatformLink(bestNow.platform, marketCode))}
        >
          <Text className={BTN_PRIMARY_TEXT}>
            {t("open", languageCode)} {bestNow.displayName}
          </Text>
        </PremiumPressable>
      </View>

      {!isPro ? (
        <PremiumPressable variant="tertiary" className="mt-4 w-full" onPress={() => openUpgradeModal()}>
          <Text className="text-center text-[13px] font-bold leading-5 text-cm-ink-secondary">
            {t("proLockAdTeaser", languageCode)}
          </Text>
        </PremiumPressable>
      ) : null}

      <View className="mt-5 flex-1 justify-end">
        <View className="mt-4 rounded-2xl border border-white/10 bg-cm-surface/80 px-4 py-4">
          <Text className="text-center text-[15px] font-semibold text-cm-ink">
            {t("mileageTodayTracked", languageCode, { km: todayKm.toFixed(1) })}
          </Text>
          <Text className="mt-1.5 text-center text-[15px] font-semibold text-cm-ink-secondary">
            {t("mileageThisWeekTracked", languageCode, { km: weeklyKm.toFixed(1) })}
          </Text>
          <Text className="mt-3 text-center text-[12px] leading-5 text-amber-200/85">
            {t("mileageExportLater", languageCode)}
          </Text>
          <Text className="mt-2 text-center text-[12px] leading-5 text-cm-ink-tertiary">
            {t("mileageAnonymousTrackedDisclaimer", languageCode)}
          </Text>
        </View>
        {recommendedPlatforms.length > 0 ? (
          <Text className="mt-3 text-center text-[12px] font-semibold text-cm-accent">
            {t("cashMapRecommends", languageCode, { platforms: recommendedPlatforms.join(" • ") })}
          </Text>
        ) : null}
        <DisclaimerFooter className="mt-6 pb-2" />
      </View>
      </GHScrollView>

      <Modal visible={Boolean(pendingPrompt)} transparent animationType="slide">
        <ModalBackdrop intensity={56}>
          <View className="flex-1 justify-end">
            <View
              className="rounded-t-[32px] border border-white/10 bg-cm-surface/95 px-5 pb-8 pt-6 shadow-cm-card"
              style={{ paddingBottom: Math.max(insets.bottom, 24) }}
            >
            <View className="mb-5 h-1 w-10 self-center rounded-full bg-white/15" />
            <Text className="text-[11px] font-semibold uppercase tracking-wide text-cm-accent">End of shift</Text>
            <Text className="text-[22px] font-bold tracking-tight text-cm-ink">{t("dailyShiftSummary", languageCode)}</Text>
            <Text className="mt-2 text-[13px] leading-5 text-cm-ink-secondary">
              We think your shift may have ended (stationary ~25+ min). Log your day — saved to shift_logs when you opt in.
            </Text>
            <Text className="mt-1 text-[12px] leading-5 text-cm-ink-tertiary">{t("shiftSummaryHelp", languageCode)}</Text>
            <TextInput
              value={earnings}
              onChangeText={setEarnings}
              placeholder={`${t("totalEarnings", languageCode)} (${market.currency} ___)`}
              keyboardType="numeric"
              placeholderTextColor={INPUT_PLACEHOLDER}
              className="mt-4 rounded-3xl border border-white/10 bg-cm-raised/90 px-4 py-3.5 text-[16px] text-cm-ink shadow-cm-inner"
            />
            <View className="mt-4 flex-row flex-wrap gap-2">
              {selectedPlatforms.map((platform) => {
                const selected = summaryPlatforms.includes(platform);
                return (
                  <PremiumPressable
                    key={platform}
                    variant="chip"
                    className={`px-4 ${selected ? "border-transparent bg-cm-accent shadow-cm-glow-sm" : "border-white/10 bg-cm-raised"}`}
                    onPress={() =>
                      setSummaryPlatforms((current) =>
                        current.includes(platform)
                          ? current.filter((item) => item !== platform)
                          : [...current, platform]
                      )
                    }
                  >
                    <View className="flex-row items-center gap-1.5">
                      <PlatformGlyph name={platform} size="sm" />
                      <Text className={`text-[13px] font-bold ${selected ? "text-cm-on-accent" : "text-cm-ink-secondary"}`}>
                        {platform}
                      </Text>
                    </View>
                  </PremiumPressable>
                );
              })}
            </View>
            <View className="mt-4">
              <Text className="mb-2 text-[13px] text-cm-ink-secondary">{t("approxDeliveries", languageCode)}</Text>
              <View className="flex-row items-center gap-3">
                <TextInput
                  value={deliveries > 0 ? String(deliveries) : ""}
                  onChangeText={(v) => {
                    const n = parseInt(v, 10);
                    setDeliveries(Number.isFinite(n) && n >= 0 ? Math.min(200, n) : 0);
                  }}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={INPUT_PLACEHOLDER}
                  className="flex-1 rounded-xl border border-white/10 bg-cm-raised px-4 py-3 text-[18px] font-bold text-cm-ink"
                />
                <PremiumPressable className={BTN_ICON} onPress={() => setDeliveries((d) => Math.max(0, d - 1))}>
                  <Text className="text-xl font-semibold text-cm-ink">−</Text>
                </PremiumPressable>
                <PremiumPressable className={BTN_ICON} onPress={() => setDeliveries((d) => Math.min(200, d + 1))}>
                  <Text className="text-xl font-semibold text-cm-ink">+</Text>
                </PremiumPressable>
              </View>
            </View>
            <View className="mt-4 flex-row gap-2">
              {(["Great day", "Average", "Slow day"] as const).map((item) => (
                <PremiumPressable
                  key={item}
                  variant="chip"
                  className={`flex-1 px-2 ${rating === item ? "border-transparent bg-cm-accent shadow-cm-glow-sm" : "border-white/10 bg-cm-muted/90"}`}
                  onPress={() => setRating(item)}
                >
                  <Text
                    className={`text-center text-[12px] font-bold leading-4 ${
                      rating === item ? "text-cm-on-accent" : "text-cm-ink-secondary"
                    }`}
                  >
                    {item === "Great day" ? "😊" : item === "Average" ? "🙂" : "😕"} {item}
                  </Text>
                </PremiumPressable>
              ))}
            </View>
            {summaryError ? <Text className="mt-3 text-[13px] text-red-400">{summaryError}</Text> : null}
            <View className="mt-4">
              <CommunityToolNotice />
            </View>
            <View className="mt-4 max-h-36">
              <Text className="mb-2 text-[12px] leading-5 text-amber-200/90">
                {t("mileageAnonymousTrackedDisclaimer", languageCode)}
              </Text>
              <LegalDisclaimer compact />
            </View>
            <PremiumPressable
              variant="primary"
              className={`mt-5 w-full ${shiftSaving ? "opacity-70" : ""}`}
              disabled={shiftSaving}
              onPress={() => void saveShiftSummary()}
            >
              {shiftSaving ? (
                <ActivityIndicator color={CM.onAccent} />
              ) : (
                <Text className={BTN_PRIMARY_TEXT}>{t("saveClose", languageCode)}</Text>
              )}
            </PremiumPressable>
            <View className="mt-3 flex-row gap-3">
              <PremiumPressable
                variant="secondary"
                className="flex-1"
                onPress={() => {
                  setPendingPrompt(null);
                  setSummaryError(null);
                  setEarnings("");
                  setDeliveries(0);
                  setRating("Average");
                }}
              >
                <Text className="text-center text-[15px] font-bold tracking-tight text-cm-ink-secondary">{t("skip", languageCode)}</Text>
              </PremiumPressable>
              <PremiumPressable variant="secondary" className="flex-1" onPress={() => void dontShowToday()}>
                <Text className="text-center text-[15px] font-bold tracking-tight text-cm-ink-secondary">{t("dontShowToday", languageCode)}</Text>
              </PremiumPressable>
            </View>
          </View>
          </View>
        </ModalBackdrop>
      </Modal>

      <Modal visible={mapLegalOpen} transparent animationType="fade" onRequestClose={() => setMapLegalOpen(false)}>
        <ModalBackdrop intensity={48}>
          <Pressable
            className="flex-1 justify-end px-4"
            style={{ paddingBottom: Math.max(insets.bottom, 20), paddingTop: insets.top + 12 }}
            onPress={() => setMapLegalOpen(false)}
          >
            <Pressable
              className="max-h-[82%] rounded-3xl border border-white/[0.12] bg-cm-surface p-5 shadow-cm-card"
              onPress={(e) => e.stopPropagation()}
            >
              <Text className="text-xl font-bold tracking-tight text-cm-ink">Disclaimer</Text>
              <ScrollView
                className="mt-4 max-h-96"
                showsVerticalScrollIndicator
                nestedScrollEnabled={Platform.OS === "android"}
                keyboardShouldPersistTaps="handled"
              >
                <LegalDisclaimer showPolicyLinks />
              </ScrollView>
              <PremiumPressable variant="secondary" className="mt-5 w-full" onPress={() => setMapLegalOpen(false)}>
                <Text className="text-center text-[16px] font-bold text-cm-ink">Close</Text>
              </PremiumPressable>
            </Pressable>
          </Pressable>
        </ModalBackdrop>
      </Modal>

      <PremiumPressable
        variant="primary"
        className="absolute right-5 max-w-[88%] border-cm-accent/35 shadow-cm-glow"
        style={{ bottom: fabBottom }}
        onPress={() => void Linking.openURL(getPlatformLink(bestNow.platform, marketCode))}
      >
        <Text numberOfLines={2} className={`${BTN_PRIMARY_TEXT} text-[11px] leading-4`}>
          {t("acceptHighestPayout", languageCode, { platform: bestNow.displayName })}
        </Text>
      </PremiumPressable>
    </View>
  );
};
