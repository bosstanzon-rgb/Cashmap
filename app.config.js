/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");

try {
  require("dotenv").config({ path: path.resolve(__dirname, ".env") });
} catch {
  // dotenv is optional if deps not installed yet
}

const appJson = require("./app.json");

// Primary: read from .env via dotenv (local dev)
// Fallback: hardcoded values for EAS builds where .env is not uploaded
// These are all public-safe keys (anon/publishable — not secrets)
const SUPABASE_URL_FALLBACK = "https://xclsnfqjwjaatmvvxpea.supabase.co";
const SUPABASE_ANON_KEY_FALLBACK = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjbHNuZnFqd2phYXRtdnZ4cGVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NjY1NTAsImV4cCI6MjA5MDE0MjU1MH0.rOXRAbWoPPcwe2NNkIyaxS2_dybJyL2TRBUnItUES0w";
const REVENUECAT_KEY_FALLBACK = "goog_KWuqhEKTIUhTIjLyaXuEcIcJoQE";
const GOOGLE_MAPS_KEY_FALLBACK = "AIzaSyBu-paEC0P4aIJ6jTfw9yAaShSwTXcuMvE";

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || SUPABASE_URL_FALLBACK;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY_FALLBACK;
const revenueCatPublicKey =
  process.env.REVENUECAT_PUBLIC_KEY || process.env.EXPO_PUBLIC_REVENUECAT_PUBLIC_KEY || REVENUECAT_KEY_FALLBACK;
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_KEY_FALLBACK;

module.exports = () => ({
  ...appJson,
  expo: {
    ...appJson.expo,
    android: {
      ...appJson.expo.android,
      config: {
        ...((appJson.expo.android && appJson.expo.android.config) || {}),
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
    extra: {
      ...(appJson.expo.extra || {}),
      supabaseUrl,
      supabaseAnonKey,
      revenueCatPublicKey,
      googleMapsApiKey,
    },
  },
});
