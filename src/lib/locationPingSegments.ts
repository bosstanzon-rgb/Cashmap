import { getRideHailTiers, isRideHailPlatform } from "@/constants/markets";

export const POOL_SEGMENT_SUFFIX = "__pool";

/** Normalize Supabase jsonb / legacy rows into a plain string map. */
export const normalizeActiveServiceModes = (raw: unknown): Record<string, string> => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.length > 0) out[k] = v;
  }
  return out;
};

/** Grouping key for one platform on a ping (delivery = brand only; ride = brand::tier or brand::__pool). */
export const segmentKeyForPlatformOnPing = (
  platform: string,
  modes: Record<string, string>
): string => {
  if (!platform || typeof platform !== "string") return "";
  if (!isRideHailPlatform(platform)) return platform;
  const tier = modes[platform];
  return tier ? `${platform}::${tier}` : `${platform}::${POOL_SEGMENT_SUFFIX}`;
};

export const pingSegmentMatchesTab = (segmentKey: string, tab: string): boolean =>
  segmentKey === tab || segmentKey.startsWith(`${tab}::`);

export const basePlatformFromSegment = (segmentKey: string): string =>
  segmentKey.includes("::") ? segmentKey.split("::")[0] : segmentKey;

/** Map marker / list labels: "Uber · Uber Black" or "Uber (pooled legacy)". */
export const formatPingSegmentLabel = (segmentKey: string): string => {
  if (!segmentKey.includes("::")) return segmentKey;
  const [base, tierId] = segmentKey.split("::");
  if (tierId === POOL_SEGMENT_SUFFIX) return `${base} (pooled)`;
  const tier = getRideHailTiers(base).find((t) => t.id === tierId);
  return tier ? `${base} · ${tier.label}` : `${base} · ${tierId}`;
};
