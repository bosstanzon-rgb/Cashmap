import { createClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/config/env";

const supabaseUrl = getSupabaseUrl() || "https://invalid.local";
const supabaseAnonKey = getSupabaseAnonKey() || "invalid";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Returns a consistent anonymous session identifier stored in AsyncStorage.
 * Used to scope mileage and shift log reads to the current device only.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

let _sessionId: string | null = null;
export const getSessionId = async (): Promise<string> => {
  if (_sessionId) return _sessionId;
  const stored = await AsyncStorage.getItem("cashmap_session_id");
  if (stored) { _sessionId = stored; return stored; }
  const generated = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem("cashmap_session_id", generated);
  _sessionId = generated;
  return generated;
};

/** True when env vars look like a real project (not template placeholders). */
export const isSupabaseConfigured = () => {
  const url = getSupabaseUrl().trim();
  const key = getSupabaseAnonKey().trim();
  // Must have both values
  if (!url || !key) return false;
  // Reject known placeholder values
  const urlIsPlaceholder = url.includes("example.supabase") || url.includes("invalid.local") || url.includes("your_supabase");
  const keyIsPlaceholder = key === "anon-key" || key === "invalid" || key.includes("your_supabase") || key.length < 20;
  if (urlIsPlaceholder || keyIsPlaceholder) return false;
  // Valid Supabase URL pattern
  return url.startsWith("https://") && url.includes(".supabase.co");
};

/** Silent check used in UI — never throws */
export const checkSupabaseConnection = async (): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from("drivers").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
};

export const upsertAnonymousDriver = async (payload: {
  id: string;
  nickname: string;
  platforms: string[];
  shareHeatmapData?: boolean;
}) => {
  const { error } = await supabase.from("drivers").upsert(
    {
      id: payload.id,
      nickname: payload.nickname,
      platforms: payload.platforms,
      last_seen: new Date().toISOString(),
      share_heatmap_data: payload.shareHeatmapData ?? false,
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(error.message);
};

export type LocationPingRow = {
  id: number;
  lat: number;
  lng: number;
  timestamp: string;
  active_platforms: string[];
  active_service_modes?: Record<string, string> | null;
};

export const insertAnonymousLocationPing = async (payload: {
  lat: number;
  lng: number;
  timestamp: string;
  activePlatforms: string[];
  activeServiceModes?: Record<string, string>;
}) => {
  const modes =
    payload.activeServiceModes && Object.keys(payload.activeServiceModes).length > 0
      ? payload.activeServiceModes
      : {};
  const { error } = await supabase.from("location_pings").insert({
    lat: payload.lat,
    lng: payload.lng,
    timestamp: payload.timestamp,
    active_platforms: payload.activePlatforms,
    active_service_modes: modes,
  });
  if (error) throw new Error(error.message);
};

export const fetchRecentLocationPings = async (payload: {
  sinceIso: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}) => {
  // Uses community_location_pings VIEW — coordinates rounded to ~1km grid
  const { data, error } = await supabase
    .from("community_location_pings")
    .select("id,lat,lng,timestamp,active_platforms,active_service_modes")
    .gte("timestamp", payload.sinceIso)
    .gte("lat", payload.minLat)
    .lte("lat", payload.maxLat)
    .gte("lng", payload.minLng)
    .lte("lng", payload.maxLng)
    .order("timestamp", { ascending: false })
    .limit(4000);
  if (error) throw new Error(error.message);
  return (data ?? []) as LocationPingRow[];
};

export const fetchHistoricalLocationPings = async (sinceIso: string) => {
  // Uses community_location_pings VIEW — coordinates rounded to ~1km grid
  const { data, error } = await supabase
    .from("community_location_pings")
    .select("id,lat,lng,timestamp,active_platforms,active_service_modes")
    .gte("timestamp", sinceIso)
    .order("timestamp", { ascending: false })
    .limit(12000);
  if (error) throw new Error(error.message);
  return (data ?? []) as LocationPingRow[];
};

export type MileageLogRow = {
  id: number;
  timestamp: string;
  km: number;
  date?: string | null;
  km_added?: number | null;
  approx_zone?: string | null;
};

export const insertMileageLog = async (payload: {
  timestamp: string;
  km: number;
  date?: string;
  kmAdded?: number;
  approxZone?: string;
}) => {
  const sessionId = await getSessionId();
  const { error } = await supabase.from("mileage_logs").insert({
    timestamp: payload.timestamp,
    km: payload.km,
    date: payload.date ?? null,
    km_added: payload.kmAdded ?? null,
    approx_zone: payload.approxZone ?? null,
    session_id: sessionId,
  });
  if (error) throw new Error(error.message);
};

export const fetchMileageLogs = async (sinceIso: string) => {
  const sessionId = await getSessionId();
  const { data, error } = await supabase
    .from("mileage_logs")
    .select("id,timestamp,km,date,km_added,approx_zone")
    .eq("session_id", sessionId)
    .gte("timestamp", sinceIso)
    .order("timestamp", { ascending: false })
    .limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []) as MileageLogRow[];
};

export type ShiftLogRow = {
  date: string;
  approx_zone: string;
  earnings: number | null;
  platforms: string[] | null;
  deliveries: number | null;
  rating: string | null;
};

/**
 * Fetches shift logs from ALL drivers (community data) for use in predictions.
 * Does NOT filter by session_id — this is intentional community blending.
 * Only aggregated/anonymous data (suburb, platform, earnings) is used.
 */
export const fetchCommunityShiftLogs = async (sinceIso: string) => {
  // Uses community_shift_stats VIEW — aggregated, no session_id, no personal identifiers.
  // This is the privacy-safe way to read community data for predictions.
  const sinceDate = sinceIso.slice(0, 10);
  const { data, error } = await supabase
    .from("community_shift_stats")
    .select("date,approx_zone,earnings,platforms,deliveries,rating")
    .gte("date", sinceDate)
    .order("date", { ascending: false })
    .limit(10000);
  if (error) {
    // View might not exist yet (migration pending) — fall back gracefully
    console.warn("[CashMap] community_shift_stats view not ready:", error.message);
    return [] as ShiftLogRow[];
  }
  return (data ?? []) as ShiftLogRow[];
};

export const fetchShiftLogs = async (sinceIso: string) => {
  const sessionId = await getSessionId();
  const sinceDate = sinceIso.slice(0, 10); // shift_logs.date is `date`
  const { data, error } = await supabase
    .from("shift_logs")
    .select("date,approx_zone,earnings,platforms,deliveries,rating")
    .eq("session_id", sessionId)
    .gte("date", sinceDate)
    .order("date", { ascending: false })
    .limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []) as ShiftLogRow[];
};

export const insertShiftSummary = async (payload: {
  timestamp: string;
  approxZone: string;
  earnings?: number;
  platforms?: string[];
  deliveries?: number;
  rating?: "Great day" | "Average" | "Slow/Bad";
  userIdHash: string;
}) => {
  const { error } = await supabase.from("shift_summaries").insert({
    timestamp: payload.timestamp,
    approx_zone: payload.approxZone,
    earnings: payload.earnings ?? null,
    platforms: payload.platforms ?? null,
    deliveries: payload.deliveries ?? null,
    rating: payload.rating ?? null,
    user_id_hash: payload.userIdHash,
  });
  if (error) throw new Error(error.message);
};

export const insertShiftLog = async (payload: {
  date: string; // YYYY-MM-DD
  approxZone: string;
  earnings?: number;
  platforms?: string[];
  deliveries?: number;
  rating?: "Great day" | "Average" | "Slow day" | null;
}) => {
  const sessionId = await getSessionId();
  const { error } = await supabase.from("shift_logs").insert({
    date: payload.date,
    approx_zone: payload.approxZone,
    earnings: payload.earnings ?? null,
    platforms: payload.platforms ?? [],
    deliveries: payload.deliveries ?? null,
    rating: payload.rating ?? null,
    session_id: sessionId,
  });
  if (error) throw new Error(error.message);
};
