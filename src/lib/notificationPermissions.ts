import type { NotificationPermissionsStatus, PermissionResponse } from "expo-notifications";
import { IosAuthorizationStatus } from "expo-notifications";

/** True when local notifications may be scheduled (incl. iOS provisional). */
export const areNotificationsUsable = (p: NotificationPermissionsStatus): boolean => {
  const core = p as PermissionResponse;
  return core.granted || p.ios?.status === IosAuthorizationStatus.PROVISIONAL;
};
