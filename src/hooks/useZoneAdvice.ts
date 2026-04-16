import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchRecentLocationPings, supabase } from "@/services/supabase";
import { distanceKm, getSuburbName } from "@/lib/geo";
import { getMarketConfig } from "@/constants/markets";
import {
  normalizeActiveServiceModes,
  pingSegmentMatchesTab,
  segmentKeyForPlatformOnPing,
} from "@/lib/locationPingSegments";

export type ZoneAdvice = {
  id: string;
  platform: string;
  suburb: string;
  centerLat: number;
  centerLng: number;
  driverCount: number;
  orderDemand: number;
  score: number;
  estimatedMinRph: number;
  estimatedMaxRph: number;
  competitionLabel: "Low competition" | "Medium competition" | "High competition";
};

export const useZoneAdvice = (payload: {
  selectedPlatform: string;
  location?: { lat: number; lng: number } | null;
  marketCode?: string;
}) => {
  const market = getMarketConfig(payload.marketCode);
  const [zones, setZones] = useState<ZoneAdvice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());

  const refresh = useCallback(async () => {
    const current = payload.location ?? market.defaultCenter;
    setLoading(true);
    setError(null);
    try {
      const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const delta = 0.08; // ~8-9km bbox around user, then filtered to 5km
      const pings = await fetchRecentLocationPings({
        sinceIso,
        minLat: current.lat - delta,
        maxLat: current.lat + delta,
        minLng: current.lng - delta,
        maxLng: current.lng + delta,
      });
      const hour = new Date().getHours();
      const timeFactor = hour >= 18 && hour <= 22 ? 1.5 : hour >= 12 && hour <= 14 ? 1.3 : 1;
      const grouped = new Map<
        string,
        {
          platform: string;
          centerLat: number;
          centerLng: number;
          driverHashes: Set<string>;
          orderDemand: number;
        }
      >();
      pings.forEach((ping) => {
        if (distanceKm(current, { lat: ping.lat, lng: ping.lng }) > 5) return;
        const modes = normalizeActiveServiceModes(ping.active_service_modes);
        (ping.active_platforms ?? []).forEach((platform) => {
          if (!platform || typeof platform !== "string") return;
          const segment = segmentKeyForPlatformOnPing(platform, modes);
          const latCell = Math.round(ping.lat * 100) / 100;
          const lngCell = Math.round(ping.lng * 100) / 100;
          const key = `${segment}:${latCell}:${lngCell}`;
          const row = grouped.get(key) ?? {
            platform: segment,
            centerLat: latCell,
            centerLng: lngCell,
            driverHashes: new Set<string>(),
            orderDemand: 0,
          };
          row.orderDemand += 1;
          row.driverHashes.add(`${Math.round(ping.lat * 250)}:${Math.round(ping.lng * 250)}`);
          grouped.set(key, row);
        });
      });
      const computed: ZoneAdvice[] = Array.from(grouped.entries()).map(([id, row]) => {
        const driverCount = row.driverHashes.size;
        const score = (row.orderDemand / (driverCount + 1)) * timeFactor;
        const earningsBase = Math.max(100, Math.round(score * 20));
        const suburb = getSuburbName(row.centerLat, row.centerLng, market.city);
        return {
          id,
          platform: row.platform,
          suburb,
          centerLat: row.centerLat,
          centerLng: row.centerLng,
          driverCount,
          orderDemand: row.orderDemand,
          score: Number(score.toFixed(2)),
          estimatedMinRph: Math.max(80, Math.round(earningsBase * 0.85)),
          estimatedMaxRph: Math.max(130, Math.round(earningsBase * 1.25)),
          competitionLabel:
            driverCount <= 8
              ? "Low competition"
              : driverCount <= 15
              ? "Medium competition"
              : "High competition",
        };
      });
      setZones(computed.sort((a, b) => b.score - a.score));
      setLastUpdated(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh zone advice.");
    } finally {
      setLoading(false);
    }
  }, [market, payload.location]);

  useEffect(() => {
    void refresh();
    // Refresh every 5 minutes as a fallback (realtime subscription handles live updates)
    const interval = setInterval(() => {
      void refresh();
    }, 5 * 60 * 1000);
    const channelName = `zone-advice-${payload.selectedPlatform}-${payload.marketCode ?? "ZA"}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "location_pings" },
        () => {
          void refresh();
        }
      )
      .subscribe();
    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const getTopZoneForPlatform = useCallback(
    (platform: string) =>
      zones
        .filter((z) => pingSegmentMatchesTab(z.platform, platform))
        .sort((a, b) => b.score - a.score)[0] ?? null,
    [zones]
  );
  const getTopZoneForSegment = useCallback(
    (segmentKey: string) =>
      zones.filter((z) => z.platform === segmentKey).sort((a, b) => b.score - a.score)[0] ?? null,
    [zones]
  );
  const getZonesForPlatform = (platform: string) =>
    zones.filter((z) => pingSegmentMatchesTab(z.platform, platform));
  const totalZones = useMemo(() => zones.length, [zones]);
  const selectedZones = useMemo(
    () => zones.filter((zone) => pingSegmentMatchesTab(zone.platform, payload.selectedPlatform)),
    [payload.selectedPlatform, zones]
  );
  return {
    zones: selectedZones,
    getTopZoneForPlatform,
    getTopZoneForSegment,
    getZonesForPlatform,
    totalZones,
    loading,
    error,
    lastUpdated,
    refresh,
  };
};
