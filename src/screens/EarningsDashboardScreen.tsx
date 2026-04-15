import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useNavigation } from "@react-navigation/native";
import Constants from "expo-constants";
import { fetchMileageLogs, fetchShiftLogs, isSupabaseConfigured } from "@/services/supabase";
import { SHIFT_PROMPT_PENDING_KEY } from "@/constants/storage";
import { useMileageStore } from "@/store/mileageStore";
import { useAppStore } from "@/store/useAppStore";
import { selectEntitledToPro, useProStore } from "@/store/proStore";
import { getMarketConfig, formatMoney } from "@/constants/markets";
import { t } from "@/constants/i18n";
import { WeeklyEarningsVictoryChart, type WeeklyChartDatum } from "@/components/WeeklyEarningsChart";
import { DisclaimerFooter } from "@/components/DisclaimerFooter";
import { MvpDisclaimerBanner } from "@/components/MvpDisclaimerBanner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { CM } from "@/constants/theme";
import { PremiumPressable } from "@/components/PremiumPressable";
import { BTN_PRIMARY_TEXT } from "@/constants/buttonStyles";

type ShiftLogDayAgg = {
  date: string;
  earningsSum: number;
  platforms: string[];
  deliveriesSum: number;
  rating: string | null;
};

const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

const sumFinite = (v: number | null | undefined) => (Number.isFinite(v ?? NaN) ? (v as number) : 0);
const toIsoDateFromRow = (row: { date?: string | null; timestamp?: string | null }) => {
  const explicit = row.date?.trim();
  if (explicit) return explicit;
  const ts = row.timestamp?.trim();
  if (!ts) return null;
  return ts.slice(0, 10);
};

const uniq = (arr: string[]) => Array.from(new Set(arr));

const asStringArray = (v: unknown): string[] => {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
};

const estimateHoursFromDeliveries = (deliveries: number) => deliveries / 3;

export const EarningsDashboardScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const marketCode = useAppStore((s) => s.marketCode);
  const languageCode = useAppStore((s) => s.languageCode);
  const market = getMarketConfig(marketCode);

  const isPro = useProStore(selectEntitledToPro);
  const openUpgradeModal = useProStore((s) => s.openUpgradeModal);
  const { todayKm, weeklyKm, totalKm, lastLocation, refreshAll } = useMileageStore((s) => ({
    todayKm: s.todayKm,
    weeklyKm: s.weeklyKm,
    totalKm: s.totalKm,
    lastLocation: s.lastLocation,
    refreshAll: s.refreshAll,
  }));

  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shiftLogs, setShiftLogs] = useState<Awaited<ReturnType<typeof fetchShiftLogs>>>([]);
  const [mileageLogs, setMileageLogs] = useState<Awaited<ReturnType<typeof fetchMileageLogs>>>([]);
  const [error, setError] = useState<string | null>(null);

  const appVersion = Constants.expoConfig?.version ?? "—";

  const last7Days = useMemo(() => {
    const end = new Date();
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      days.push(toIsoDate(d));
    }
    return days;
  }, []);

  const start7Iso = last7Days[0];
  const end7Iso = last7Days[last7Days.length - 1];

  const aggregatedByDay = useMemo(() => {
    const map = new Map<string, ShiftLogDayAgg>();
    for (const log of shiftLogs) {
      const date = log.date;
      if (!date) continue;
      const existing = map.get(date) ?? {
        date,
        earningsSum: 0,
        platforms: [],
        deliveriesSum: 0,
        rating: null,
      };
      existing.earningsSum += sumFinite(log.earnings ?? undefined);
      existing.platforms = uniq([...existing.platforms, ...asStringArray(log.platforms)]);
      existing.deliveriesSum += Number.isFinite(log.deliveries ?? NaN) ? (log.deliveries as number) : 0;
      if (log.rating) existing.rating = log.rating;
      map.set(date, existing);
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => (a.date < b.date ? 1 : -1));
    return arr;
  }, [shiftLogs]);

  const shiftByDate = useMemo(() => {
    const m = new Map<string, ShiftLogDayAgg>();
    for (const d of aggregatedByDay) m.set(d.date, d);
    return m;
  }, [aggregatedByDay]);

  const kmByDateAll = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of mileageLogs) {
      const date = toIsoDateFromRow(row);
      if (!date) continue;
      map.set(date, (map.get(date) ?? 0) + (row.km_added ?? row.km ?? 0));
    }
    return map;
  }, [mileageLogs]);

  const kmByDate7 = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of last7Days) {
      map.set(d, kmByDateAll.get(d) ?? 0);
    }
    return map;
  }, [kmByDateAll, last7Days]);

  const todayEarnings = shiftByDate.get(toIsoDate(new Date()))?.earningsSum ?? 0;
  const weekEarnings = aggregatedByDay
    .filter((d) => d.date >= start7Iso && d.date <= end7Iso)
    .reduce((s, d) => s + d.earningsSum, 0);
  const weekDeliveries = aggregatedByDay
    .filter((d) => d.date >= start7Iso && d.date <= end7Iso)
    .reduce((s, d) => s + d.deliveriesSum, 0);
  const weekHours = estimateHoursFromDeliveries(weekDeliveries);
  const avgRph = weekHours > 0 ? weekEarnings / weekHours : null;
  const totalEarnings = shiftLogs.reduce((s, log) => s + sumFinite(log.earnings ?? undefined), 0);

  const chartData = useMemo(() => {
    return last7Days.map((d) => ({
      date: d,
      dayLabel: new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" }),
      earnings: shiftByDate.get(d)?.earningsSum ?? 0,
      km: kmByDate7.get(d) ?? 0,
    }));
  }, [last7Days, shiftByDate, kmByDate7]);

  const chartMaxE = useMemo(() => Math.max(1, ...chartData.map((d) => d.earnings)), [chartData]);
  const chartMaxK = useMemo(() => Math.max(1, ...chartData.map((d) => d.km)), [chartData]);

  /** Normalized points for Victory (shared 0–100 vertical scale). */
  const weeklyVictoryData: WeeklyChartDatum[] = useMemo(
    () =>
      chartData.map((d, i) => ({
        i,
        dayLabel: d.dayLabel,
        e: chartMaxE > 0 ? (d.earnings / chartMaxE) * 100 : 0,
        k: chartMaxK > 0 ? (d.km / chartMaxK) * 100 : 0,
      })),
    [chartData, chartMaxE, chartMaxK]
  );

  const recentShiftDays = useMemo(() => aggregatedByDay.slice(0, 5), [aggregatedByDay]);

  const hasNoActivity = todayKm <= 0 && totalEarnings <= 0 && aggregatedByDay.length === 0;

  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      await refreshAll();
      if (!isSupabaseConfigured()) {
        setShiftLogs([]);
        setMileageLogs([]);
        return;
      }
      const since10Years = new Date();
      since10Years.setDate(since10Years.getDate() - 3650);
      const since10Iso = since10Years.toISOString();
      const since30Iso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [newShiftLogs, newMileageLogs] = await Promise.all([
        fetchShiftLogs(since10Iso),
        fetchMileageLogs(since30Iso),
      ]);
      setShiftLogs(newShiftLogs);
      setMileageLogs(newMileageLogs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh");
    } finally {
      setRefreshing(false);
      setInitialLoad(false);
    }
  };

  useEffect(() => {
    void onRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLogToday = async () => {
    const payload = {
      timestamp: new Date().toISOString(),
      lat: lastLocation?.lat ?? 0,
      lng: lastLocation?.lng ?? 0,
    };
    await AsyncStorage.setItem(SHIFT_PROMPT_PENDING_KEY, JSON.stringify(payload));
    navigation.navigate("HomeMap", { forceShiftLogger: true });
  };

  /** CSV merge of shift logs + mileage (30 days). Anonymous Supabase rows; use for your own tax prep — not official advice. */
  const exportTaxesCsv = async () => {
    try {
      setError(null);
      const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [logs30, miles30] = await Promise.all([fetchShiftLogs(sinceIso), fetchMileageLogs(sinceIso)]);

      const earningsByDate = new Map<string, { earnings: number; platforms: string[]; rating: string | null }>();
      for (const log of logs30) {
        const date = log.date;
        if (!date) continue;
        const cur = earningsByDate.get(date) ?? { earnings: 0, platforms: [], rating: null };
        cur.earnings += sumFinite(log.earnings ?? undefined);
        cur.platforms = uniq([...cur.platforms, ...asStringArray(log.platforms)]);
        if (log.rating) cur.rating = log.rating;
        earningsByDate.set(date, cur);
      }

      const kmByDateExport = new Map<string, number>();
      for (const row of miles30) {
        const date = toIsoDateFromRow(row);
        if (!date) continue;
        kmByDateExport.set(date, (kmByDateExport.get(date) ?? 0) + (row.km_added ?? row.km ?? 0));
      }

      const allDates = Array.from(
        new Set([...Array.from(kmByDateExport.keys()), ...Array.from(earningsByDate.keys())])
      ).sort();

      const csvLines: string[] = ["date,km_tracked,earnings,rating,platforms"];
      for (const date of allDates) {
        const km = kmByDateExport.get(date) ?? 0;
        const earn = earningsByDate.get(date);
        const earnings = earn?.earnings ?? 0;
        const rating = earn?.rating ?? "";
        const platforms = (earn?.platforms ?? []).join("|");
        csvLines.push(`${date},${km.toFixed(3)},${earnings.toFixed(0)},${rating.replaceAll(",", ";")},${platforms.replaceAll(",", ";")}`);
      }

      const uri = `${FileSystem.cacheDirectory}cashmap-taxes-${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(uri, `${csvLines.join("\n")}\n`, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "text/csv",
          dialogTitle: "Share CashMap export",
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to export CSV");
    }
  };

  const shareStats = async () => {
    const kmText = totalKm.toFixed(0);
    const earningsText = totalEarnings > 0 ? formatMoney(totalEarnings, marketCode) : null;
    const weekText = weekEarnings > 0 ? formatMoney(weekEarnings, marketCode) : null;
    const lines = [
      "🗺️ CashMap — My driver stats",
      "",
      weekText ? `💰 This week: ${weekText}` : null,
      earningsText ? `📈 All-time earnings logged: ${earningsText}` : null,
      `📍 Total km tracked: ${kmText} km`,
      "",
      "Track your zones, km & earnings → CashMap app",
      "Estimates only. Not financial advice.",
    ].filter(Boolean).join("\n");
    try {
      await Share.share({ message: lines });
    } catch {
      // user dismissed
    }
  };

  const pad = { paddingHorizontal: 20, paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 32) };

  if (initialLoad && refreshing) {
    return (
      <ScrollView
        className="flex-1 bg-cm-canvas"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: Math.max(insets.bottom, 32),
        }}
        nestedScrollEnabled={Platform.OS === "android"}
      >
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-[11px] font-bold uppercase tracking-widest text-cm-accent">CashMap</Text>
            <Text className="text-[28px] font-bold text-cm-ink">{t("earnings", languageCode)}</Text>
          </View>
        </View>
        <View className="mt-6 items-center rounded-3xl border border-white/10 bg-cm-surface/95 p-8 shadow-cm-card">
          <ActivityIndicator color={CM.accent} />
          <Text className="mt-4 text-[14px] text-cm-ink-secondary">Loading your earnings…</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-cm-canvas"
      contentContainerStyle={pad}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled={Platform.OS === "android"}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-[11px] font-bold uppercase tracking-widest text-cm-accent">CashMap</Text>
          <Text className="text-[28px] font-bold text-cm-ink">{t("earnings", languageCode)}</Text>
          <Text className="mt-1 text-[12px] text-cm-ink-tertiary">v{appVersion}</Text>
        </View>
        <View className="flex-1 mt-2">
          <Text className="text-[13px] leading-5 text-cm-ink-secondary">Your earnings, km tracked, and shift history — all in one place. Export your km log for tax deductions anytime.</Text>
        </View>
        </View>
        <PremiumPressable
          variant={refreshing ? "none" : "secondaryAccent"}
          className={
            refreshing
              ? "min-h-14 justify-center rounded-full border-[1.5px] border-white/10 bg-cm-muted px-6 py-3"
              : "px-6"
          }
          disabled={refreshing}
          onPress={() => void onRefresh()}
        >
          {refreshing ? (
            <ActivityIndicator color={CM.accent} size="small" />
          ) : (
            <Text className="text-center text-[13px] font-bold uppercase tracking-wide text-cm-accent">Refresh</Text>
          )}
        </PremiumPressable>
      </View>
      </View>
      <OfflineBanner />
      <MvpDisclaimerBanner className="mt-4" />

      {hasNoActivity ? (
        <View className="mt-5 rounded-3xl border border-dashed border-white/15 bg-cm-surface/80 p-6 shadow-cm-inner">
          <Text className="text-[20px] font-bold text-cm-ink">No activity yet</Text>
          <Text className="mt-2 text-[14px] leading-6 text-cm-ink-secondary">
            To get started:
          </Text>
          <Text className="mt-2 text-[13px] leading-6 text-cm-ink-secondary">1. Go to the Map tab and tap &quot;I'm Working&quot; before your shift</Text>
          <Text className="mt-1 text-[13px] leading-6 text-cm-ink-secondary">2. CashMap tracks your km automatically in the background</Text>
          <Text className="mt-1 text-[13px] leading-6 text-cm-ink-secondary">3. When done, log your earnings using the button below</Text>
          <Text className="mt-1 text-[13px] leading-6 text-cm-ink-secondary">4. Export your km log for tax deductions anytime</Text>
          <PremiumPressable variant="primary" className="mt-4 w-full shadow-cm-glow-sm" onPress={() => navigation.navigate("HomeMap" as never)}>
            <Text className={`${BTN_PRIMARY_TEXT} text-[15px]`}>Open Map</Text>
          </PremiumPressable>
        </View>
      ) : null}

      {error ? <Text className="mt-4 text-[13px] text-cm-danger">{error}</Text> : null}

      {/* Summary: today, week, avg R/hr */}
      <View className="mt-6 flex-row flex-wrap gap-3">
        <View className="min-w-[30%] flex-1 rounded-2xl border border-white/10 bg-cm-surface p-4">
          <Text className="text-[12px] font-semibold text-cm-ink-tertiary">Today</Text>
          <Text className="mt-2 text-[17px] font-bold leading-6 text-cm-accent">{formatMoney(todayEarnings, marketCode)}</Text>
          <Text className="mt-1 text-[12px] text-cm-ink-tertiary">{todayKm.toFixed(1)} km</Text>
        </View>
        <View className="min-w-[30%] flex-1 rounded-2xl border border-white/10 bg-cm-surface p-4">
          <Text className="text-[12px] font-semibold text-cm-ink-tertiary">This week</Text>
          <Text className="mt-2 text-[17px] font-bold leading-6 text-cm-accent">{formatMoney(weekEarnings, marketCode)}</Text>
          <Text className="mt-1 text-[12px] text-cm-ink-tertiary">{weeklyKm.toFixed(1)} km</Text>
        </View>
        <View className="min-w-[30%] flex-1 rounded-2xl border border-white/10 bg-cm-surface p-4">
          <Text className="text-[12px] font-semibold text-cm-ink-tertiary">Avg R/hr</Text>
          <Text className="mt-2 text-[17px] font-bold leading-6 text-cm-cyan">
            {avgRph !== null ? `${formatMoney(avgRph, marketCode)}/hr` : "—"}
          </Text>
          <Text className="mt-1 text-[11px] leading-4 text-cm-ink-tertiary">From logged shifts (rough)</Text>
        </View>
      </View>

      <View className="mt-4 rounded-2xl border border-white/10 bg-cm-surface p-5">
        <Text className="text-[12px] font-semibold text-cm-ink-tertiary">All-time</Text>
        <Text className="mt-2 text-xl font-bold text-cm-accent">{formatMoney(totalEarnings, marketCode)}</Text>
        <Text className="mt-1 text-[14px] text-cm-ink-tertiary">{totalKm.toFixed(0)} km tracked</Text>
      </View>

      {/* Victory Native weekly chart */}
      <View className="mt-5 rounded-2xl border border-white/10 bg-cm-surface p-5">
        <Text className="text-[15px] font-bold text-cm-ink">Last 7 days</Text>
        <Text className="mt-1 text-[12px] leading-5 text-cm-ink-tertiary">Green bars show daily earnings · Cyan bars show km driven (both scaled to fit)</Text>
        <WeeklyEarningsVictoryChart data={weeklyVictoryData} height={210} />
        <View className="mt-2 flex-row flex-wrap justify-between gap-1">
          {chartData.map((d) => (
            <Text key={d.date} className="w-[13%] text-center text-[11px] text-cm-ink-secondary">
              {d.dayLabel}
            </Text>
          ))}
        </View>
      </View>

      <View className="mt-5 rounded-2xl border border-white/10 bg-cm-surface p-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-[15px] font-bold text-cm-ink">Recent shift logs</Text>
          <Text className="text-[11px] text-cm-ink-tertiary">Tap &quot;Log today&quot; to add</Text>
        </View>

        {recentShiftDays.length === 0 ? (
          <Text className="mt-4 text-[14px] leading-6 text-cm-ink-secondary">
            No shift logs yet. After a Gauteng run, use the end-of-shift prompt (stationary ~25 min) or log manually
            below.
          </Text>
        ) : (
          <View className="mt-4 gap-3">
            {recentShiftDays.map((d) => {
              const km = kmByDateAll.get(d.date) ?? 0;
              const topPlatforms = d.platforms.slice(0, 2);
              const extra = Math.max(0, d.platforms.length - topPlatforms.length);
              return (
                <View key={d.date} className="rounded-2xl border border-white/10 bg-cm-raised/90 p-4 shadow-cm-inner">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[13px] font-semibold text-cm-ink">{d.date}</Text>
                    <Text className="text-[14px] font-bold text-cm-accent">{formatMoney(d.earningsSum, marketCode)}</Text>
                  </View>
                  <Text className="mt-2 text-[12px] text-cm-ink-tertiary">{km.toFixed(1)} km</Text>
                  <Text className="mt-2 text-[12px] text-cm-ink-tertiary">
                    {topPlatforms.join(" • ")}
                    {extra > 0 ? ` +${extra}` : ""}
                  </Text>
                  {d.rating ? <Text className="mt-1 text-[12px] text-cm-ink-tertiary">Rating: {d.rating}</Text> : null}
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View className="mt-5 gap-3">
        <PremiumPressable variant="primary" className="w-full shadow-cm-glow-sm" onPress={() => void onLogToday()}>
          <Text className={`${BTN_PRIMARY_TEXT} text-[15px]`}>Log today&apos;s earnings</Text>
        </PremiumPressable>
        <PremiumPressable
          variant="none"
          className="min-h-14 w-full justify-center rounded-full border-[1.5px] border-cm-accent/40 bg-cm-accent-soft px-8 py-4 shadow-cm-inner"
          onPress={() => void exportTaxesCsv()}
        >
          <Text className="text-center text-[15px] font-bold text-cm-accent">Export for taxes (CSV)</Text>
        </PremiumPressable>
        <PremiumPressable
          variant="none"
          className="min-h-14 w-full justify-center rounded-full border-[1.5px] border-white/15 bg-cm-raised px-8 py-4"
          onPress={() => void shareStats()}
        >
          <Text className="text-center text-[15px] font-bold text-cm-ink-secondary">📤 Share my stats</Text>
        </PremiumPressable>
        {!isPro ? (
          <Text className="text-center text-[11px] leading-4 text-cm-ink-tertiary">
            Pro adds live driver density, R/hr predictions, alerts, and peer benchmarks — exports include the km you
            already track.
          </Text>
        ) : null}
      </View>

      {/* Benchmarking — Pro only */}
      <View className="mt-5 rounded-2xl border border-white/10 bg-cm-surface p-5">
        <Text className="text-[15px] font-bold text-cm-ink">Benchmarks</Text>
        <Text className="mt-3 text-[14px] leading-6 text-cm-ink-secondary">
          Your avg this week:{" "}
          <Text className="font-bold text-cm-accent">
            {avgRph !== null ? `${formatMoney(avgRph, marketCode)}/hr` : "—"}
          </Text>
        </Text>
        {isPro ? (
          <Text className="mt-3 text-[13px] leading-5 text-cm-ink-tertiary">
            Example: evening drivers in major metros often see higher R/hr than midday — community estimates only.
          </Text>
        ) : (
          <PremiumPressable
            variant="none"
            className="mt-3 min-h-16 w-full justify-center rounded-[24px] border-[1.5px] border-cm-warn/35 bg-cm-warn-dim px-5 py-4"
            onPress={() => openUpgradeModal()}
          >
            <Text className="text-center text-[13px] font-semibold leading-5 text-cm-warn">
              {t("proLockBenchmarkEveningTeaser", languageCode)}
            </Text>
            <Text className="mt-2 text-center text-[12px] font-bold text-cm-accent">Unlock with Pro →</Text>
          </PremiumPressable>
        )}
      </View>

      <DisclaimerFooter />
    </ScrollView>
  );
};
