import { useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { usePredictBestZones } from "@/hooks/usePredictBestZones";
import { useZoneAdvice } from "@/hooks/useZoneAdvice";
import { formatMoney, getMarketConfig } from "@/constants/markets";
import { useAppStore } from "@/store/useAppStore";
import { selectEntitledToPro, useProStore } from "@/store/proStore";
import { CommunityToolNotice } from "@/components/CommunityToolNotice";
import { formatDrivingOptionLabel, rankDrivingOptions } from "@/lib/rankDrivingOptions";
import { t } from "@/constants/i18n";
import { formatPingSegmentLabel } from "@/lib/locationPingSegments";
import { useOpenPaywall } from "@/navigation/useOpenPaywall";
import { DisclaimerFooter } from "@/components/DisclaimerFooter";
import { MvpDisclaimerBanner } from "@/components/MvpDisclaimerBanner";
import { PremiumPressable } from "@/components/PremiumPressable";
import { BTN_PRIMARY_TEXT } from "@/constants/buttonStyles";

const FREE_PREDICTION_ROWS = 2;
const FREE_NEARBY_ROWS = 1;
export const PredictionsScreen = () => {
  const insets = useSafeAreaInsets();
  const openPaywall = useOpenPaywall();
  const marketCode = useAppStore((s) => s.marketCode);
  const languageCode = useAppStore((s) => s.languageCode);
  const isPro = useProStore(selectEntitledToPro);
  const selectedPlatforms = useAppStore((s) => s.selectedPlatforms);
  const rideHailQualifiedTierIds = useAppStore((s) => s.rideHailQualifiedTierIds);
  const rideHailActiveTierId = useAppStore((s) => s.rideHailActiveTierId);

  const market = getMarketConfig(marketCode);
  const tabList =
    selectedPlatforms.length > 0 ? selectedPlatforms.slice(0, 8) : market.primaryPlatforms.slice(0, 3);
  const [platform, setPlatform] = useState(tabList[0] ?? market.primaryPlatforms[0] ?? "Platform A");
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (tabList.length && !tabList.includes(platform)) {
      setPlatform(tabList[0]);
    }
  }, [tabList, platform]);

  useEffect(() => {
    const load = async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCurrentLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    };
    void load();
  }, []);

  const { predictedZones, topNearby, allPredictedZones } = usePredictBestZones({
    selectedPlatform: platform,
    location: currentLocation,
    marketCode,
  });

  const { getTopZoneForPlatform, getTopZoneForSegment } = useZoneAdvice({
    selectedPlatform: platform,
    location: currentLocation,
    marketCode,
  });

  const drivingRank = useMemo(
    () =>
      rankDrivingOptions({
        selectedPlatforms,
        rideHailQualifiedTierIds,
        rideHailActiveTierId,
        getTopZoneForPlatform,
        getTopZoneForSegment,
        allPredictedZones,
        userLocation: currentLocation,
        selectedPlatformTab: platform,
      }),
    [
      selectedPlatforms,
      rideHailQualifiedTierIds,
      rideHailActiveTierId,
      getTopZoneForPlatform,
      getTopZoneForSegment,
      allPredictedZones,
      currentLocation,
      platform,
    ]
  );

  const topFive = useMemo(() => predictedZones.slice(0, 5), [predictedZones]);
  const leaderboardRows = isPro ? drivingRank.ranked.slice(0, 8) : drivingRank.ranked.slice(0, FREE_PREDICTION_ROWS);
  const nearbyRows = isPro ? topNearby : topNearby.slice(0, FREE_NEARBY_ROWS);
  const zoneCards = isPro ? topFive : [];
  const showPredictionsUpsell =
    !isPro &&
    (drivingRank.ranked.length > FREE_PREDICTION_ROWS ||
      topNearby.length > FREE_NEARBY_ROWS ||
      topFive.length > 0);

  return (
    <ScrollView
      className="flex-1 bg-cm-canvas px-5"
      contentContainerStyle={{
        paddingTop: Math.max(insets.top, 12),
        paddingBottom: Math.max(insets.bottom, 28),
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled={Platform.OS === "android"}
    >
      <Text className="text-[11px] font-bold uppercase tracking-widest text-cm-accent">CashMap</Text>
      <Text className="text-[28px] font-bold tracking-tight text-cm-ink">{t("predictions", languageCode)}</Text>
      <MvpDisclaimerBanner className="mt-4" />
      <View className="mt-4">
        <CommunityToolNotice />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-4"
        contentContainerStyle={{ gap: 8, paddingHorizontal: 2, paddingVertical: 2 }}
      >
        {tabList.map((item) => (
          <PremiumPressable
            key={item}
            variant="chip"
            className={`px-4 py-2.5 rounded-xl ${platform === item ? "border-transparent bg-cm-accent shadow-cm-glow-sm" : "border border-white/20 bg-cm-raised"}`}
            onPress={() => setPlatform(item)}
          >
            <Text
              numberOfLines={1}
              className={`text-center text-[13px] font-bold ${platform === item ? "text-cm-on-accent" : "text-cm-ink"}`}
            >
              {item}
            </Text>
          </PremiumPressable>
        ))}
      </ScrollView>

      {drivingRank.ranked.length > 0 ? (
        <View className="mt-5 rounded-2xl border border-white/10 bg-cm-surface p-5">
          <View className="flex-col gap-1">
            <Text className="text-[17px] font-bold text-cm-ink">{t("predictionsLeaderboard", languageCode)}</Text>
            {!isPro ? (
              <Text className="text-[11px] font-semibold text-cm-accent">{t("proFeatureLocked", languageCode)}</Text>
            ) : null}
          </View>
          {leaderboardRows.map((row, idx) =>
            isPro ? (
              <View
                key={row.key}
                className={`mt-3 rounded-xl border px-3.5 py-3 ${
                  row.key === drivingRank.ranked[0]?.key ? "border-cm-accent/30 bg-cm-raised" : "border-white/10 bg-cm-surface/50"
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-[13px] font-semibold leading-5 text-cm-ink" numberOfLines={2}>
                    {idx + 1}. {formatDrivingOptionLabel(row)}
                  </Text>
                  <Text className="shrink-0 text-[13px] font-bold text-cm-accent">~{formatMoney(row.estMidRph, marketCode)}/hr</Text>
                </View>
                <Text className="mt-1 text-[12px] leading-5 text-cm-ink-secondary">
                  {row.competitionLabel} · {row.driverCount || "—"} drivers nearby
                </Text>
                <Text className="mt-1 text-[11px] leading-4 text-cm-ink-tertiary">{row.reason}</Text>
              </View>
            ) : (
              <PremiumPressable
                key={row.key}
                variant="none"
                onPress={openPaywall}
                className={`mt-3 min-h-14 justify-center rounded-xl border px-4 py-3 ${
                  row.key === drivingRank.ranked[0]?.key ? "border-cm-accent/30 bg-cm-raised" : "border-white/10 bg-cm-raised/60"
                }`}
              >
                <Text className="text-[13px] font-semibold leading-5 text-cm-ink">
                  {idx + 1}. {formatDrivingOptionLabel(row)} · —/hr
                </Text>
                <Text className="mt-1.5 text-[11px] text-cm-ink-tertiary">{t("predictionsLeaderboardLocked", languageCode)}</Text>
              </PremiumPressable>
            )
          )}
        </View>
      ) : null}

      <View className="mt-5 rounded-2xl border border-white/10 bg-cm-surface p-5">
        <View className="flex-col gap-1">
          <Text className="text-[17px] font-bold text-cm-ink">{t("topNearbyZones", languageCode)}</Text>
          {!isPro ? (
            <Text className="text-[11px] font-semibold text-cm-accent">{t("proFeatureLocked", languageCode)}</Text>
          ) : null}
        </View>
        {nearbyRows.map((zone, idx) =>
          isPro ? (
            <View key={zone.id} className="mt-3 rounded-xl border border-white/10 bg-cm-raised px-3 py-3">
              <View className="flex-row items-start justify-between gap-2">
                <Text className="flex-1 text-[13px] font-semibold text-cm-ink" numberOfLines={2}>
                  {idx + 1}. {formatPingSegmentLabel(zone.platform)} · {zone.suburb}
                </Text>
                <Text className="shrink-0 text-[13px] font-bold text-cm-accent">
                  {formatMoney(zone.predictedMinRph, marketCode)}–{formatMoney(zone.predictedMaxRph, marketCode)}/hr
                </Text>
              </View>
              <Text className="mt-1 text-[11px] leading-4 text-cm-ink-tertiary">{zone.why}</Text>
            </View>
          ) : (
            <PremiumPressable key={zone.id} variant="tertiary" className="mt-2 w-full py-3" onPress={openPaywall}>
              <Text className="text-center text-[13px] font-semibold leading-5 text-cm-ink-secondary">
                {idx + 1}. {formatPingSegmentLabel(zone.platform)} · {zone.suburb} · {t("predictionsRphLocked", languageCode)}
              </Text>
            </PremiumPressable>
          )
        )}
      </View>
      {isPro ? (
        <View className="mt-5 mb-8 gap-4">
          {zoneCards.map((zone) => (
            <View key={zone.id} className="rounded-3xl border border-white/10 bg-cm-surface/95 p-5 shadow-cm-inner">
              <Text className="text-[15px] font-semibold leading-6 text-cm-ink">
                {formatMoney(zone.predictedMinRph, marketCode)}–{formatMoney(zone.predictedMaxRph, marketCode)}/hr · {zone.suburb}
              </Text>
              <Text className="mt-2 text-[13px] leading-5 text-cm-ink-secondary">{zone.why}</Text>
            </View>
          ))}
        </View>
      ) : topFive.length > 0 ? (
        <PremiumPressable
          variant="none"
          onPress={openPaywall}
          className="mt-5 mb-8 min-h-16 w-full justify-center rounded-[28px] border-[1.5px] border-white/10 bg-cm-raised/90 p-6 shadow-cm-card"
        >
          <Text className="text-center text-[17px] font-bold text-cm-ink">{t("predictionsBenchmarksLockedTitle", languageCode)}</Text>
          <Text className="mt-2 text-center text-[14px] leading-6 text-cm-ink-secondary">{t("predictionsBenchmarksLockedBody", languageCode)}</Text>
          <Text className="mt-4 text-center text-[13px] font-bold text-cm-accent">{t("proLockTapToUnlock", languageCode)} →</Text>
        </PremiumPressable>
      ) : null}
      {showPredictionsUpsell ? (
        <View className="mb-6 rounded-3xl border border-cm-warn/30 bg-cm-warn-dim p-5 shadow-cm-inner">
          <Text className="text-[13px] leading-5 text-cm-warn">{t("unlockFullPredictions", languageCode)}</Text>
          <PremiumPressable variant="primary" className="mt-4 w-full shadow-cm-glow-sm" onPress={openPaywall}>
            <Text className={`${BTN_PRIMARY_TEXT} text-[15px]`}>{t("unlockWithPro", languageCode)}</Text>
          </PremiumPressable>
        </View>
      ) : null}
      <DisclaimerFooter className="mb-4" />
    </ScrollView>
  );
};
