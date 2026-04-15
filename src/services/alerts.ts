import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import {
  ALERT_DAILY_COUNTER_KEY,
  APP_SWITCH_TIPS_ENABLED_KEY,
  DAILY_SHIFT_PROMPT_ENABLED_KEY,
  IS_PRO_STORAGE_KEY,
  WEATHER_TIPS_ENABLED_KEY,
  ZONE_ALERTS_ENABLED_KEY,
} from "@/constants/storage";
import { areNotificationsUsable } from "@/lib/notificationPermissions";

type AlertType = "zone" | "shift" | "weather" | "battery" | "app_switch";
/** Free: basic zone alerts only; Pro: smart alerts + higher cap (see `proFeatures.ts`). */
const FREE_MAX_DAILY = 2;
const PRO_MAX_DAILY = 12;

const getTypeEnabled = async (type: AlertType) => {
  if (type === "app_switch") {
    return (await AsyncStorage.getItem(APP_SWITCH_TIPS_ENABLED_KEY)) !== "false";
  }
  if (type === "zone" || type === "battery") {
    return (await AsyncStorage.getItem(ZONE_ALERTS_ENABLED_KEY)) !== "false";
  }
  if (type === "weather") {
    return (await AsyncStorage.getItem(WEATHER_TIPS_ENABLED_KEY)) !== "false";
  }
  return (await AsyncStorage.getItem(DAILY_SHIFT_PROMPT_ENABLED_KEY)) !== "false";
};

const readCounter = async () => {
  const raw = await AsyncStorage.getItem(ALERT_DAILY_COUNTER_KEY);
  const today = new Date().toISOString().slice(0, 10);
  if (!raw) return { date: today, count: 0 };
  try {
    const parsed = JSON.parse(raw) as { date: string; count: number };
    if (parsed.date !== today) return { date: today, count: 0 };
    return parsed;
  } catch {
    return { date: today, count: 0 };
  }
};

export const scheduleAppAlert = async (payload: {
  type: AlertType;
  title: string;
  body: string;
  data?: Record<string, string | undefined>;
}) => {
  if (!(await getTypeEnabled(payload.type))) return false;
  const isPro = (await AsyncStorage.getItem(IS_PRO_STORAGE_KEY)) === "true";
  // Free tier gets basic alerts only; advanced alerts are Pro.
  if (!isPro && (payload.type === "weather" || payload.type === "battery" || payload.type === "app_switch")) {
    return false;
  }
  const counter = await readCounter();
  if (counter.count >= (isPro ? PRO_MAX_DAILY : FREE_MAX_DAILY)) return false;

  const perms = await Notifications.getPermissionsAsync();
  if (!areNotificationsUsable(perms)) {
    const req = await Notifications.requestPermissionsAsync();
    if (!areNotificationsUsable(req)) return false;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: payload.title,
      body: payload.body,
      categoryIdentifier:
        payload.type === "zone" ||
        payload.type === "battery" ||
        payload.type === "weather" ||
        payload.type === "app_switch"
          ? "ZONE_ALERTS_CATEGORY"
          : "DEFAULT_ALERT_CATEGORY",
      data: (payload.data ?? {}) as Record<string, string>,
    },
    trigger: null,
  });

  await AsyncStorage.setItem(
    ALERT_DAILY_COUNTER_KEY,
    JSON.stringify({
      date: new Date().toISOString().slice(0, 10),
      count: counter.count + 1,
    })
  );
  return true;
};
