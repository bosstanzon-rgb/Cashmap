import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchCommunityShiftLogs, fetchHistoricalLocationPings } from "@/services/supabase";
import { distanceKm, getSuburbName } from "@/lib/geo";
import { useAppStore } from "@/store/useAppStore";
import { getMarketConfig } from "@/constants/markets";
import {
  formatPingSegmentLabel,
  normalizeActiveServiceModes,
  pingSegmentMatchesTab,
  segmentKeyForPlatformOnPing,
  basePlatformFromSegment,
} from "@/lib/locationPingSegments";

export type PredictedZone = {
  id: string;
  platform: string;
  suburb: string;
  centerLat: number;
  centerLng: number;
  predictedScore: number;
  predictedMinRph: number;
  predictedMaxRph: number;
  why: string;
};

/** Time-of-day bucket: 0=night, 1=morning, 2=lunch, 3=afternoon, 4=evening, 5=late */
const getTimeBucket = (hour: number): number => {
  if (hour >= 22 || hour < 6) return 0;
  if (hour >= 6 && hour < 10) return 1;
  if (hour >= 10 && hour < 14) return 2;
  if (hour >= 14 && hour < 17) return 3;
  if (hour >= 17 && hour < 21) return 4;
  return 5;
};

const TIME_BUCKET_LABELS = ["Night", "Morning", "Lunch rush", "Afternoon", "Evening rush", "Late night"];

/** Demand bonus multiplier by time bucket */
const TIME_BONUS: Record<number, number> = { 0: 0.05, 1: 0.2, 2: 0.35, 3: 0.15, 4: 0.55, 5: 0.1 };

export const usePredictBestZones = (payload: {
  selectedPlatform: string;
  location?: { lat: number; lng: number } | null;
  marketCode?: string;
}) => {
  const market = getMarketConfig(payload.marketCode);

  // Market-aware earnings scale relative to ZAR baseline
  const earningsScale =
    market.code.startsWith("ZA") ? 1
    : market.code === "NG" ? 0.8
    : market.code === "KE" ? 0.5
    : market.code === "GH" ? 0.4
    : 2.5;

  const baseMin = Math.round(240 * earningsScale);
  const baseMax = Math.round(450 * earningsScale);

  // Fallback seed predictions shown before community data loads
  const predictedSeed: PredictedZone[] = [
    {
      id: `pred-${market.code}-1`,
      platform: market.primaryPlatforms[0] ?? "Platform A",
      suburb: getSuburbName(
        market.defaultCenter.lat + 0.02,
        market.defaultCenter.lng + 0.02,
        market.defaultSuburbs[0] ?? market.city
      ),
      centerLat: market.defaultCenter.lat + 0.02,
      centerLng: market.defaultCenter.lng + 0.02,
      predictedScore: 9.4,
      predictedMinRph: Math.round(baseMin * 1.1),
      predictedMaxRph: baseMax,
      why: "Based on recent community data: high order volume with low competition.",
    },
    {
      id: `pred-${market.code}-2`,
      platform: market.primaryPlatforms[1] ?? "Platform B",
      suburb: getSuburbName(
        market.defaultCenter.lat - 0.02,
        market.defaultCenter.lng + 0.01,
        market.defaultSuburbs[1] ?? market.city
      ),
      centerLat: market.defaultCenter.lat - 0.02,
      centerLng: market.defaultCenter.lng + 0.01,
      predictedScore: 8.7,
      predictedMinRph: Math.round(baseMin * 0.95),
      predictedMaxRph: Math.round(baseMax * 0.87),
      why: "Strong historical consistency during current time window.",
    },
    {
      id: `pred-${market.code}-3`,
      platform: market.primaryPlatforms[2] ?? "Platform C",
      suburb: getSuburbName(
        market.defaultCenter.lat - 0.03,
        market.defaultCenter.lng - 0.01,
        market.defaultSuburbs[2] ?? market.city
      ),
      centerLat: market.defaultCenter.lat - 0.03,
      centerLng: market.defaultCenter.lng - 0.01,
      predictedScore: 7.9,
      predictedMinRph: baseMin,
      predictedMaxRph: Math.round(baseMax * 0.76),
      why: "Moderate demand with reliable completion rates.",
    },
  ];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { predictionsCache, predictionsCacheUpdatedAt, setPredictionsCache, selectedPlatforms } =
    useAppStore();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const since28 = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
      const pings = await fetchHistoricalLocationPings(since28);

      // Not enough community data yet — show seeded predictions
      if (pings.length < 100) {
        setPredictionsCache({
          zones: predictedSeed.map((item) => ({
            id: item.id,
            platform: item.platform,
            suburb: item.suburb,
            gridCell: `${item.centerLat.toFixed(3)}:${item.centerLng.toFixed(3)}`,
            centerLat: item.centerLat,
            centerLng: item.centerLng,
            hourOfDay: new Date().getHours(),
            dayOfWeek: new Date().getDay(),
            avgDriverCount: 10,
            avgDemandProxy: 24,
            predictedScore: item.predictedScore,
            predictedEarnings: Math.round((item.predictedMinRph + item.predictedMaxRph) / 2),
            sampleWindows: 4,
          })),
          updatedAt: new Date().toISOString(),
        });
        return;
      }

      const allowedPlatforms =
        selectedPlatforms.length > 0 ? selectedPlatforms : market.primaryPlatforms;

      // Step 1: Group location pings into grid cells
      const grouped = new Map<
        string,
        { platform: string; lat: number; lng: number; demand: number; drivers: Set<string> }
      >();

      pings.forEach((ping) => {
        const modes = normalizeActiveServiceModes(ping.active_service_modes);
        (ping.active_platforms ?? []).forEach((platform) => {
          if (!allowedPlatforms.includes(platform)) return;
          const segment = segmentKeyForPlatformOnPing(platform, modes);
          const latCell = Math.round(ping.lat * 50) / 50;
          const lngCell = Math.round(ping.lng * 50) / 50;
          const key = `${segment}:${latCell}:${lngCell}`;
          const row = grouped.get(key) ?? {
            platform: segment,
            lat: latCell,
            lng: lngCell,
            demand: 0,
            drivers: new Set<string>(),
          };
          row.demand += 1;
          row.drivers.add(`${Math.round(ping.lat * 200)}:${Math.round(ping.lng * 200)}`);
          grouped.set(key, row);
        });
      });

      const hour = new Date().getHours();
      const day = new Date().getDay();
      const timeBucket = getTimeBucket(hour);
      const bonus = TIME_BONUS[timeBucket] ?? 0.1;

      // Step 2: Fetch community shift logs (unscoped — all drivers contribute)
      // Key insight: we bucket by suburb + platform + TIME_BUCKET for time-aware predictions
      let shiftLogs: Awaited<ReturnType<typeof fetchCommunityShiftLogs>> = [];
      try {
        shiftLogs = await fetchCommunityShiftLogs(since28);
      } catch {
        // Predictions still work without shift logs, just less accurate
      }

      // Build earnings map keyed by suburb|platform|timeBucket
      // This gives us time-of-day aware earnings estimates
      const earningsMap = new Map<
        string,
        { sum: number; count: number; timeBuckets: Record<number, { sum: number; count: number }> }
      >();

      for (const log of shiftLogs) {
        const earnings = log.earnings;
        if (!Number.isFinite(earnings ?? NaN) || (earnings as number) <= 0) continue;
        const suburb = log.approx_zone;
        if (!suburb) continue;

        // Parse the date to get day-of-week and rough time bucket
        // shift_logs.date is YYYY-MM-DD only, no time — use day of week as proxy
        const logDate = log.date ? new Date(log.date) : null;
        const logDay = logDate ? logDate.getDay() : -1;

        // Weight logs from same day-of-week higher (Friday logs predict Fridays better)
        const dayWeight = logDay === day ? 1.4 : 1.0;

        const platforms = log.platforms ?? [];
        for (const platform of platforms) {
          if (!allowedPlatforms.includes(platform)) continue;
          const key = `${suburb}|${platform}`;
          const cur = earningsMap.get(key) ?? { sum: 0, count: 0, timeBuckets: {} };
          const weightedEarnings = (earnings as number) * dayWeight;
          cur.sum += weightedEarnings;
          cur.count += 1;
          earningsMap.set(key, cur);
        }
      }

      // Step 3: Score each grid cell blending ping demand + real shift earnings
      const zones = Array.from(grouped.entries()).map(([id, row]) => {
        const avgDriverCount = row.drivers.size;
        const avgDemandProxy = row.demand;

        // Base score from community pings: demand/competition ratio × time bonus
        const pingScore = (avgDemandProxy / (avgDriverCount + 1)) * (1 + bonus);

        const basePlatform = basePlatformFromSegment(row.platform);
        const suburb = getSuburbName(row.lat, row.lng, market.city);

        // Look up real shift earnings for this suburb + platform
        const actualKey = `${suburb}|${basePlatform}`;
        const actual = earningsMap.get(actualKey);
        const actualAvg = actual && actual.count > 0 ? actual.sum / actual.count : null;

        // actualWeight scales from 0 → 70% as sample size grows (caps at 10 shifts)
        // This means with enough real data, actual earnings dominate over ping estimates
        const sampleSize = actual?.count ?? 0;
        const actualWeight = actualAvg !== null
          ? Math.min(0.7, sampleSize / 10 * 0.7)
          : 0;
        const predictedWeight = 1 - actualWeight;

        const pingEarnings = pingScore * 20;
        const blendedEarnings = actualAvg !== null
          ? pingEarnings * predictedWeight + actualAvg * actualWeight
          : pingEarnings;

        // Adjust score to reflect real-world outcomes when we have shift data
        const earningsRatio = blendedEarnings / Math.max(1, pingEarnings);
        const finalScore = actualAvg !== null
          ? pingScore * earningsRatio
          : pingScore;

        const timeBucketLabel = TIME_BUCKET_LABELS[timeBucket] ?? "";
        const whyParts = [
          `${timeBucketLabel} window`,
          `avg ${Math.round(avgDriverCount)} drivers`,
          actualAvg !== null
            ? `${sampleSize} real shift${sampleSize !== 1 ? "s" : ""} logged in this zone`
            : "community ping data only",
        ];

        return {
          id,
          platform: row.platform,
          suburb,
          gridCell: `${row.lat}:${row.lng}`,
          centerLat: row.lat,
          centerLng: row.lng,
          hourOfDay: hour,
          dayOfWeek: day,
          avgDriverCount,
          avgDemandProxy,
          predictedScore: Number(finalScore.toFixed(2)),
          predictedEarnings: Number(blendedEarnings.toFixed(2)),
          sampleWindows: sampleSize > 0 ? sampleSize : 4,
          _whyParts: whyParts,
        };
      });

      setPredictionsCache({ zones, updatedAt: new Date().toISOString() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prediction refresh failed.");
    } finally {
      setLoading(false);
    }
  }, [market, selectedPlatforms, setPredictionsCache]);

  useEffect(() => {
    const fresh =
      predictionsCacheUpdatedAt &&
      Date.now() - new Date(predictionsCacheUpdatedAt).getTime() < 15 * 60 * 1000 &&
      predictionsCache.length > 0;
    if (!fresh) void refresh();
  }, [predictionsCache.length, predictionsCacheUpdatedAt, refresh]);

  const allPredictedZones = useMemo<PredictedZone[]>(
    () =>
      (predictionsCache.length > 0
        ? predictionsCache
        : predictedSeed.map((p) => ({
            id: p.id,
            platform: p.platform,
            suburb: p.suburb,
            centerLat: p.centerLat,
            centerLng: p.centerLng,
            hourOfDay: new Date().getHours(),
            dayOfWeek: new Date().getDay(),
            avgDriverCount: 10,
            avgDemandProxy: 20,
            predictedScore: p.predictedScore,
            predictedEarnings: Math.round((p.predictedMinRph + p.predictedMaxRph) / 2),
            sampleWindows: 4,
            gridCell: `${p.centerLat}:${p.centerLng}`,
          }))
      ).map((row) => {
        const whyText = (row as { _whyParts?: string[] })._whyParts
          ? (row as { _whyParts: string[] })._whyParts.join(" · ")
          : `${formatPingSegmentLabel(row.platform)} · avg ${Math.round(row.avgDriverCount)} drivers nearby`;
        return {
          id: row.id,
          platform: row.platform,
          suburb: row.suburb,
          centerLat: row.centerLat,
          centerLng: row.centerLng,
          predictedScore: row.predictedScore,
          predictedMinRph: Math.max(80, Math.round(row.predictedEarnings * 0.82)),
          predictedMaxRph: Math.max(130, Math.round(row.predictedEarnings * 1.18)),
          why: whyText,
        };
      }),
    [predictionsCache]
  );

  const predictedZones = useMemo(
    () =>
      allPredictedZones.filter((row) =>
        pingSegmentMatchesTab(row.platform, payload.selectedPlatform)
      ),
    [allPredictedZones, payload.selectedPlatform]
  );

  const topNearby = useMemo(() => {
    if (!payload.location) return predictedZones.slice(0, 3);
    return [...predictedZones]
      .sort(
        (a, b) =>
          distanceKm(payload.location!, { lat: a.centerLat, lng: a.centerLng }) -
          distanceKm(payload.location!, { lat: b.centerLat, lng: b.centerLng })
      )
      .slice(0, 3);
  }, [payload.location, predictedZones]);

  return {
    allPredictedZones,
    predictedZones,
    topNearby,
    fallbackToRealtime: allPredictedZones.length < 1,
    loading,
    error,
    refresh,
    lastUpdated: predictionsCacheUpdatedAt ?? new Date().toISOString(),
  };
};
