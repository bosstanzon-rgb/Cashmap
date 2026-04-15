import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { getPersistedLanguageCode, t } from "@/constants/i18n";
import {
  WEEKLY_RECAP_NOTIFICATIONS_KEY,
  WEEKLY_RECAP_SENT_DATE_KEY,
} from "@/constants/storage";
import { areNotificationsUsable } from "@/lib/notificationPermissions";

export const scheduleWeeklyRecapNotification = async () => {
  const enabled = (await AsyncStorage.getItem(WEEKLY_RECAP_NOTIFICATIONS_KEY)) !== "false";
  if (!enabled) return;
  const perms = await Notifications.requestPermissionsAsync();
  if (!areNotificationsUsable(perms)) return;
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const lang = await getPersistedLanguageCode();
  await Promise.all(
    existing
      .filter((item) => item.content.data?.kind === "weekly_recap")
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier))
  );
  await Notifications.scheduleNotificationAsync({
    content: {
      title: t("weeklyRecap", lang),
      body: t("weeklyRecapNotifyBody", lang),
      categoryIdentifier: "WEEKLY_RECAP_CATEGORY",
      data: { kind: "weekly_recap", targetTab: "Earnings" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1,
      hour: 20,
      minute: 0,
    },
  });
};

export const sendWeeklyRecapNowIfNeeded = async (payload: {
  title: string;
  body: string;
}) => {
  const enabled = (await AsyncStorage.getItem(WEEKLY_RECAP_NOTIFICATIONS_KEY)) !== "false";
  if (!enabled) return;
  const now = new Date();
  const isSundayEvening = now.getDay() === 0 && now.getHours() >= 20;
  if (!isSundayEvening) return;
  const today = now.toISOString().slice(0, 10);
  const sent = await AsyncStorage.getItem(WEEKLY_RECAP_SENT_DATE_KEY);
  if (sent === today) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: payload.title,
      body: payload.body,
      categoryIdentifier: "WEEKLY_RECAP_CATEGORY",
      data: { kind: "weekly_recap", targetTab: "Earnings" },
    },
    trigger: null,
  });
  await AsyncStorage.setItem(WEEKLY_RECAP_SENT_DATE_KEY, today);
};
