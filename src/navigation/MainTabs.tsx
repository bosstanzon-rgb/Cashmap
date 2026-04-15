import { Text, View, Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapPinned, Sparkles, Wallet, Settings } from "lucide-react-native";
import { t } from "@/constants/i18n";
import { MainTabParamList } from "@/types/navigation";
import { HomeScreen } from "@/screens/HomeScreen";
import { PredictionsScreen } from "@/screens/PredictionsScreen";
import { EarningsDashboardScreen } from "@/screens/EarningsDashboardScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { useAppStore } from "@/store/useAppStore";
import { selectEntitledToPro, selectTrialActive, useProStore } from "@/store/proStore";
import { CM } from "@/constants/theme";

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, typeof MapPinned> = {
  HomeMap: MapPinned,
  Predictions: Sparkles,
  Earnings: Wallet,
  Settings: Settings,
};

export const MainTabs = () => {
  const insets = useSafeAreaInsets();
  const languageCode = useAppStore((s) => s.languageCode);
  const entitled = useProStore(selectEntitledToPro);
  const trialActive = useProStore(selectTrialActive);
  const isLifetimePro = useProStore((s) => s.isLifetimePro);
  const bottomPad = Math.max(insets.bottom, 10);
  const tabBarHeight = 56 + bottomPad;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: CM.accent,
        tabBarInactiveTintColor: "#AAAAAA",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 3,
        },
        tabBarStyle: {
          backgroundColor: CM.surface,
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.08)",
          elevation: 8,
          height: tabBarHeight,
          paddingBottom: bottomPad,
          paddingTop: 8,
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -8 },
              shadowOpacity: 0.4,
              shadowRadius: 20,
            },
            default: {},
          }),
        },
        tabBarItemStyle: { paddingTop: 4 },
        sceneContainerStyle: { backgroundColor: CM.canvas },
        tabBarIcon: ({ color, focused }) => {
          const name = route.name as keyof MainTabParamList;
          const Icon = TAB_ICONS[name] ?? MapPinned;
          const showPro = name === "HomeMap" && entitled;
          const badgeLabel = isLifetimePro ? "Life" : trialActive ? "Trial" : "Pro";
          return (
            <View className="relative items-center justify-center" style={{ width: 44, height: 34 }}>
              <Icon size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
              {focused ? (
                <View
                  className="absolute -bottom-1 h-1 w-5 rounded-full bg-cm-accent"
                  style={{
                    shadowColor: CM.accent,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.65,
                    shadowRadius: 6,
                  }}
                />
              ) : null}
              {showPro ? (
                <View className="absolute -right-1 -top-0.5 min-w-[22px] items-center rounded-full bg-cm-accent px-1 py-0.5 shadow-cm-glow-sm">
                  <Text className="text-[7px] font-extrabold uppercase tracking-tight text-cm-on-accent">{badgeLabel}</Text>
                </View>
              ) : null}
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="HomeMap" component={HomeScreen} options={{ title: t("tabHomeMap", languageCode) }} />
      <Tab.Screen name="Predictions" component={PredictionsScreen} options={{ title: t("predictions", languageCode) }} />
      <Tab.Screen name="Earnings" component={EarningsDashboardScreen} options={{ title: t("earnings", languageCode) }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: t("tabSettings", languageCode) }} />
    </Tab.Navigator>
  );
};
