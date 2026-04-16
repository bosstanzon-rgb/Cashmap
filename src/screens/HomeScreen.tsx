import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Dimensions,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ScrollView as GHScrollView } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as Battery from "expo-battery";
import Constants from "expo-constants";
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import type { MapViewProps } from "react-native-maps";
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

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const getDefaultRegion = (center: { lat: number; lng: number }) => ({
  latitude: center.lat,
  longitude: center.lng,
  latitudeDelta: 0.14,
  longitudeDelta: 0.14,
});

// Bottom sheet snap points (distance from bottom of screen)
const SHEET_PEEK = 200;       // collapsed — just shows the pill + shift button
const SHEET_HALF = 420;       // half open — shows platforms + best zone
const SHEET_FULL = SCREEN_HEIGHT * 0.82; // full — shows everything

export const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapRegion, setMapRegion] = useState<{ latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null>(null);
  const mapRef = useRef<MapView>(null);
  const [mapLegalOpen, setMapLegalOpen] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string; platform?: string; tierId?: string } | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<{ timestamp: string; lat: number; lng: number } | null>(null);
  const [earnings, setEarnings] = useState("");
  const [deliveries, setDeliveries] = useState(0);
  const [rating, setRating] = useState<"Great day" | "Average" | "Slow day">("Average");
  const [summaryPlatforms, setSummaryPlatforms] = useState<string[]>([]);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [shiftSaving, setShiftSaving] = useState(false);

  // Bottom sheet animation
  const sheetY = useSharedValue(SHEET_PEEK);
  const prevY = useSharedValue(SHEET_PEEK);
  const [sheetSnap, setSheetSnap] = useState<"peek" | "half" | "full">("half");

  const snapTo = (target: "peek" | "half" | "full") => {
    const val = target === "peek" ? SHEET_PEEK : target === "half" ? SHEET_HALF : SHEET_FULL;
    sheetY.value = withSpring(val, { damping: 20, stiffness: 200, mass: 0.8 });
    setSheetSnap(target);
  };

  const panGesture = Gesture.Pan()
    .onBegin(() => { prevY.value = sheetY.value; })
    .onUpdate((e) => {
      const next = prevY.value - e.translationY;
      sheetY.value = Math.max(SHEET_PEEK, Math.min(SHEET_FULL, next));
    })
    .onEnd((e) => {
      const velocity = e.velocityY;
      const current = sheetY.value;
      if (velocity < -500 || current > (SHEET_HALF + SHEET_FULL) / 2) {
        runOnJS(snapTo)("full");
      } else if (velocity > 500 || current < (SHEET_PEEK + SHEET_HALF) / 2) {
        runOnJS(snapTo)("peek");
      } else {
        runOnJS(snapTo)("half");
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    height: sheetY.value,
  }));

  const backdropOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(sheetY.value, [SHEET_PEEK, SHEET_FULL], [0, 0.3], Extrapolation.CLAMP),
    pointerEvents: sheetY.value > SHEET_HALF ? "auto" as const : "none" as const,
  }));

  const {
    isWorking, setWorking, setTracking, selectedPlatforms, userId,
    marketCode, zoneAlertsEnabled, weatherTipsEnabled, dailyShiftPromptEnabled,
    languageCode, trackMileageWhenWorking, rideHailQualifiedTierIds,
    rideHailActiveTierId, appSwitchTipsEnabled, setRideHailActiveTier,
    hasLocationConsent, shareAnonymousHeatmapData,
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
  const defaultPrimary = selectedPlatforms.length > 0 ? selectedPlatforms : market.primaryPlatforms;
  const fakePlatformScores = [
    { platform: defaultPrimary[0] ?? "Platform A", suburb: market.defaultSuburbs[0] ?? market.city, score: 9.2, est: 320 },
    { platform: defaultPrimary[1] ?? "Platform B", suburb: market.defaultSuburbs[1] ?? market.city, score: 8.1, est: 280 },
    { platform: defaultPrimary[2] ?? "Platform C", suburb: market.defaultSuburbs[2] ?? market.city, score: 7.9, est: 260 },
  ];
  const [selectedPlatform, setSelectedPlatform] = useState<string>(defaultPrimary[0] ?? "Platform A");
  const { predictedZones, allPredictedZones, refresh: refreshPredictions } = usePredictBestZones({ selectedPlatform, location: currentLocation, marketCode });
  const { zones: realtimeZones, getTopZoneForPlatform, getTopZoneForSegment, refresh: refreshZoneAdvice, lastUpdated } = useZoneAdvice({ selectedPlatform, location: currentLocation, marketCode });

  useEffect(() => {
    const paramPlatform = (route as { params?: { platform?: string } }).params?.platform;
    if (paramPlatform && defaultPrimary.includes(paramPlatform)) setSelectedPlatform(paramPlatform);
  }, [defaultPrimary, route]);

  const seenHighZoneRef = useRef<string | null>(null);
  const weatherNotifiedRef = useRef<string | null>(null);
  const lowBatteryRef = useRef<string | null>(null);
  const lastAppSwitchNotifyRef = useRef<string | null>(null);

  const drivingRank = useMemo(
    () => rankDrivingOptions({
      selectedPlatforms, rideHailQualifiedTierIds, rideHailActiveTierId,
      getTopZoneForPlatform, getTopZoneForSegment, allPredictedZones,
      userLocation: currentLocation, selectedPlatformTab: selectedPlatform,
    }),
    [selectedPlatforms, rideHailQualifiedTierIds, rideHailActiveTierId, getTopZoneForPlatform, getTopZoneForSegment, allPredictedZones, currentLocation, selectedPlatform]
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
    if (top) return { platform: top.platform, displayName: formatDrivingOptionLabel(top), suburb: top.suburb, score: top.score, est: top.estMidRph, tierId: top.tierId };
    const realtimeTop = getTopZoneForPlatform(selectedPlatform);
    if (realtimeTop) {
      const base = basePlatformFromSegment(realtimeTop.platform);
      return { platform: base, displayName: formatPingSegmentLabel(realtimeTop.platform), suburb: realtimeTop.suburb, score: realtimeTop.score, est: Math.round((realtimeTop.estimatedMinRph + realtimeTop.estimatedMaxRph) / 2) };
    }
    const active = new Set(selectedPlatforms);
    const predictedBestRaw = allPredictedZones.filter((row) => active.has(basePlatformFromSegment(row.platform))).sort((a, b) => b.predictedScore - a.predictedScore)[0];
    if (predictedBestRaw) {
      const base = basePlatformFromSegment(predictedBestRaw.platform);
      return { platform: base, displayName: formatPingSegmentLabel(predictedBestRaw.platform), suburb: predictedBestRaw.suburb, score: predictedBestRaw.predictedScore, est: Math.round((predictedBestRaw.predictedMinRph + predictedBestRaw.predictedMaxRph) / 2) };
    }
    const ranked = fakePlatformScores.filter((row) => active.has(row.platform)).sort((a, b) => b.score - a.score);
    const row = ranked[0] ?? fakePlatformScores[0];
    return { platform: row.platform, displayName: row.platform, suburb: row.suburb, score: row.score, est: row.est };
  }, [drivingRank.ranked, allPredictedZones, fakePlatformScores, getTopZoneForPlatform, selectedPlatform, selectedPlatforms]);

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setCurrentLocation(coords);
        setMapRegion({ latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.1, longitudeDelta: 0.1 });
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
        setWorking(false); setTracking(false); setMileageTracking(false);
        await useMileageStore.getState().refreshLocalTotals();
      } else {
        if (!trackMileageWhenWorking) {
          Alert.alert("CashMap", "Enable automatic mileage tracking in Settings to track your kilometres.");
          setBusy(false); return;
        }
        await startWorkingMileageTracking();
        if (shareAnonymousHeatmapData && hasLocationConsent) await startBackgroundLocationTracking();
        setWorking(true); setTracking(true); setMileageTracking(true);
        await useMileageStore.getState().refreshLocalTotals();
        void useMileageStore.getState().refreshWeekly();
        snapTo("half");
      }
    } catch (e) {
      if (e instanceof Error && e.message === BACKGROUND_LOCATION_PERMISSION_ERROR) {
        setToast({ title: t("errStartTrackingTitle", languageCode), body: t("errBackgroundLocation", languageCode) });
        setTimeout(() => setToast(null), 5000);
      } else if (e instanceof Error && e.message === LOCATION_CONSENT_REQUIRED) {
        setToast({ title: "CashMap", body: "Turn on location consent in Settings first." });
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
      setSummaryPlatforms(selectedPlatforms);
    } catch { await AsyncStorage.removeItem(SHIFT_PROMPT_PENDING_KEY); }
  };

  const forceShiftLogger = (route as { params?: { forceShiftLogger?: boolean } }).params?.forceShiftLogger;

  useEffect(() => {
    void refreshAll(); void checkShiftPrompt(); void refreshMileage();
    const appSub = AppState.addEventListener("change", (state) => { if (state === "active") void checkShiftPrompt(); });
    const notifSub = Notifications.addNotificationReceivedListener((event) => {
      const platformRaw = event.request.content.data?.platform;
      const tierRaw = event.request.content.data?.tierId;
      setToast({ title: event.request.content.title ?? t("alertDefaultTitle", languageCode), body: event.request.content.body ?? "", platform: typeof platformRaw === "string" ? platformRaw : undefined, tierId: typeof tierRaw === "string" && tierRaw.length > 0 ? tierRaw : undefined });
      setTimeout(() => setToast(null), 4000);
    });
    return () => { appSub.remove(); notifSub.remove(); };
  }, [dailyShiftPromptEnabled, languageCode, selectedPlatforms, summaryPlatforms.length]);

  useEffect(() => { if (!forceShiftLogger) return; void checkShiftPrompt(true); }, [forceShiftLogger]);

  useEffect(() => {
    const top = predictedZones[0];
    if (!top || !zoneAlertsEnabled || !isPro) return;
    if (top.predictedScore >= 9 && seenHighZoneRef.current !== top.id) {
      void scheduleAppAlert({ type: "zone", title: t("notifyGoldenZoneTitle", languageCode, { suburb: top.suburb }), body: t("notifyGoldenZoneBody", languageCode), data: { targetTab: "HomeMap" } });
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
      void scheduleAppAlert({ type: "weather", title: t("notifyEveningSurgeTitle", languageCode), body: t("notifyEveningSurgeBody", languageCode), data: { targetTab: "HomeMap" } });
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
      await scheduleAppAlert({ type: "battery", title: t("notifyChargeUpTitle", languageCode), body: t("notifyChargeUpBody", languageCode), data: { targetTab: "HomeMap" } });
      lowBatteryRef.current = today;
    };
    void checkBattery();
  }, [isWorking, zoneAlertsEnabled, languageCode, isPro]);

  useEffect(() => {
    if (!isWorking) return;
    if (shareAnonymousHeatmapData && hasLocationConsent) void startBackgroundLocationTracking();
    else void stopBackgroundLocationTracking();
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
    void scheduleAppAlert({ type: "app_switch", title: t("notifyBetterOptionTitle", languageCode, { option: formatDrivingOptionLabel(best) }), body: t("notifyBetterOptionBody", languageCode, { option: formatDrivingOptionLabel(best) }), data: { platform: best.platform, tierId: best.tierId ?? "", targetTab: "HomeMap" } });
  }, [isWorking, appSwitchTipsEnabled, zoneAlertsEnabled, drivingRank.ranked, drivingRank.current, languageCode, isPro]);

  const saveShiftSummary = async () => {
    if (!pendingPrompt || shiftSaving) return;
    try {
      setShiftSaving(true); setSummaryError(null);
      const earningsValue = earnings.trim() ? Number(earnings) : undefined;
      const earningsNum = earningsValue !== undefined && Number.isFinite(earningsValue) ? earningsValue : undefined;
      const deliveriesNum = deliveries > 0 ? deliveries : undefined;
      if (shareAnonymousHeatmapData) {
        await insertShiftLog({ date: new Date(pendingPrompt.timestamp).toISOString().slice(0, 10), approxZone: bestNow.suburb, earnings: earningsNum, deliveries: deliveriesNum, platforms: summaryPlatforms.length > 0 ? summaryPlatforms : [], rating });
      } else {
        Alert.alert("CashMap", t("shiftSummaryNotUploaded", languageCode));
      }
      await AsyncStorage.removeItem(SHIFT_PROMPT_PENDING_KEY);
      setPendingPrompt(null); setSummaryError(null); setEarnings(""); setDeliveries(0); setRating("Average"); setShiftSaving(false);
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : t("errFailedSaveSummary", languageCode));
      setShiftSaving(false);
    }
  };

  const dontShowToday = async () => {
    await AsyncStorage.setItem(SHIFT_PROMPT_SNOOZE_DATE_KEY, new Date().toISOString().slice(0, 10));
    await AsyncStorage.removeItem(SHIFT_PROMPT_PENDING_KEY);
    setPendingPrompt(null); setSummaryError(null); setEarnings(""); setDeliveries(0); setRating("Average");
  };

  const goToBusiestZone = () => {
    // Pick best zone: realtime first, then predicted
    const best = realtimeZones.sort((a, b) => b.score - a.score)[0]
      ?? allPredictedZones.sort((a, b) => b.predictedScore - a.predictedScore)[0];
    if (!best) return;
    mapRef.current?.animateToRegion({
      latitude: best.centerLat,
      longitude: best.centerLng,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    }, 800);
  };

  const goToMyLocation = () => {
    if (!currentLocation) return;
    mapRef.current?.animateToRegion({
      latitude: currentLocation.lat,
      longitude: currentLocation.lng,
      latitudeDelta: 0.06,
      longitudeDelta: 0.06,
    }, 600);
  };

  return (
    <View style={{ flex: 1, backgroundColor: CM.canvas }}>

      {/* ── FULL SCREEN MAP ── */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        {hasGoogleMapsKey ? (
          <MapView
            ref={mapRef}
            provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
            style={{ flex: 1 }}
            region={mapRegion ?? getDefaultRegion(market.defaultCenter)}
            customMapStyle={GOOGLE_MAP_DARK_STYLE}
            scrollEnabled
            pitchEnabled={false}
            rotateEnabled={false}
            zoomEnabled
            loadingEnabled
            loadingIndicatorColor={CM.accent}
          >
            {realtimeZones.map((zone) => {
              const heat = zoneHeatRgba(zone.score);
              return (
                <Circle key={zone.id} center={{ latitude: zone.centerLat, longitude: zone.centerLng }} radius={900} fillColor={heat.fill} strokeColor={heat.stroke} strokeWidth={2} />
              );
            })}
            {realtimeZones.map((zone) => (
              <Marker
                key={`m-${zone.id}`}
                coordinate={{ latitude: zone.centerLat, longitude: zone.centerLng }}
                title={isPro ? `${formatMoney(zone.estimatedMinRph, marketCode)}-${formatMoney(zone.estimatedMaxRph, marketCode)}/hr` : t("mapMarkerTitleLocked", languageCode)}
                description={isPro ? `${formatPingSegmentLabel(zone.platform)} · ${zone.suburb} · ~${zone.driverCount} drivers` : `${formatPingSegmentLabel(zone.platform)} · ${zone.suburb}`}
              />
            ))}
            {(isPro ? predictedZones.slice(0, 5) : realtimeZones.length === 0 ? predictedZones.slice(0, 3) : predictedZones.slice(0, 1)).map((zone) => (
              <Circle
                key={`pred-${zone.id}`}
                center={{ latitude: zone.centerLat, longitude: zone.centerLng }}
                radius={700}
                fillColor={isPro ? "rgba(0,229,255,0.18)" : realtimeZones.length === 0 ? "rgba(0,229,255,0.12)" : "rgba(0,229,255,0.05)"}
                strokeColor={isPro ? "rgba(0,229,255,0.85)" : realtimeZones.length === 0 ? "rgba(0,229,255,0.55)" : "rgba(0,229,255,0.32)"}
                strokeWidth={isPro ? 1.5 : 1}
              />
            ))}
            {/* User location marker */}
            {currentLocation ? (
              <Marker
                coordinate={{ latitude: currentLocation.lat, longitude: currentLocation.lng }}
                anchor={{ x: 0.5, y: 0.5 }}
                flat
              >
                <View style={{ alignItems: "center", justifyContent: "center" }}>
                  {/* Outer pulse ring */}
                  <View style={{
                    position: "absolute",
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: "rgba(0,229,255,0.15)",
                    borderWidth: 1,
                    borderColor: "rgba(0,229,255,0.4)",
                  }} />
                  {/* Inner dot */}
                  <View style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: "#00E5FF",
                    borderWidth: 2.5,
                    borderColor: "#fff",
                    shadowColor: "#00E5FF",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.9,
                    shadowRadius: 8,
                    elevation: 8,
                  }} />
                </View>
              </Marker>
            ) : null}
          </MapView>
        ) : (
          <View style={{ flex: 1, backgroundColor: CM.raised, alignItems: "center", justifyContent: "center", padding: 24 }}>
            <Text style={{ fontSize: 32 }}>🗺️</Text>
            <Text style={{ color: CM.inkSecondary, fontSize: 15, fontWeight: "700", marginTop: 12 }}>Map not available</Text>
            <Text style={{ color: "#AAAAAA", fontSize: 13, marginTop: 8, textAlign: "center" }}>Add a Google Maps API key to show the live heatmap.</Text>
          </View>
        )}
      </View>

      {/* ── Map control buttons — float bottom-right of map ── */}
      <View style={{ position: "absolute", right: 16, bottom: SHEET_PEEK + 16, zIndex: 15, gap: 10 }}>
        {/* My location button */}
        <TouchableOpacity
          onPress={goToMyLocation}
          style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: "rgba(10,10,10,0.88)",
            borderWidth: 1, borderColor: "rgba(0,229,255,0.4)",
            alignItems: "center", justifyContent: "center",
            shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
          }}
        >
          <Text style={{ fontSize: 18 }}>📍</Text>
        </TouchableOpacity>
        {/* Go to busiest zone button */}
        <TouchableOpacity
          onPress={goToBusiestZone}
          style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: "rgba(10,10,10,0.88)",
            borderWidth: 1, borderColor: "rgba(0,255,157,0.4)",
            alignItems: "center", justifyContent: "center",
            shadowColor: "#00FF9D", shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5, shadowRadius: 8, elevation: 8,
          }}
        >
          <Text style={{ fontSize: 18 }}>🔥</Text>
        </TouchableOpacity>
      </View>

      {/* ── TOP HUD — km pill + refresh ── */}
      <View style={{ position: "absolute", top: insets.top + 12, left: 16, right: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {/* Km pill */}
          <View style={{ backgroundColor: "rgba(10,10,10,0.82)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(0,255,157,0.3)" }}>
            <Text style={{ color: CM.accent, fontSize: 15, fontWeight: "800", letterSpacing: 0.3 }}>{todayKm.toFixed(1)} km</Text>
            <Text style={{ color: "#AAAAAA", fontSize: 10, textAlign: "center" }}>today</Text>
          </View>
          {/* Working indicator */}
          {isWorking ? (
            <View style={{ backgroundColor: "rgba(0,255,157,0.15)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(0,255,157,0.4)", flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: CM.accent }} />
              <Text style={{ color: CM.accent, fontSize: 11, fontWeight: "700" }}>LIVE</Text>
            </View>
          ) : null}
        </View>
        {/* Refresh */}
        <TouchableOpacity
          onPress={() => void refreshAll()}
          disabled={refreshing}
          style={{ backgroundColor: "rgba(10,10,10,0.82)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}
        >
          <Text style={{ color: refreshing ? "#666" : "#fff", fontSize: 12, fontWeight: "700" }}>
            {refreshing ? "..." : "↻ Refresh"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Toast notification ── */}
      {toast ? (
        <View style={{ position: "absolute", left: 16, right: 16, top: insets.top + 72, zIndex: 50, backgroundColor: CM.raised, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
          <Text style={{ color: CM.accent, fontSize: 14, fontWeight: "700" }}>{toast.title}</Text>
          <Text style={{ color: CM.inkSecondary, fontSize: 12, marginTop: 4 }}>{toast.body}</Text>
          <PremiumPressable variant="primary" className="mt-3 w-full" onPress={() => {
            if (toast.platform && selectedPlatforms.includes(toast.platform)) {
              setSelectedPlatform(toast.platform);
              if (toast.tierId) setRideHailActiveTier(toast.platform, toast.tierId);
            }
            setToast(null);
          }}>
            <Text className={`${BTN_PRIMARY_TEXT} text-[13px]`}>{t("openMap", languageCode)}</Text>
          </PremiumPressable>
        </View>
      ) : null}

      {/* ── Backdrop (dims map when sheet is fully open) ── */}
      <Animated.View
        style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000", zIndex: 5 }, backdropOpacity]}
        pointerEvents="none"
      />

      {/* ── BOTTOM SHEET ── */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: CM.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            zIndex: 10,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.5,
            shadowRadius: 24,
            elevation: 20,
            overflow: "hidden",
          }, sheetStyle]}
        >
          {/* Drag handle */}
          <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)" }} />
          </View>

          {/* Sheet scroll content */}
          <GHScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom + 80, 100) }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={sheetSnap === "full"}
          >
            <OfflineBanner />

            {/* ── Platform tabs — horizontally scrollable ── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16 }}
              contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
            >
              {defaultPrimary.map((platform) => (
                <PremiumPressable
                  key={platform}
                  variant="chip"
                  className={`flex-row items-center gap-1.5 rounded-xl px-4 py-2.5 ${
                    selectedPlatform === platform
                      ? "border-transparent bg-cm-accent shadow-cm-glow-sm"
                      : "border border-white/20 bg-cm-raised"
                  }`}
                  onPress={() => setSelectedPlatform(platform)}
                >
                  <PlatformGlyph name={platform} size="sm" />
                  <Text numberOfLines={1} className={`text-[12px] font-bold ${selectedPlatform === platform ? "text-cm-on-accent" : "text-cm-ink"}`}>
                    {platform}
                  </Text>
                </PremiumPressable>
              ))}
            </ScrollView>

            {/* ── I'm Working button ── */}
            <PremiumPressable
              variant="hero"
              className={`w-full mb-4 ${busy ? "bg-cm-muted shadow-none" : isWorking ? "border-transparent bg-cm-accent shadow-cm-glow" : "border-[1.5px] border-white/10 bg-cm-raised"}`}
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
                  <Text className={`text-center text-[20px] font-bold tracking-tight ${isWorking ? "text-cm-on-accent" : "text-cm-ink"}`}>
                    {isWorking ? t("trackingToggleOn", languageCode) : t("trackingToggleOff", languageCode)}
                  </Text>
                  <Text className={`mt-1 text-center text-[13px] ${isWorking ? "text-cm-on-accent/80" : "text-cm-ink-secondary"}`}>
                    {isWorking ? t("trackingToggleHintOn", languageCode) : t("trackingToggleHintOff", languageCode)}
                  </Text>
                </View>
              )}
            </PremiumPressable>

            {/* ── Best zone (while working) ── */}
            {bestNow && isWorking ? (
              <View className="mb-4 rounded-2xl border border-cm-accent/25 bg-cm-accent-soft p-4">
                <Text className="text-[11px] font-bold uppercase tracking-widest text-cm-accent">Best zone right now</Text>
                <View className="mt-2 flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-[18px] font-bold text-cm-ink">{bestNow.suburb}</Text>
                    <Text className="mt-0.5 text-[13px] text-cm-ink-secondary">{bestNow.displayName}</Text>
                  </View>
                  {isPro ? (
                    <Text className="text-[20px] font-bold text-cm-accent">~{formatMoney(bestNow.est, marketCode)}/hr</Text>
                  ) : (
                    <PremiumPressable variant="none" className="rounded-full border border-cm-accent/40 bg-cm-canvas px-4 py-2" onPress={() => openUpgradeModal()}>
                      <Text className="text-[12px] font-bold text-cm-accent">Unlock →</Text>
                    </PremiumPressable>
                  )}
                </View>
              </View>
            ) : null}

            {/* ── Best platforms leaderboard ── */}
            {drivingRank.ranked.length > 0 ? (
              <View className="mb-4 rounded-2xl border border-white/10 bg-cm-raised p-4">
                <Text className="mb-3 text-[11px] font-bold uppercase tracking-widest text-cm-accent">Best platforms right now</Text>
                {drivingRank.ranked.slice(0, 3).map((row, idx) => (
                  <View key={row.key} className={`flex-row items-center gap-3 ${idx > 0 ? "mt-3 border-t border-white/[0.06] pt-3" : ""}`}>
                    <Text className="w-5 text-center text-[12px] font-bold text-cm-ink-tertiary">{idx + 1}</Text>
                    <PlatformGlyph name={row.platform} size="sm" />
                    <Text className="min-w-0 flex-1 text-[13px] font-semibold text-cm-ink" numberOfLines={1}>{formatDrivingOptionLabel(row)}</Text>
                    {isPro ? (
                      <Text className="text-[12px] font-bold text-cm-accent">~{formatMoney(row.estMidRph, marketCode)}/hr</Text>
                    ) : (
                      <PremiumPressable variant="none" className="min-h-8 min-w-[40px] items-center justify-center rounded-full border border-cm-warn/40 bg-cm-warn-dim px-2" onPress={() => openUpgradeModal()}>
                        <Text className="text-[10px] font-extrabold uppercase text-cm-warn">Pro</Text>
                      </PremiumPressable>
                    )}
                  </View>
                ))}
              </View>
            ) : null}

            {/* ── Open platform CTA ── */}
            <PremiumPressable
              variant="primary"
              className="mb-4 w-full shadow-cm-glow"
              onPress={() => void Linking.openURL(getPlatformLink(bestNow.platform, marketCode))}
            >
              <Text className={BTN_PRIMARY_TEXT}>{t("open", languageCode)} {bestNow.displayName}</Text>
            </PremiumPressable>

            {/* ── Pro upsell ── */}
            {!isPro ? (
              <PremiumPressable
                variant="none"
                className="mb-4 w-full rounded-2xl border border-cm-cyan/35 bg-cm-cyan-dim px-5 py-4"
                onPress={() => openUpgradeModal()}
              >
                <Text className="text-[15px] font-bold text-cm-ink">{t("launchGiveawayBannerHeadline", languageCode)}</Text>
                <Text className="mt-1 text-[13px] text-cm-cyan">{t("launchGiveawayBannerSub", languageCode)}</Text>
                <Text className="mt-2 text-[11px] font-bold uppercase tracking-wide text-cm-cyan">{t("launchGiveawayBannerTap", languageCode)}</Text>
              </PremiumPressable>
            ) : null}

            {/* ── Smart pick ── */}
            {drivingRank.ranked.length >= 1 && drivingRank.current && drivingRank.ranked[0] && drivingRank.ranked[0].key !== drivingRank.current.key && drivingRank.ranked[0].estMidRph >= drivingRank.current.estMidRph * 1.08 ? (
              isPro ? (
                <View className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-950/30 p-4">
                  <Text className="text-[11px] font-bold uppercase tracking-wider text-amber-200/95">{t("smartPickTitle", languageCode)}</Text>
                  <Text className="mt-2 text-[13px] leading-5 text-amber-50/95">
                    {t("smartPickBody", languageCode, { winner: formatDrivingOptionLabel(drivingRank.ranked[0]), current: formatDrivingOptionLabel(drivingRank.current) })}
                  </Text>
                  <PremiumPressable variant="none" className="mt-3 self-start min-h-10 justify-center rounded-full bg-amber-400 px-6 py-2.5" onPress={() => { const w = drivingRank.ranked[0]; setSelectedPlatform(w.platform); if (w.tierId) setRideHailActiveTier(w.platform, w.tierId); }}>
                    <Text className="text-center text-[13px] font-bold text-cm-on-accent">{t("smartPickFocus", languageCode)}</Text>
                  </PremiumPressable>
                </View>
              ) : null
            ) : null}

            {/* ── Mileage stats ── */}
            <View className="mb-4 rounded-2xl border border-white/10 bg-cm-raised/80 p-4">
              <Text className="mb-3 text-[11px] font-bold uppercase tracking-widest text-cm-ink-tertiary">Mileage tracked</Text>
              <View className="flex-row">
                <View className="flex-1 items-center">
                  <Text className="text-[22px] font-bold text-cm-accent">{todayKm.toFixed(1)}</Text>
                  <Text className="mt-0.5 text-[11px] text-cm-ink-tertiary">km today</Text>
                </View>
                <View className="w-px bg-white/10" />
                <View className="flex-1 items-center">
                  <Text className="text-[22px] font-bold text-cm-ink">{weeklyKm.toFixed(1)}</Text>
                  <Text className="mt-0.5 text-[11px] text-cm-ink-tertiary">km this week</Text>
                </View>
              </View>
            </View>

            {/* ── Legend + legal ── */}
            <View className="mb-2 flex-row items-center gap-4 px-1">
              <View className="flex-row items-center gap-1.5"><View className="h-2 w-2 rounded-full bg-cm-accent" /><Text className="text-[10px] text-cm-ink-tertiary">High demand</Text></View>
              <View className="flex-row items-center gap-1.5"><View className="h-2 w-2 rounded-full bg-[#FBBF24]" /><Text className="text-[10px] text-cm-ink-tertiary">Moderate</Text></View>
              <View className="flex-row items-center gap-1.5"><View className="h-2 w-2 rounded-full bg-[#EF4444]" /><Text className="text-[10px] text-cm-ink-tertiary">Busy</Text></View>
              <View className="flex-row items-center gap-1.5"><View className="h-2 w-2 rounded-full bg-cm-cyan" /><Text className="text-[10px] text-cm-ink-tertiary">Predicted</Text></View>
            </View>
            <PremiumPressable variant="none" className="mb-4 min-h-8 justify-center" onPress={() => setMapLegalOpen(true)}>
              <Text className="text-center text-[11px] text-cm-ink-tertiary">Community estimates only · tap for legal info</Text>
            </PremiumPressable>

            <MvpDisclaimerBanner className="mb-2" />
          </GHScrollView>
        </Animated.View>
      </GestureDetector>

      {/* ── FAB: accept highest payout ── */}
      <PremiumPressable
        variant="primary"
        className="absolute right-4 max-w-[56%] border-cm-accent/35 shadow-cm-glow"
        style={{ bottom: Math.max(insets.bottom, 16) + SHEET_PEEK + 8 }}
        onPress={() => void Linking.openURL(getPlatformLink(bestNow.platform, marketCode))}
      >
        <Text numberOfLines={2} className={`${BTN_PRIMARY_TEXT} text-[11px] leading-4`}>
          {t("acceptHighestPayout", languageCode, { platform: bestNow.displayName })}
        </Text>
      </PremiumPressable>

      {/* ── Shift logger modal ── */}
      <Modal visible={Boolean(pendingPrompt)} transparent animationType="slide">
        <ModalBackdrop intensity={56}>
          <View className="flex-1 justify-end">
            <View className="rounded-t-[32px] border border-white/10 bg-cm-surface/95 px-5 pb-8 pt-6 shadow-cm-card" style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
              <View className="mb-5 h-1 w-10 self-center rounded-full bg-white/15" />
              <Text className="text-[11px] font-semibold uppercase tracking-wide text-cm-accent">End of shift</Text>
              <Text className="text-[22px] font-bold tracking-tight text-cm-ink">{t("dailyShiftSummary", languageCode)}</Text>
              <Text className="mt-2 text-[13px] leading-5 text-cm-ink-secondary">Log your earnings to improve zone predictions for all drivers.</Text>
              <TextInput value={earnings} onChangeText={setEarnings} placeholder={`${t("totalEarnings", languageCode)} (${market.currency} ___)`} keyboardType="numeric" placeholderTextColor={INPUT_PLACEHOLDER} className="mt-4 rounded-3xl border border-white/10 bg-cm-raised/90 px-4 py-3.5 text-[16px] text-cm-ink" />
              <View className="mt-4 flex-row flex-wrap gap-2">
                {selectedPlatforms.map((platform) => {
                  const selected = summaryPlatforms.includes(platform);
                  return (
                    <PremiumPressable key={platform} variant="chip" className={`px-4 ${selected ? "border-transparent bg-cm-accent" : "border-white/10 bg-cm-raised"}`} onPress={() => setSummaryPlatforms((c) => c.includes(platform) ? c.filter((x) => x !== platform) : [...c, platform])}>
                      <View className="flex-row items-center gap-1.5">
                        <PlatformGlyph name={platform} size="sm" />
                        <Text className={`text-[13px] font-bold ${selected ? "text-cm-on-accent" : "text-cm-ink-secondary"}`}>{platform}</Text>
                      </View>
                    </PremiumPressable>
                  );
                })}
              </View>
              <View className="mt-4">
                <Text className="mb-2 text-[13px] text-cm-ink-secondary">{t("approxDeliveries", languageCode)}</Text>
                <View className="flex-row items-center gap-3">
                  <TextInput value={deliveries > 0 ? String(deliveries) : ""} onChangeText={(v) => { const n = parseInt(v, 10); setDeliveries(Number.isFinite(n) && n >= 0 ? Math.min(200, n) : 0); }} keyboardType="numeric" placeholder="0" placeholderTextColor={INPUT_PLACEHOLDER} className="flex-1 rounded-xl border border-white/10 bg-cm-raised px-4 py-3 text-[18px] font-bold text-cm-ink" />
                  <PremiumPressable className={BTN_ICON} onPress={() => setDeliveries((d) => Math.max(0, d - 1))}><Text className="text-xl font-semibold text-cm-ink">−</Text></PremiumPressable>
                  <PremiumPressable className={BTN_ICON} onPress={() => setDeliveries((d) => Math.min(200, d + 1))}><Text className="text-xl font-semibold text-cm-ink">+</Text></PremiumPressable>
                </View>
              </View>
              <View className="mt-4 flex-row gap-2">
                {(["Great day", "Average", "Slow day"] as const).map((item) => (
                  <PremiumPressable key={item} variant="chip" className={`flex-1 px-2 ${rating === item ? "border-transparent bg-cm-accent shadow-cm-glow-sm" : "border-white/10 bg-cm-muted/90"}`} onPress={() => setRating(item)}>
                    <Text className={`text-center text-[12px] font-bold leading-4 ${rating === item ? "text-cm-on-accent" : "text-cm-ink-secondary"}`}>{item === "Great day" ? "😊" : item === "Average" ? "🙂" : "😕"} {item}</Text>
                  </PremiumPressable>
                ))}
              </View>
              {summaryError ? <Text className="mt-3 text-[13px] text-red-400">{summaryError}</Text> : null}
              <PremiumPressable variant="primary" className={`mt-5 w-full ${shiftSaving ? "opacity-70" : ""}`} disabled={shiftSaving} onPress={() => void saveShiftSummary()}>
                {shiftSaving ? <ActivityIndicator color={CM.onAccent} /> : <Text className={BTN_PRIMARY_TEXT}>{t("saveClose", languageCode)}</Text>}
              </PremiumPressable>
              <View className="mt-3 flex-row gap-3">
                <PremiumPressable variant="secondary" className="flex-1" onPress={() => { setPendingPrompt(null); setSummaryError(null); setEarnings(""); setDeliveries(0); setRating("Average"); }}>
                  <Text className="text-center text-[15px] font-bold text-cm-ink-secondary">{t("skip", languageCode)}</Text>
                </PremiumPressable>
                <PremiumPressable variant="secondary" className="flex-1" onPress={() => void dontShowToday()}>
                  <Text className="text-center text-[15px] font-bold text-cm-ink-secondary">{t("dontShowToday", languageCode)}</Text>
                </PremiumPressable>
              </View>
            </View>
          </View>
        </ModalBackdrop>
      </Modal>

      {/* ── Legal modal ── */}
      <Modal visible={mapLegalOpen} transparent animationType="fade" onRequestClose={() => setMapLegalOpen(false)}>
        <ModalBackdrop intensity={48}>
          <Pressable className="flex-1 justify-end px-4" style={{ paddingBottom: Math.max(insets.bottom, 20), paddingTop: insets.top + 12 }} onPress={() => setMapLegalOpen(false)}>
            <Pressable className="max-h-[82%] rounded-3xl border border-white/[0.12] bg-cm-surface p-5 shadow-cm-card" onPress={(e) => e.stopPropagation()}>
              <Text className="text-xl font-bold tracking-tight text-cm-ink">Disclaimer</Text>
              <ScrollView className="mt-4 max-h-96" showsVerticalScrollIndicator nestedScrollEnabled={Platform.OS === "android"} keyboardShouldPersistTaps="handled">
                <LegalDisclaimer showPolicyLinks />
              </ScrollView>
              <PremiumPressable variant="secondary" className="mt-5 w-full" onPress={() => setMapLegalOpen(false)}>
                <Text className="text-center text-[16px] font-bold text-cm-ink">Close</Text>
              </PremiumPressable>
            </Pressable>
          </Pressable>
        </ModalBackdrop>
      </Modal>

    </View>
  );
};
