import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  ACTIVE_PLATFORMS_STORAGE_KEY,
  APP_SWITCH_TIPS_ENABLED_KEY,
  ACTIVE_SERVICE_MODES_KEY,
  AUTO_DETECT_SHIFT_END_KEY,
  AUTO_PAUSE_AFTER_INACTIVITY_KEY,
  DAILY_SHIFT_PROMPT_ENABLED_KEY,
  HEATMAP_SHARE_STORAGE_KEY,
  IS_WORKING_STORAGE_KEY,
  LANGUAGE_CODE_KEY,
  LOCATION_CONSENT_STORAGE_KEY,
  TRACK_MILEAGE_WHEN_WORKING_KEY,
  WEATHER_TIPS_ENABLED_KEY,
  WEEKLY_RECAP_NOTIFICATIONS_KEY,
  ZONE_ALERTS_ENABLED_KEY,
} from "@/constants/storage";
import {
  DEFAULT_MARKET_CODE,
  getMarketConfig,
  getRideHailTiers,
  isRideHailPlatform,
} from "@/constants/markets";
import { useProStore } from "@/store/proStore";
import { isSupabaseConfigured, upsertAnonymousDriver } from "@/services/supabase";
import { stopBackgroundLocationTracking } from "@/services/locationTasks";

export type ManualEarningLog = {
  id: string;
  platform: string;
  amount: number;
  durationMin: number;
  createdAt: string;
};

export type ZoneSnapshot = {
  id: string;
  platform: string;
  score: number;
  estimatedRph: number;
  suburb: string;
  capturedAt: string;
};

export type PredictionZoneCache = {
  id: string;
  platform: string;
  suburb: string;
  gridCell: string;
  centerLat: number;
  centerLng: number;
  hourOfDay: number;
  dayOfWeek: number;
  avgDriverCount: number;
  avgDemandProxy: number;
  predictedScore: number;
  predictedEarnings: number;
  sampleWindows: number;
};

type AppState = {
  userId: string;
  nickname: string;
  marketCode: string;
  languageCode: string;
  hasCompletedOnboarding: boolean;
  selectedPlatforms: string[];
  hasLocationConsent: boolean;
  /** Opt-in upload of anonymous pings & related telemetry (default off). */
  shareAnonymousHeatmapData: boolean;
  isTracking: boolean;
  isWorking: boolean;
  dailyMileage: number;
  totalMileage: number;
  lastLocation: { lat: number; lng: number; timestamp: string } | null;
  zoneAlertsEnabled: boolean;
  dailyShiftPromptEnabled: boolean;
  weatherTipsEnabled: boolean;
  weeklyRecapNotificationsEnabled: boolean;
  trackMileageWhenWorking: boolean;
  autoPauseAfterInactivity: boolean;
  autoDetectShiftEnd: boolean;
  manualEarningLogs: ManualEarningLog[];
  zoneSnapshots: ZoneSnapshot[];
  predictionsCache: PredictionZoneCache[];
  predictionsCacheUpdatedAt: string | null;
  rideHailQualifiedTierIds: Record<string, string[]>;
  rideHailActiveTierId: Record<string, string>;
  appSwitchTipsEnabled: boolean;
  setWorking: (value: boolean) => void;
  setTracking: (value: boolean) => void;
  setUserProfile: (payload: {
    userId: string;
    nickname: string;
    selectedPlatforms: string[];
    hasLocationConsent: boolean;
    marketCode?: string;
  }) => void;
  setMarketCode: (value: string) => void;
  setLanguageCode: (value: string) => void;
  togglePlatform: (platform: string) => void;
  setLocationConsent: (value: boolean) => void;
  setShareAnonymousHeatmapData: (value: boolean) => void;
  setZoneAlertsEnabled: (value: boolean) => void;
  setDailyShiftPromptEnabled: (value: boolean) => void;
  setWeatherTipsEnabled: (value: boolean) => void;
  setWeeklyRecapNotificationsEnabled: (value: boolean) => void;
  setTrackMileageWhenWorking: (value: boolean) => void;
  setAutoPauseAfterInactivity: (value: boolean) => void;
  setAutoDetectShiftEnd: (value: boolean) => void;
  setRideHailQualifiedTiers: (platform: string, tierIds: string[]) => void;
  setRideHailActiveTier: (platform: string, tierId: string) => void;
  setAppSwitchTipsEnabled: (value: boolean) => void;
  setMileageSnapshot: (payload: {
    dailyMileage: number;
    totalMileage: number;
    lastLocation: { lat: number; lng: number; timestamp: string } | null;
  }) => void;
  addManualEarningLog: (payload: Omit<ManualEarningLog, "id" | "createdAt">) => void;
  addZoneSnapshot: (payload: Omit<ZoneSnapshot, "id" | "capturedAt">) => void;
  setPredictionsCache: (payload: { zones: PredictionZoneCache[]; updatedAt: string }) => void;
  resetOnboarding: () => void;
};

const mirrorActiveServiceModes = (
  selectedPlatforms: string[],
  rideHailActiveTierId: Record<string, string>
) => {
  const modes: Record<string, string> = {};
  for (const p of selectedPlatforms) {
    if (isRideHailPlatform(p)) {
      const tierId = rideHailActiveTierId[p];
      if (tierId) modes[p] = tierId;
    }
  }
  void AsyncStorage.setItem(ACTIVE_SERVICE_MODES_KEY, JSON.stringify(modes));
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      userId: "",
      nickname: "",
      marketCode: DEFAULT_MARKET_CODE,
      languageCode: "en",
      hasCompletedOnboarding: false,
      selectedPlatforms: getMarketConfig(DEFAULT_MARKET_CODE).primaryPlatforms,
      hasLocationConsent: false,
      shareAnonymousHeatmapData: false,
      isTracking: false,
      isWorking: false,
      dailyMileage: 0,
      totalMileage: 0,
      lastLocation: null,
      zoneAlertsEnabled: true,
      dailyShiftPromptEnabled: true,
      weatherTipsEnabled: true,
      weeklyRecapNotificationsEnabled: true,
      trackMileageWhenWorking: true,
      autoPauseAfterInactivity: true,
      autoDetectShiftEnd: true,
      manualEarningLogs: [],
      zoneSnapshots: [],
      predictionsCache: [],
      predictionsCacheUpdatedAt: null,
      rideHailQualifiedTierIds: {},
      rideHailActiveTierId: {},
      appSwitchTipsEnabled: true,
      setWorking: (value) => {
        void AsyncStorage.setItem(IS_WORKING_STORAGE_KEY, value ? "true" : "false");
        set({ isWorking: value });
      },
      setTracking: (value) => set({ isTracking: value }),
      setUserProfile: ({ userId, nickname, selectedPlatforms, hasLocationConsent, marketCode }) =>
        set((state) => {
          // #region agent log
          // #endregion
          let rideHailQualifiedTierIds = { ...state.rideHailQualifiedTierIds };
          let rideHailActiveTierId = { ...state.rideHailActiveTierId };
          for (const p of selectedPlatforms) {
            if (isRideHailPlatform(p) && !rideHailActiveTierId[p]) {
              const tiers = getRideHailTiers(p);
              if (tiers[0]) {
                rideHailQualifiedTierIds[p] = [tiers[0].id];
                rideHailActiveTierId[p] = tiers[0].id;
              }
            }
          }
          void AsyncStorage.setItem(ACTIVE_PLATFORMS_STORAGE_KEY, JSON.stringify(selectedPlatforms));
          void AsyncStorage.setItem(
            LOCATION_CONSENT_STORAGE_KEY,
            hasLocationConsent ? "true" : "false"
          );
          void AsyncStorage.setItem(HEATMAP_SHARE_STORAGE_KEY, "false");
          mirrorActiveServiceModes(selectedPlatforms, rideHailActiveTierId);
          // #region agent log
          // #endregion
          return {
            userId,
            nickname,
            marketCode: marketCode ?? DEFAULT_MARKET_CODE,
            selectedPlatforms,
            hasLocationConsent,
            shareAnonymousHeatmapData: false,
            hasCompletedOnboarding: true,
            rideHailQualifiedTierIds,
            rideHailActiveTierId,
          };
        }),
      setMarketCode: (value) => set({ marketCode: value }),
      setLanguageCode: (value) => {
        const normalized = value.trim().toLowerCase() || "en";
        void AsyncStorage.setItem(LANGUAGE_CODE_KEY, normalized);
        set({ languageCode: normalized });
      },
      togglePlatform: (platform) =>
        set((state) => {
          const exists = state.selectedPlatforms.includes(platform);
          const next = exists
            ? state.selectedPlatforms.filter((item) => item !== platform)
            : [...state.selectedPlatforms, platform];
          let rideHailQualifiedTierIds = { ...state.rideHailQualifiedTierIds };
          let rideHailActiveTierId = { ...state.rideHailActiveTierId };
          if (exists) {
            delete rideHailQualifiedTierIds[platform];
            delete rideHailActiveTierId[platform];
          } else if (isRideHailPlatform(platform)) {
            const tiers = getRideHailTiers(platform);
            if (tiers[0]) {
              rideHailQualifiedTierIds[platform] = [tiers[0].id];
              rideHailActiveTierId[platform] = tiers[0].id;
            }
          }
          void AsyncStorage.setItem(ACTIVE_PLATFORMS_STORAGE_KEY, JSON.stringify(next));
          mirrorActiveServiceModes(next, rideHailActiveTierId);
          return {
            selectedPlatforms: next,
            rideHailQualifiedTierIds,
            rideHailActiveTierId,
          };
        }),
      setLocationConsent: (value) => {
        void AsyncStorage.setItem(LOCATION_CONSENT_STORAGE_KEY, value ? "true" : "false");
        set({ hasLocationConsent: value });
        if (!value) {
          void AsyncStorage.setItem(HEATMAP_SHARE_STORAGE_KEY, "false");
          set({ shareAnonymousHeatmapData: false });
        }
      },
      setShareAnonymousHeatmapData: (value) => {
        void AsyncStorage.setItem(HEATMAP_SHARE_STORAGE_KEY, value ? "true" : "false");
        set({ shareAnonymousHeatmapData: value });
        if (!value) void stopBackgroundLocationTracking();
        const s = get();
        if (s.hasCompletedOnboarding && s.userId && isSupabaseConfigured()) {
          void upsertAnonymousDriver({
            id: s.userId,
            nickname: s.nickname,
            platforms: s.selectedPlatforms,
            shareHeatmapData: value,
          }).catch(() => {});
        }
      },
      setZoneAlertsEnabled: (value) => {
        void AsyncStorage.setItem(ZONE_ALERTS_ENABLED_KEY, value ? "true" : "false");
        set({ zoneAlertsEnabled: value });
      },
      setDailyShiftPromptEnabled: (value) => {
        void AsyncStorage.setItem(DAILY_SHIFT_PROMPT_ENABLED_KEY, value ? "true" : "false");
        set({ dailyShiftPromptEnabled: value });
      },
      setWeatherTipsEnabled: (value) => {
        void AsyncStorage.setItem(WEATHER_TIPS_ENABLED_KEY, value ? "true" : "false");
        set({ weatherTipsEnabled: value });
      },
      setWeeklyRecapNotificationsEnabled: (value) => {
        void AsyncStorage.setItem(WEEKLY_RECAP_NOTIFICATIONS_KEY, value ? "true" : "false");
        set({ weeklyRecapNotificationsEnabled: value });
      },
      setTrackMileageWhenWorking: (value) => {
        void AsyncStorage.setItem(TRACK_MILEAGE_WHEN_WORKING_KEY, value ? "true" : "false");
        set({ trackMileageWhenWorking: value });
      },
      setAutoPauseAfterInactivity: (value) => {
        void AsyncStorage.setItem(AUTO_PAUSE_AFTER_INACTIVITY_KEY, value ? "true" : "false");
        set({ autoPauseAfterInactivity: value });
      },
      setAutoDetectShiftEnd: (value) => {
        void AsyncStorage.setItem(AUTO_DETECT_SHIFT_END_KEY, value ? "true" : "false");
        set({ autoDetectShiftEnd: value });
      },
      setRideHailQualifiedTiers: (platform, tierIds) =>
        set((state) => {
          const tiers = getRideHailTiers(platform);
          if (!tiers.length) return state;
          const valid = tierIds.filter((id) => tiers.some((t) => t.id === id));
          const nextIds = valid.length > 0 ? valid : [tiers[0].id];
          let act = state.rideHailActiveTierId[platform];
          if (!act || !nextIds.includes(act)) act = nextIds[0];
          const next = {
            rideHailQualifiedTierIds: { ...state.rideHailQualifiedTierIds, [platform]: nextIds },
            rideHailActiveTierId: { ...state.rideHailActiveTierId, [platform]: act },
          };
          mirrorActiveServiceModes(state.selectedPlatforms, next.rideHailActiveTierId);
          return next;
        }),
      setRideHailActiveTier: (platform, tierId) =>
        set((state) => {
          const tiers = getRideHailTiers(platform);
          if (!tiers.some((t) => t.id === tierId)) return state;
          const prevQ = state.rideHailQualifiedTierIds[platform];
          if (prevQ?.length && !prevQ.includes(tierId)) return state;
          const q = prevQ?.length ? prevQ : [tierId];
          const next = {
            rideHailQualifiedTierIds: { ...state.rideHailQualifiedTierIds, [platform]: q },
            rideHailActiveTierId: { ...state.rideHailActiveTierId, [platform]: tierId },
          };
          mirrorActiveServiceModes(state.selectedPlatforms, next.rideHailActiveTierId);
          return next;
        }),
      setAppSwitchTipsEnabled: (value) => {
        void AsyncStorage.setItem(APP_SWITCH_TIPS_ENABLED_KEY, value ? "true" : "false");
        set({ appSwitchTipsEnabled: value });
      },
      setMileageSnapshot: ({ dailyMileage, totalMileage, lastLocation }) =>
        set({
          dailyMileage,
          totalMileage,
          lastLocation,
        }),
      addManualEarningLog: ({ platform, amount, durationMin }) =>
        set((state) => ({
          manualEarningLogs: [
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              platform,
              amount,
              durationMin,
              createdAt: new Date().toISOString(),
            },
            ...state.manualEarningLogs,
          ].slice(0, 1000),
        })),
      addZoneSnapshot: ({ platform, score, estimatedRph, suburb }) =>
        set((state) => ({
          zoneSnapshots: [
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              platform,
              score,
              estimatedRph,
              suburb,
              capturedAt: new Date().toISOString(),
            },
            ...state.zoneSnapshots,
          ].slice(0, 3000),
        })),
      setPredictionsCache: ({ zones, updatedAt }) =>
        set({
          predictionsCache: zones,
          predictionsCacheUpdatedAt: updatedAt,
        }),
      resetOnboarding: () => {
        useProStore.getState().resetPro();
        void Promise.all([
          AsyncStorage.removeItem(ACTIVE_PLATFORMS_STORAGE_KEY),
          AsyncStorage.removeItem(ACTIVE_SERVICE_MODES_KEY),
          AsyncStorage.removeItem(IS_WORKING_STORAGE_KEY),
          AsyncStorage.removeItem(LOCATION_CONSENT_STORAGE_KEY),
          AsyncStorage.removeItem(HEATMAP_SHARE_STORAGE_KEY),
        ]);
        set((state) => ({
          userId: "",
          nickname: "",
          hasCompletedOnboarding: false,
          hasLocationConsent: false,
          shareAnonymousHeatmapData: false,
          selectedPlatforms: getMarketConfig(state.marketCode).primaryPlatforms,
          isTracking: false,
          isWorking: false,
          dailyMileage: 0,
          totalMileage: 0,
          lastLocation: null,
          manualEarningLogs: [],
          zoneSnapshots: [],
          predictionsCache: [],
          predictionsCacheUpdatedAt: null,
          rideHailQualifiedTierIds: {},
          rideHailActiveTierId: {},
        }));
      },
    }),
    {
      name: "driver-app-storage",
      version: 3,
      migrate: (persisted, version) => {
        const row = persisted as Record<string, unknown> | undefined;
        if (!row || typeof row !== "object") return persisted as never;
        if (version === 0 && "hasProEntitlement" in row && !("isPro" in row)) {
          row.isPro = row.hasProEntitlement;
          delete row.hasProEntitlement;
        }
        if (version < 2) {
          const legacyPro = Boolean(row.isPro);
          if ("isPro" in row) delete row.isPro;
          if ("unlockProModalVisible" in row) delete row.unlockProModalVisible;
          if (legacyPro) {
            queueMicrotask(() => {
              useProStore.getState().setIsPro(true);
            });
          }
        }
        if (version < 3) {
          if (!("shareAnonymousHeatmapData" in row)) {
            (row as { shareAnonymousHeatmapData: boolean }).shareAnonymousHeatmapData = false;
          }
        }
        return persisted as never;
      },
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // #region agent log
          // #endregion
          try {
            mirrorActiveServiceModes(state.selectedPlatforms, state.rideHailActiveTierId);
            void AsyncStorage.setItem(
              HEATMAP_SHARE_STORAGE_KEY,
              state.shareAnonymousHeatmapData ? "true" : "false"
            );
          } catch (error) {
            // #region agent log
            // #endregion
            throw error;
          }
        }
      },
    }
  )
);
