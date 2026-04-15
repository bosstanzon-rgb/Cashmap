import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { IS_PRO_STORAGE_KEY } from "@/constants/storage";

export type ProPersistedState = {
  /** Active RevenueCat entitlement (subscription / trial). */
  isPro: boolean;
  isLifetimePro: boolean;
  /** ISO8601 when subscription access ends; null if unknown or no end (e.g. active period from RC). */
  subscriptionExpiresAt: string | null;
  /** From RevenueCat entitlement periodType when subscribed. */
  subscriptionPeriodType: string | null;
};

type ProState = ProPersistedState & {
  upgradeModalVisible: boolean;
  setIsPro: (value: boolean) => void;
  setIsLifetimePro: (value: boolean) => void;
  setSubscriptionExpiresAt: (value: string | null) => void;
  /** Apply RevenueCat CustomerInfo-derived fields (skipped when `isLifetimePro`). */
  applyRevenueCatSync: (payload: {
    hasActiveEntitlement: boolean;
    expirationDate: string | null;
    periodType: string | null;
  }) => void;
  applyLifetimeGiveaway: () => void;
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
  reconcileEntitlement: () => void;
  resetPro: () => void;
};

const mirrorEntitled = (entitled: boolean) => {
  void AsyncStorage.setItem(IS_PRO_STORAGE_KEY, entitled ? "true" : "false");
};

/** Pro access: lifetime giveaway OR active paid/trial subscription not past expiration. */
export const computeEntitledToPro = (s: ProPersistedState): boolean => {
  if (s.isLifetimePro) return true;
  if (!s.isPro) return false;
  if (!s.subscriptionExpiresAt) return true;
  const exp = Date.parse(s.subscriptionExpiresAt);
  if (Number.isNaN(exp)) return true;
  return exp > Date.now();
};

export const selectEntitledToPro = (s: ProState) => computeEntitledToPro(s);

export const selectTrialActive = (s: ProState): boolean => {
  if (!s.isPro || s.isLifetimePro) return false;
  const pt = s.subscriptionPeriodType;
  return pt === "TRIAL" || pt === "INTRO";
};

const syncMirror = (get: () => ProState) => {
  mirrorEntitled(computeEntitledToPro(get()));
};

export const useProStore = create<ProState>()(
  persist(
    (set, get) => ({
      isPro: false,
      isLifetimePro: false,
      subscriptionExpiresAt: null,
      subscriptionPeriodType: null,
      upgradeModalVisible: false,
      setIsPro: (value) => {
        set({ isPro: value });
        syncMirror(get);
      },
      setIsLifetimePro: (value) => {
        set({ isLifetimePro: value });
        syncMirror(get);
      },
      setSubscriptionExpiresAt: (value) => {
        set({ subscriptionExpiresAt: value });
        syncMirror(get);
      },
      applyRevenueCatSync: ({ hasActiveEntitlement, expirationDate, periodType }) => {
        if (get().isLifetimePro) {
          syncMirror(get);
          return;
        }
        set({
          isPro: hasActiveEntitlement,
          subscriptionExpiresAt: hasActiveEntitlement ? expirationDate : null,
          subscriptionPeriodType: hasActiveEntitlement ? periodType : null,
        });
        syncMirror(get);
      },
      applyLifetimeGiveaway: () => {
        set({ isLifetimePro: true, isPro: true });
        syncMirror(get);
      },
      openUpgradeModal: () => {
        if (get().isLifetimePro) return;
        set({ upgradeModalVisible: true });
      },
      closeUpgradeModal: () => set({ upgradeModalVisible: false }),
      reconcileEntitlement: () => {
        const s = get();
        if (s.isLifetimePro) {
          syncMirror(get);
          return;
        }
        if (s.subscriptionExpiresAt) {
          const exp = Date.parse(s.subscriptionExpiresAt);
          if (!Number.isNaN(exp) && exp <= Date.now()) {
            set({
              isPro: false,
              subscriptionExpiresAt: null,
              subscriptionPeriodType: null,
            });
          }
        }
        syncMirror(get);
      },
      resetPro: () => {
        mirrorEntitled(false);
        set({
          isPro: false,
          isLifetimePro: false,
          subscriptionExpiresAt: null,
          subscriptionPeriodType: null,
          upgradeModalVisible: false,
        });
      },
    }),
    {
      name: "pro-subscription-storage",
      version: 3,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        isPro: s.isPro,
        isLifetimePro: s.isLifetimePro,
        subscriptionExpiresAt: s.subscriptionExpiresAt,
        subscriptionPeriodType: s.subscriptionPeriodType,
      }),
      migrate: (persisted, version) => {
        const p = persisted as Record<string, unknown> | undefined;
        if (!p || typeof p !== "object") return persisted as never;
        if (version < 2) {
          const legacyPro = Boolean(p.isPro);
          delete (p as { isTrialActive?: unknown }).isTrialActive;
          delete (p as { proSyncLoading?: unknown }).proSyncLoading;
          delete (p as { proSyncError?: unknown }).proSyncError;
          (p as { isLifetimePro?: boolean }).isLifetimePro = false;
          (p as { trialExpiresAt?: string | null }).trialExpiresAt = null;
          (p as { isPro?: boolean }).isPro = legacyPro;
        }
        if (version < 3) {
          const trial = (p as { trialExpiresAt?: string | null }).trialExpiresAt;
          (p as { subscriptionExpiresAt?: string | null }).subscriptionExpiresAt =
            typeof trial === "string" ? trial : null;
          delete (p as { trialExpiresAt?: unknown }).trialExpiresAt;
          if (!("subscriptionPeriodType" in p)) {
            (p as { subscriptionPeriodType?: string | null }).subscriptionPeriodType = null;
          }
        }
        return persisted as never;
      },
      onRehydrateStorage: () => (state) => {
        if (state) mirrorEntitled(computeEntitledToPro(state));
      },
    }
  )
);

export const useProGate = () => {
  const entitled = useProStore(selectEntitledToPro);
  const trialActive = useProStore(selectTrialActive);
  const isLifetimePro = useProStore((s) => s.isLifetimePro);
  const openUpgradeModal = useProStore((s) => s.openUpgradeModal);
  return { isPro: entitled, isTrialActive: trialActive, isLifetimePro, openUpgradeModal };
};
