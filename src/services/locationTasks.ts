/**
 * Background location for (1) anonymous heatmap pings when working + consent,
 * (2) automatic mileage via Haversine distance between GPS fixes (BACKGROUND_MILEAGE_TASK).
 * Shift-end prompt: after 25+ min without meaningful movement, optionally queues end-of-day logger.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import {
  ACTIVE_PLATFORMS_STORAGE_KEY,
  ACTIVE_SERVICE_MODES_KEY,
  AUTO_DETECT_SHIFT_END_KEY,
  AUTO_PAUSE_AFTER_INACTIVITY_KEY,
  DAILY_MILEAGE_STORAGE_KEY,
  DAILY_SHIFT_PROMPT_ENABLED_KEY,
  HEATMAP_SHARE_STORAGE_KEY,
  LOCATION_CONSENT_STORAGE_KEY,
  IS_WORKING_STORAGE_KEY,
  IS_PRO_STORAGE_KEY,
  LAST_MILEAGE_LOCATION_STORAGE_KEY,
  LAST_ZONE_ALERT_AT_KEY,
  LAST_ZONE_ALERT_ID_KEY,
  SHIFT_LAST_MOVEMENT_AT_KEY,
  SHIFT_PROMPT_PENDING_KEY,
  SHIFT_PROMPT_SNOOZE_DATE_KEY,
  SHIFT_PROMPT_SHOWN_DATE_KEY,
  TOTAL_MILEAGE_STORAGE_KEY,
  WORKING_DATE_STORAGE_KEY,
  ZONE_ALERTS_ENABLED_KEY,
} from "@/constants/storage";
import { getPersistedLanguageCode, t } from "@/constants/i18n";
import { insertAnonymousLocationPing, insertMileageLog, isSupabaseConfigured, fetchRecentLocationPings } from "@/services/supabase";
import { distanceKm, getSuburbName } from "@/lib/geo";
import * as Notifications from "expo-notifications";
import { scheduleAppAlert } from "@/services/alerts";

export const BACKGROUND_LOCATION_TASK = "background-location-task";
export const BACKGROUND_MILEAGE_TASK = "mileage-tracker";
export const BACKGROUND_LOCATION_PERMISSION_ERROR = "BACKGROUND_LOCATION_PERMISSION";
export const LOCATION_CONSENT_REQUIRED = "LOCATION_CONSENT_REQUIRED";
// "Shift likely ended" detection: user has been stationary for ~25+ minutes.
const STATIONARY_THRESHOLD_MS = 25 * 60 * 1000;

// ─── Background zone alert ────────────────────────────────────────────────────
// Runs inside BACKGROUND_MILEAGE_TASK every ~5 min (throttled).
// Fetches recent community pings near the driver, scores zones, and fires a
// local notification if a high-demand zone is nearby — even while the driver
// is using another app.

const ZONE_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const ZONE_ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes between alerts
const ZONE_SCORE_THRESHOLD = 7.5; // minimum score to trigger alert

const checkAndAlertHotZone = async (
  current: { lat: number; lng: number },
  activePlatforms: string[],
  lang: string
) => {
  try {
    // Throttle: only check once every 5 minutes
    const lastCheckRaw = await AsyncStorage.getItem(LAST_ZONE_ALERT_AT_KEY);
    if (lastCheckRaw) {
      const elapsed = Date.now() - Number(lastCheckRaw);
      if (elapsed < ZONE_CHECK_INTERVAL_MS) return;
    }

    // Only alert if zone alerts are enabled
    const alertsEnabled = (await AsyncStorage.getItem(ZONE_ALERTS_ENABLED_KEY)) !== "false";
    if (!alertsEnabled) return;

    // Only Pro users get background zone alerts
    const isPro = (await AsyncStorage.getItem(IS_PRO_STORAGE_KEY)) === "true";
    if (!isPro) return;

    if (!isSupabaseConfigured()) return;

    // Mark check time before fetching to prevent overlapping calls
    await AsyncStorage.setItem(LAST_ZONE_ALERT_AT_KEY, String(Date.now()));

    const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const delta = 0.08;
    const pings = await fetchRecentLocationPings({
      sinceIso,
      minLat: current.lat - delta,
      maxLat: current.lat + delta,
      minLng: current.lng - delta,
      maxLng: current.lng + delta,
    });

    if (pings.length === 0) return;

    // Score zones same way as useZoneAdvice
    const hour = new Date().getHours();
    const timeFactor = hour >= 18 && hour <= 22 ? 1.5 : hour >= 12 && hour <= 14 ? 1.3 : 1;
    const grouped = new Map<string, { lat: number; lng: number; demand: number; drivers: Set<string>; platform: string }>();

    for (const ping of pings) {
      if (distanceKm(current, { lat: ping.lat, lng: ping.lng }) > 5) continue;
      for (const platform of (ping.active_platforms ?? [])) {
        if (!activePlatforms.includes(platform)) continue;
        const latCell = Math.round(ping.lat * 100) / 100;
        const lngCell = Math.round(ping.lng * 100) / 100;
        const key = `${platform}:${latCell}:${lngCell}`;
        const row = grouped.get(key) ?? { lat: latCell, lng: lngCell, demand: 0, drivers: new Set<string>(), platform };
        row.demand += 1;
        row.drivers.add(`${Math.round(ping.lat * 250)}:${Math.round(ping.lng * 250)}`);
        grouped.set(key, row);
      }
    }

    if (grouped.size === 0) return;

    // Find best zone
    let bestId = "";
    let bestScore = 0;
    let bestLat = 0;
    let bestLng = 0;
    let bestPlatform = "";

    for (const [id, row] of grouped.entries()) {
      const score = (row.demand / (row.drivers.size + 1)) * timeFactor;
      if (score > bestScore) {
        bestScore = score;
        bestId = id;
        bestLat = row.lat;
        bestLng = row.lng;
        bestPlatform = row.platform;
      }
    }

    if (bestScore < ZONE_SCORE_THRESHOLD) return;

    // Cooldown: don't re-alert same zone within 15 minutes
    const lastAlertId = await AsyncStorage.getItem(LAST_ZONE_ALERT_ID_KEY);
    const lastAlertAt = await AsyncStorage.getItem(LAST_ZONE_ALERT_AT_KEY);
    if (lastAlertId === bestId && lastAlertAt) {
      if (Date.now() - Number(lastAlertAt) < ZONE_ALERT_COOLDOWN_MS) return;
    }

    // Get suburb name using distance-based lookup
    const suburb = getSuburbName(bestLat, bestLng, "nearby");

    // Fire the notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t("notifyGoldenZoneTitle", lang, { suburb }),
        body: t("notifyGoldenZoneBody", lang),
        categoryIdentifier: "ZONE_ALERTS_CATEGORY",
        data: { targetTab: "HomeMap", platform: bestPlatform },
      },
      trigger: null,
    });

    await AsyncStorage.setItem(LAST_ZONE_ALERT_ID_KEY, bestId);
    await AsyncStorage.setItem(LAST_ZONE_ALERT_AT_KEY, String(Date.now()));
  } catch {
    // Zone check failures must never crash the background task
  }
};

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const consent = (await AsyncStorage.getItem(LOCATION_CONSENT_STORAGE_KEY)) === "true";
  const heatmapShare = (await AsyncStorage.getItem(HEATMAP_SHARE_STORAGE_KEY)) === "true";
  const online = (await AsyncStorage.getItem(IS_WORKING_STORAGE_KEY)) === "true";
  if (!consent || !heatmapShare || !online) return;
  const platformsRaw = await AsyncStorage.getItem(ACTIVE_PLATFORMS_STORAGE_KEY);
  const activePlatforms = platformsRaw ? (JSON.parse(platformsRaw) as string[]) : [];
  if (activePlatforms.length === 0) return;

  const modesRaw = await AsyncStorage.getItem(ACTIVE_SERVICE_MODES_KEY);
  const fromStore = modesRaw ? (JSON.parse(modesRaw) as Record<string, string>) : {};
  const activeServiceModes: Record<string, string> = {};
  for (const p of activePlatforms) {
    if (fromStore[p]) activeServiceModes[p] = fromStore[p];
  }

  const locations = (data as { locations?: Location.LocationObject[] }).locations;
  const latest = locations?.[0];
  if (!latest?.coords) return;
  await insertAnonymousLocationPing({
    lat: latest.coords.latitude,
    lng: latest.coords.longitude,
    timestamp: new Date(latest.timestamp).toISOString(),
    activePlatforms,
    activeServiceModes,
  });
});

TaskManager.defineTask(BACKGROUND_MILEAGE_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const consent = (await AsyncStorage.getItem(LOCATION_CONSENT_STORAGE_KEY)) === "true";
  if (!consent) return;
  const isTracking = (await AsyncStorage.getItem(IS_WORKING_STORAGE_KEY)) === "true";
  if (!isTracking) return;
  const supabaseOk = isSupabaseConfigured();

  const today = new Date().toISOString().slice(0, 10);
  const workingDate = await AsyncStorage.getItem(WORKING_DATE_STORAGE_KEY);
  if (workingDate && workingDate !== today) {
    await stopWorkingMileageTracking();
    await AsyncStorage.setItem(DAILY_MILEAGE_STORAGE_KEY, "0");
    return;
  }

  const locations = (data as { locations?: Location.LocationObject[] }).locations;
  const latest = locations?.[0];
  if (!latest?.coords) return;

  const current = {
    lat: latest.coords.latitude,
    lng: latest.coords.longitude,
    timestamp: new Date(latest.timestamp).toISOString(),
  };
  const prevRaw = await AsyncStorage.getItem(LAST_MILEAGE_LOCATION_STORAGE_KEY);
  const prev = prevRaw ? (JSON.parse(prevRaw) as { lat: number; lng: number; timestamp: string }) : null;
  if (prev) {
      const kmAdded = distanceKm({ lat: prev.lat, lng: prev.lng }, { lat: current.lat, lng: current.lng });
    if (kmAdded >= 0.03 && kmAdded <= 5) {
      await AsyncStorage.setItem(SHIFT_LAST_MOVEMENT_AT_KEY, String(Date.now()));
      const daily = Number(await AsyncStorage.getItem(DAILY_MILEAGE_STORAGE_KEY) ?? "0");
      const total = Number(await AsyncStorage.getItem(TOTAL_MILEAGE_STORAGE_KEY) ?? "0");
      const nextDaily = Number((daily + kmAdded).toFixed(3));
      const nextTotal = Number((total + kmAdded).toFixed(3));
      await AsyncStorage.setItem(DAILY_MILEAGE_STORAGE_KEY, String(nextDaily));
      await AsyncStorage.setItem(TOTAL_MILEAGE_STORAGE_KEY, String(nextTotal));
      if (supabaseOk) {
        await insertMileageLog({
          timestamp: current.timestamp,
          km: Number(kmAdded.toFixed(3)),
          kmAdded: Number(kmAdded.toFixed(3)),
          date: today,
          approxZone: `cell_${Math.round(current.lat * 100) / 100}_${Math.round(current.lng * 100) / 100}`,
        });
      }
    } else {
      const lastMovementRaw = await AsyncStorage.getItem(SHIFT_LAST_MOVEMENT_AT_KEY);
      const lastMovement = lastMovementRaw ? Number(lastMovementRaw) : Date.now();
      const stationary = Date.now() - lastMovement >= STATIONARY_THRESHOLD_MS;
      if (stationary) {
        const autoDetectEnabled =
          (await AsyncStorage.getItem(AUTO_DETECT_SHIFT_END_KEY)) !== "false";
        if (!autoDetectEnabled) {
          await AsyncStorage.setItem(LAST_MILEAGE_LOCATION_STORAGE_KEY, JSON.stringify(current));
          return;
        }
        const pending = await AsyncStorage.getItem(SHIFT_PROMPT_PENDING_KEY);
        const snooze = await AsyncStorage.getItem(SHIFT_PROMPT_SNOOZE_DATE_KEY);
        const shown = await AsyncStorage.getItem(SHIFT_PROMPT_SHOWN_DATE_KEY);
        const todayIso = new Date().toISOString().slice(0, 10);
        const shiftPromptEnabled =
          (await AsyncStorage.getItem(DAILY_SHIFT_PROMPT_ENABLED_KEY)) !== "false";
        if (!shiftPromptEnabled) return;
        if (!pending && snooze !== todayIso && shown !== todayIso) {
          // "Max once per day" guard (independent of snooze: even if user taps "Skip for now",
          // we only want a single prompt per calendar day).
          const lang = await getPersistedLanguageCode();

          await AsyncStorage.setItem(SHIFT_PROMPT_SHOWN_DATE_KEY, todayIso);
          await AsyncStorage.setItem(
            SHIFT_PROMPT_PENDING_KEY,
            JSON.stringify({
              timestamp: current.timestamp,
              lat: current.lat,
              lng: current.lng,
            })
          );

          // Best-effort local notification: the in-app modal is driven by SHIFT_PROMPT_PENDING_KEY.
          void scheduleAppAlert({
            type: "shift",
            title: t("notifyShiftOverTitle", lang),
            body: t("notifyShiftOverBody", lang),
            data: { targetTab: "Earnings" },
          });
        }
      }
    }
  }
  await AsyncStorage.setItem(LAST_MILEAGE_LOCATION_STORAGE_KEY, JSON.stringify(current));

  // Background zone alert — check for hot zones near driver every 5 min
  const bgPlatformsRaw = await AsyncStorage.getItem(ACTIVE_PLATFORMS_STORAGE_KEY);
  const bgPlatforms = bgPlatformsRaw ? (JSON.parse(bgPlatformsRaw) as string[]) : [];
  if (bgPlatforms.length > 0) {
    const bgLang = await getPersistedLanguageCode();
    void checkAndAlertHotZone(current, bgPlatforms, bgLang);
  }
});


export const startBackgroundLocationTracking = async () => {
  const reg = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (reg) return;
  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 90000,
    distanceInterval: 120,
  });
};

export const stopBackgroundLocationTracking = async () => {
  const reg = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (reg) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
};

export const startWorkingMileageTracking = async () => {
  // Mileage + background GPS are free-tier features (Pro locks predictions/alerts/benchmarks instead).
  const consent = (await AsyncStorage.getItem(LOCATION_CONSENT_STORAGE_KEY)) === "true";
  if (!consent) throw new Error(LOCATION_CONSENT_REQUIRED);
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") throw new Error(BACKGROUND_LOCATION_PERMISSION_ERROR);
  const lang = await getPersistedLanguageCode();
  await AsyncStorage.setItem(IS_WORKING_STORAGE_KEY, "true");
  await AsyncStorage.setItem(WORKING_DATE_STORAGE_KEY, new Date().toISOString().slice(0, 10));
  const reg = await TaskManager.isTaskRegisteredAsync(BACKGROUND_MILEAGE_TASK);
  if (reg) return;
  await Location.startLocationUpdatesAsync(BACKGROUND_MILEAGE_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 60000,
    distanceInterval: 50,
    deferredUpdatesInterval: 60000,
    foregroundService: {
      notificationTitle: t("mileageForegroundTitle", lang),
      notificationBody: t("mileageForegroundBody", lang),
    },
  });
};

export const stopWorkingMileageTracking = async () => {
  await AsyncStorage.setItem(IS_WORKING_STORAGE_KEY, "false");
  await AsyncStorage.removeItem(LAST_MILEAGE_LOCATION_STORAGE_KEY);
  const reg = await TaskManager.isTaskRegisteredAsync(BACKGROUND_MILEAGE_TASK);
  if (reg) await Location.stopLocationUpdatesAsync(BACKGROUND_MILEAGE_TASK);
};

export const enforceAutoPauseAfterInactivity = async () => {
  const enabled = (await AsyncStorage.getItem(AUTO_PAUSE_AFTER_INACTIVITY_KEY)) !== "false";
  if (!enabled) return;
  const last = await AsyncStorage.getItem(LAST_MILEAGE_LOCATION_STORAGE_KEY);
  if (!last) return;
  const parsed = JSON.parse(last) as { timestamp: string };
  const idleMs = Date.now() - new Date(parsed.timestamp).getTime();
  if (idleMs < 2 * 60 * 60 * 1000) return;
  await stopWorkingMileageTracking();
  await stopBackgroundLocationTracking();
};
