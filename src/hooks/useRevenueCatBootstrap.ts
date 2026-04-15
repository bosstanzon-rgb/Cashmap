import { useEffect } from "react";
import { initializeRevenueCat } from "@/services/revenuecat";
import { useProStore } from "@/store/proStore";

/** Reconcile persisted expiry, configure RevenueCat, then sync entitlements from the network. */
export const useProBootstrap = () => {
  useEffect(() => {
    useProStore.getState().reconcileEntitlement();
    void initializeRevenueCat();
  }, []);
};

/** @deprecated Use useProBootstrap */
export const useRevenueCatBootstrap = useProBootstrap;
