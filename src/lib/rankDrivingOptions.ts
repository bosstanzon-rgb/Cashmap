import type { ZoneAdvice } from "@/hooks/useZoneAdvice";
import { distanceKm } from "@/lib/geo";
import type { PredictedZone } from "@/hooks/usePredictBestZones";
import { getRideHailTiers, isRideHailPlatform } from "@/constants/markets";
import { POOL_SEGMENT_SUFFIX, pingSegmentMatchesTab } from "@/lib/locationPingSegments";

const bestPredictedForPlatform = (
  platform: string,
  all: PredictedZone[],
  loc: { lat: number; lng: number } | null
) => {
  const rows = all.filter((z) => pingSegmentMatchesTab(z.platform, platform));
  if (rows.length === 0) return null;
  if (loc) {
    return [...rows].sort(
      (a, b) =>
        distanceKm(loc, { lat: a.centerLat, lng: a.centerLng }) -
        distanceKm(loc, { lat: b.centerLat, lng: b.centerLng })
    )[0];
  }
  return [...rows].sort((a, b) => b.predictedScore - a.predictedScore)[0];
};

const blendBase = (
  zone: ZoneAdvice | null,
  pred: PredictedZone | null
): { midRph: number; score: number; driverCount: number; competitionLabel: string; suburb: string } => {
  const rtRph = zone ? (zone.estimatedMinRph + zone.estimatedMaxRph) / 2 : 0;
  const prRph = pred ? (pred.predictedMinRph + pred.predictedMaxRph) / 2 : 0;
  const rtSc = zone?.score ?? 0;
  const prSc = pred?.predictedScore ?? 0;
  const midRph = rtRph > 0 ? 0.55 * rtRph + 0.45 * prRph : prRph;
  const score = rtSc > 0 ? 0.55 * rtSc + 0.45 * prSc : prSc;
  return {
    midRph,
    score,
    driverCount: zone?.driverCount ?? 0,
    competitionLabel: zone?.competitionLabel ?? "—",
    suburb: zone?.suburb ?? pred?.suburb ?? "",
  };
};

const tierAdjustment = (earningsMultiplier: number, driverShareEstimate: number) => {
  const share = Math.max(0.04, driverShareEstimate);
  return earningsMultiplier / Math.sqrt(share);
};

export type DrivingOptionRank = {
  key: string;
  platform: string;
  tierId?: string;
  tierLabel?: string;
  estMidRph: number;
  score: number;
  competitionLabel: string;
  driverCount: number;
  suburb: string;
  reason: string;
};

export const formatDrivingOptionLabel = (opt: DrivingOptionRank) =>
  opt.tierLabel ? `${opt.platform} · ${opt.tierLabel}` : opt.platform;

const qualifiedTierIds = (
  platform: string,
  store: Record<string, string[]>
): string[] => {
  const cfg = getRideHailTiers(platform);
  if (!cfg.length) return [];
  const fromStore = store[platform];
  if (fromStore?.length) {
    const valid = fromStore.filter((id) => cfg.some((t) => t.id === id));
    if (valid.length) return valid;
  }
  return [cfg[0].id];
};

const activeTierId = (
  platform: string,
  qualified: string[],
  store: Record<string, string>
) => {
  const cur = store[platform];
  if (cur && qualified.includes(cur)) return cur;
  return qualified[0] ?? "";
};

export function rankDrivingOptions(args: {
  selectedPlatforms: string[];
  rideHailQualifiedTierIds: Record<string, string[]>;
  rideHailActiveTierId: Record<string, string>;
  getTopZoneForPlatform: (p: string) => ZoneAdvice | null;
  getTopZoneForSegment: (segmentKey: string) => ZoneAdvice | null;
  allPredictedZones: PredictedZone[];
  userLocation: { lat: number; lng: number } | null;
  selectedPlatformTab: string;
}): { ranked: DrivingOptionRank[]; current: DrivingOptionRank | null } {
  const platforms = [...new Set(args.selectedPlatforms.filter(Boolean))];
  const options: DrivingOptionRank[] = [];

  for (const platform of platforms) {
    if (!isRideHailPlatform(platform)) {
      const zone = args.getTopZoneForPlatform(platform);
      const pred = bestPredictedForPlatform(platform, args.allPredictedZones, args.userLocation);
      const base = blendBase(zone, pred);
      if (base.midRph <= 0 && base.score <= 0) continue;
      const reason = `Live + historical blend · ${base.competitionLabel.toLowerCase()} · ~${base.driverCount} drivers nearby`;
      options.push({
        key: `${platform}::__`,
        platform,
        estMidRph: Math.round(base.midRph),
        score: Number(base.score.toFixed(2)),
        competitionLabel: base.competitionLabel,
        driverCount: base.driverCount,
        suburb: base.suburb,
        reason,
      });
      continue;
    }

    const qIds = qualifiedTierIds(platform, args.rideHailQualifiedTierIds);
    const tierList = getRideHailTiers(platform);
    for (const tid of qIds) {
      const tier = tierList.find((t) => t.id === tid);
      if (!tier) continue;
      const seg = `${platform}::${tid}`;
      const poolSeg = `${platform}::${POOL_SEGMENT_SUFFIX}`;
      const zone =
        args.getTopZoneForSegment(seg) ??
        args.getTopZoneForSegment(poolSeg) ??
        args.getTopZoneForPlatform(platform);
      const pred = bestPredictedForPlatform(platform, args.allPredictedZones, args.userLocation);
      const base = blendBase(zone, pred);
      if (base.midRph <= 0 && base.score <= 0) continue;

      const hasTierTelemetry = Boolean(args.getTopZoneForSegment(seg));
      const adjRaw = tierAdjustment(tier.earningsMultiplier, tier.driverShareEstimate);
      const adj = hasTierTelemetry ? 1 + (adjRaw - 1) * 0.42 : adjRaw;
      const estMidRph = Math.round(base.midRph * adj);
      const score = Number((base.score * adj).toFixed(2));
      const reason = `${tier.label}: ~${estMidRph}/hr est · ${base.competitionLabel.toLowerCase()} · ~${base.driverCount} drivers (blend uses anonymized tier mix when available).`;
      options.push({
        key: `${platform}::${tid}`,
        platform,
        tierId: tid,
        tierLabel: tier.label,
        estMidRph,
        score,
        competitionLabel: base.competitionLabel,
        driverCount: base.driverCount,
        suburb: base.suburb,
        reason,
      });
    }
  }

  const ranked = options.sort((a, b) => b.estMidRph - a.estMidRph);

  const tab = args.selectedPlatformTab;
  let current: DrivingOptionRank | null = null;
  if (isRideHailPlatform(tab)) {
    const q = qualifiedTierIds(tab, args.rideHailQualifiedTierIds);
    const act = activeTierId(tab, q, args.rideHailActiveTierId);
    current = ranked.find((r) => r.platform === tab && r.tierId === act) ?? null;
  } else {
    current = ranked.find((r) => r.platform === tab && !r.tierId) ?? null;
  }

  return { ranked, current };
}
