import Constants from "expo-constants";

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  revenueCatPublicKey?: string;
  googleMapsApiKey?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/**
 * Picks the first non-empty string from candidates.
 * Tries: app.config.js extra (EAS builds) → process.env (dev) → hardcoded fallback
 */
function pick(...candidates: (string | undefined)[]): string {
  for (const c of candidates) {
    if (typeof c === "string") {
      const t = c.trim();
      if (t) return t;
    }
  }
  return "";
}

// Hardcoded fallbacks — these are all public-safe keys (anon/publishable).
// They ensure the app works in EAS preview builds where .env is not uploaded.
const FALLBACKS = {
  supabaseUrl: "https://xclsnfqjwjaatmvvxpea.supabase.co",
  supabaseAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjbHNuZnFqd2phYXRtdnZ4cGVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NjY1NTAsImV4cCI6MjA5MDE0MjU1MH0.rOXRAbWoPPcwe2NNkIyaxS2_dybJyL2TRBUnItUES0w",
  revenueCatPublicKey: "goog_KWuqhEKTIUhTIjLyaXuEcIcJoQE",
  googleMapsApiKey: "AIzaSyBu-paEC0P4aIJ6jTfw9yAaShSwTXcuMvE",
};

export function getSupabaseUrl(): string {
  return pick(extra.supabaseUrl, process.env.EXPO_PUBLIC_SUPABASE_URL, FALLBACKS.supabaseUrl);
}

export function getSupabaseAnonKey(): string {
  return pick(extra.supabaseAnonKey, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, FALLBACKS.supabaseAnonKey);
}

export function getRevenueCatPublicKey(): string {
  return pick(
    extra.revenueCatPublicKey,
    process.env.EXPO_PUBLIC_REVENUECAT_PUBLIC_KEY,
    process.env.REVENUECAT_PUBLIC_KEY,
    FALLBACKS.revenueCatPublicKey
  );
}

export function getGoogleMapsApiKey(): string {
  return pick(
    extra.googleMapsApiKey,
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
    process.env.GOOGLE_MAPS_API_KEY,
    FALLBACKS.googleMapsApiKey
  );
}

/** Alias used by App.tsx */
export function getRevenueCatApiKeyForPlatform(): string {
  return getRevenueCatPublicKey();
}
