import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { fetchMileageLogs } from "@/services/supabase";
import {
  DAILY_MILEAGE_STORAGE_KEY,
  LAST_MILEAGE_LOCATION_STORAGE_KEY,
  TOTAL_MILEAGE_STORAGE_KEY,
  IS_WORKING_STORAGE_KEY,
} from "@/constants/storage";

export type LastLocation = { lat: number; lng: number; timestamp: string };

type MileageState = {
  /** Whether the user has enabled background mileage tracking ("I'm Working"). */
  isTracking: boolean;
  /** Kilometers tracked today (from background task running totals). */
  todayKm: number;
  /** Kilometers tracked this week (computed from mileage_logs). */
  weeklyKm: number;
  /** Lifetime tracked kilometers (from background task running total). */
  totalKm: number;
  /** Latest GPS point stored by the background task (best-effort). */
  lastLocation: LastLocation | null;
  /** Sync today/total/lastLocation from AsyncStorage. */
  refreshLocalTotals: () => Promise<void>;
  /** Fetch weekly km from Supabase mileage_logs. */
  refreshWeekly: () => Promise<void>;
  /** Convenience: local + weekly. */
  refreshAll: () => Promise<void>;
  /** Set tracking flag (used for UI only; background uses AsyncStorage). */
  setIsTracking: (value: boolean) => void;
};

const readNumber = async (key: string) => {
  const raw = await AsyncStorage.getItem(key);
  return raw ? Number(raw) : 0;
};

const readLastLocation = async (): Promise<LastLocation | null> => {
  const raw = await AsyncStorage.getItem(LAST_MILEAGE_LOCATION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LastLocation;
    if (!parsed || typeof parsed.lat !== "number" || typeof parsed.lng !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
};

export const useMileageStore = create<MileageState>((set) => ({
  isTracking: false,
  todayKm: 0,
  weeklyKm: 0,
  totalKm: 0,
  lastLocation: null,

  setIsTracking: (value) => set({ isTracking: value }),

  refreshLocalTotals: async () => {
    const [todayKm, totalKm, lastLocation] = await Promise.all([
      readNumber(DAILY_MILEAGE_STORAGE_KEY),
      readNumber(TOTAL_MILEAGE_STORAGE_KEY),
      readLastLocation(),
    ]);
    const isTracking = (await AsyncStorage.getItem(IS_WORKING_STORAGE_KEY)) === "true";
    set({ todayKm, totalKm, lastLocation, isTracking });
  },

  refreshWeekly: async () => {
    const sinceWeekIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    try {
      const rows = await fetchMileageLogs(sinceWeekIso);
      const weeklyKm = rows.reduce((sum, row) => sum + (row.km_added ?? row.km ?? 0), 0);
      set({ weeklyKm });
    } catch {
      // Supabase may be unavailable in dev; keep previous weekly value.
    }
  },

  refreshAll: async () => {
    await useMileageStore.getState().refreshLocalTotals();
    await useMileageStore.getState().refreshWeekly();
  },
}));

