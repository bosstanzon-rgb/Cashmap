export const ACTIVE_PLATFORMS_STORAGE_KEY = "active-platforms";
export const LOCATION_CONSENT_STORAGE_KEY = "location-consent";
/** Mirrored from app store; background pings only when true (default off). */
export const HEATMAP_SHARE_STORAGE_KEY = "share-anonymous-heatmap";
export const ONLINE_STATUS_STORAGE_KEY = "online-status";
export const TRACK_MILEAGE_WHEN_WORKING_KEY = "track-mileage-when-working";
export const IS_WORKING_STORAGE_KEY = "is-working";
export const DAILY_MILEAGE_STORAGE_KEY = "daily-mileage";
export const TOTAL_MILEAGE_STORAGE_KEY = "total-mileage";
export const LAST_MILEAGE_LOCATION_STORAGE_KEY = "last-mileage-location";
export const WORKING_DATE_STORAGE_KEY = "working-date";
export const ZONE_ALERTS_ENABLED_KEY = "zone-alerts-enabled";
export const DAILY_SHIFT_PROMPT_ENABLED_KEY = "daily-shift-prompt-enabled";
export const WEATHER_TIPS_ENABLED_KEY = "weather-tips-enabled";
export const AUTO_PAUSE_AFTER_INACTIVITY_KEY = "auto-pause-after-inactivity";
export const AUTO_DETECT_SHIFT_END_KEY = "auto-detect-shift-end";
export const WEEKLY_RECAP_NOTIFICATIONS_KEY = "weekly-recap-notifications";
export const WEEKLY_RECAP_SENT_DATE_KEY = "weekly-recap-sent-date";
export const SHIFT_PROMPT_PENDING_KEY = "shift-prompt-pending";
export const SHIFT_PROMPT_SNOOZE_DATE_KEY = "shift-prompt-snooze-date";
/** Prevent showing the daily prompt more than once per calendar day. */
export const SHIFT_PROMPT_SHOWN_DATE_KEY = "shift-prompt-shown-date";
export const SHIFT_LAST_MOVEMENT_AT_KEY = "shift-last-movement-at";
export const ALERT_DAILY_COUNTER_KEY = "alert-daily-counter";
export const LANGUAGE_CODE_KEY = "language-code";
export const APP_SWITCH_TIPS_ENABLED_KEY = "app-switch-tips-enabled";
/** JSON map brand -> ride tier id; mirrored from Zustand for background location task. */
export const ACTIVE_SERVICE_MODES_KEY = "active-service-modes";
/** Mirrored from `proStore` `isPro` for background mileage task. */
export const IS_PRO_STORAGE_KEY = "is-pro";
/** ISO timestamp of last background zone alert — prevents spam. */
export const LAST_ZONE_ALERT_AT_KEY = "last-zone-alert-at";
/** Last zone ID that triggered a background alert — prevents duplicate alerts for same zone. */
export const LAST_ZONE_ALERT_ID_KEY = "last-zone-alert-id";
