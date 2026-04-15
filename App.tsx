import "react-native-gesture-handler";
import "./global.css";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import { cashMapNavigationTheme } from "@/navigation/navigationTheme";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { RootNavigator } from "@/navigation/RootNavigator";
import { navigationRef } from "@/navigation/navigationRef";
import { useProBootstrap } from "@/hooks/useRevenueCatBootstrap";
import { scheduleWeeklyRecapNotification } from "@/services/notifications";
import "@/services/locationTasks";
import { useAppStore } from "@/store/useAppStore";
import { CM } from "@/constants/theme";
import { t } from "@/constants/i18n";
import { UpgradeModal } from "@/components/UpgradeModal";
import { getSupabaseUrl } from "@/config/env";
import { configureRevenueCat } from "@/services/revenuecat";

export default function App() {
  if (__DEV__) {
    const u = getSupabaseUrl();
    console.log("[CashMap] Supabase URL:", u ? `configured (${u.slice(0, 24)}…)` : "missing");
  }
  useProBootstrap();
  const setZoneAlertsEnabled = useAppStore((s) => s.setZoneAlertsEnabled);
  const languageCode = useAppStore((s) => s.languageCode);

  useEffect(() => {
    // Isolated RevenueCat init — failures must not affect notification setup
    try {
      configureRevenueCat();
    } catch (e) {
      console.warn("[CashMap] RevenueCat init failed:", e);
    }

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      }),
    });

    void Notifications.requestPermissionsAsync();
    void Notifications.setNotificationCategoryAsync("DEFAULT_ALERT_CATEGORY", []);

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const targetTab = response.notification.request.content.data?.targetTab;
      const platform = response.notification.request.content.data?.platform;
      const action = response.actionIdentifier;

      if (action === "MUTE_ZONE_ALERTS") {
        setZoneAlertsEnabled(false);
        return;
      }

      if ((action === "OPEN_EARNINGS" || targetTab === "Earnings") && navigationRef.isReady()) {
        navigationRef.navigate("MainTabs", {
          screen: "Earnings",
        } as never);
      } else if ((action === "OPEN_MAP" || targetTab === "HomeMap") && navigationRef.isReady()) {
        navigationRef.navigate("MainTabs", {
          screen: "HomeMap",
          params: typeof platform === "string" ? { platform } : undefined,
        } as never);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    void Notifications.setNotificationCategoryAsync("ZONE_ALERTS_CATEGORY", [
      {
        identifier: "OPEN_MAP",
        buttonTitle: t("notifActionOpenMap", languageCode),
      },
      {
        identifier: "MUTE_ZONE_ALERTS",
        buttonTitle: t("notifActionMuteZones", languageCode),
      },
    ]);
    void Notifications.setNotificationCategoryAsync("WEEKLY_RECAP_CATEGORY", [
      {
        identifier: "OPEN_EARNINGS",
        buttonTitle: t("notifActionOpenEarnings", languageCode),
      },
    ]);
    void scheduleWeeklyRecapNotification();
  }, [languageCode]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider style={{ flex: 1, backgroundColor: CM.canvas }}>
        <NavigationContainer ref={navigationRef} theme={cashMapNavigationTheme}>
          <StatusBar style="light" />
          <RootNavigator />
          <UpgradeModal />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

