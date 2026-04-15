import { useCallback } from "react";
import { useProStore } from "@/store/proStore";

/** Opens the global Upgrade modal (RevenueCat placeholder). */
export const useOpenPaywall = () => {
  const openUpgradeModal = useProStore((s) => s.openUpgradeModal);
  return useCallback(() => openUpgradeModal(), [openUpgradeModal]);
};
