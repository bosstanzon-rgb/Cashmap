/**
 * RevenueCat for CashMap (Android-only for now).
 * Configure with REVENUECAT_PUBLIC_KEY.
 * Store product titles and descriptions are set in App Store Connect / Play Console and the RevenueCat dashboard.
 */
import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
} from "react-native-purchases";
import type { PurchasesError } from "react-native-purchases";
import { getRevenueCatPublicKey as readRevenueCatPublicKey } from "@/config/env";
import { useProStore } from "@/store/proStore";

export const REVENUECAT_NOT_CONFIGURED_MESSAGE = "RevenueCat is not configured yet";

export const getRevenueCatEntitlementId = () =>
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID?.trim() || "Gig-it Pro";

export const getRevenueCatPublicKey = (): string => readRevenueCatPublicKey();

export const isRevenueCatSupported = () => Platform.OS === "android";

let configureSucceeded = false;
let listenerAttached = false;

const customerInfoListener = (info: CustomerInfo) => {
  applyCustomerInfoToStore(info);
};

export const applyCustomerInfoToStore = (info: CustomerInfo): void => {
  const id = getRevenueCatEntitlementId();
  const pro = info.entitlements.active[id];
  const active = pro != null && pro.isActive;
  useProStore.getState().applyRevenueCatSync({
    hasActiveEntitlement: active,
    expirationDate: active ? pro.expirationDate : null,
    periodType: active ? pro.periodType : null,
  });
};

const attachListener = () => {
  if (listenerAttached) return;
  Purchases.addCustomerInfoUpdateListener(customerInfoListener);
  listenerAttached = true;
};

/**
 * Configure SDK and attach CustomerInfo listener. Call once at app start.
 */
export const configureRevenueCat = (): boolean => {
  if (!isRevenueCatSupported()) return false;
  if (configureSucceeded) return true;
  try {
    const apiKey = getRevenueCatPublicKey();
    if (__DEV__) {
      console.log(
        "[RevenueCat] Public key:",
        apiKey ? `present (length ${apiKey.length})` : "missing — set REVENUECAT_PUBLIC_KEY or EXPO_PUBLIC_REVENUECAT_PUBLIC_KEY"
      );
    }
    if (!apiKey) {
      console.warn(`[RevenueCat] ${REVENUECAT_NOT_CONFIGURED_MESSAGE}. Set REVENUECAT_PUBLIC_KEY in .env.`);
      return false;
    }
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
    Purchases.configure({ apiKey });
    configureSucceeded = true;
    attachListener();
    void Purchases.setDisplayName("CashMap").catch(() => {});
    return true;
  } catch (error) {
    console.error(
      `[RevenueCat] Failed to initialize: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
};

export const getOfferings = async (): Promise<PurchasesOfferings> => {
  if (!configureRevenueCat()) {
    throw new Error(REVENUECAT_NOT_CONFIGURED_MESSAGE);
  }
  return Purchases.getOfferings();
};

const pickMonthly = (offering: NonNullable<PurchasesOfferings["current"]>): PurchasesPackage | null =>
  offering.monthly ??
  offering.availablePackages.find((p) => p.packageType === PACKAGE_TYPE.MONTHLY) ??
  null;

const pickAnnual = (offering: NonNullable<PurchasesOfferings["current"]>): PurchasesPackage | null =>
  offering.annual ??
  offering.availablePackages.find((p) => p.identifier.toLowerCase() === "yearly") ??
  offering.availablePackages.find((p) => p.packageType === PACKAGE_TYPE.ANNUAL) ??
  null;

const pickLifetime = (offering: NonNullable<PurchasesOfferings["current"]>): PurchasesPackage | null =>
  offering.lifetime ??
  offering.availablePackages.find((p) => p.identifier.toLowerCase() === "lifetime") ??
  offering.availablePackages.find((p) => p.packageType === PACKAGE_TYPE.LIFETIME) ??
  null;

export const getDefaultOfferingPackages = async (): Promise<{
  offering: NonNullable<PurchasesOfferings["current"]> | null;
  monthly: PurchasesPackage | null;
  annual: PurchasesPackage | null;
  lifetime: PurchasesPackage | null;
}> => {
  const offerings = await getOfferings();
  const current = offerings.current;
  if (!current) {
    return { offering: null, monthly: null, annual: null, lifetime: null };
  }
  return {
    offering: current,
    monthly: pickMonthly(current),
    annual: pickAnnual(current),
    lifetime: pickLifetime(current),
  };
};

const isPurchasesError = (e: unknown): e is PurchasesError =>
  typeof e === "object" &&
  e !== null &&
  "code" in e &&
  "message" in e &&
  typeof (e as PurchasesError).message === "string";

export const mapPurchasesError = (e: unknown, cancelledMessage: string): string => {
  if (isPurchasesError(e) && e.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
    return cancelledMessage;
  }
  if (e instanceof Error) return e.message;
  if (isPurchasesError(e)) return e.message;
  return String(e);
};

export const purchaseMonthly = async (): Promise<CustomerInfo> => {
  if (!configureRevenueCat()) {
    throw new Error(REVENUECAT_NOT_CONFIGURED_MESSAGE);
  }
  const { monthly } = await getDefaultOfferingPackages();
  if (!monthly) {
    throw new Error(
      "Monthly package missing. In RevenueCat, attach a Monthly product to the current offering (entitlement “pro”)."
    );
  }
  const { customerInfo } = await Purchases.purchasePackage(monthly);
  applyCustomerInfoToStore(customerInfo);
  return customerInfo;
};

export const purchaseYearly = async (): Promise<CustomerInfo> => {
  if (!configureRevenueCat()) {
    throw new Error(REVENUECAT_NOT_CONFIGURED_MESSAGE);
  }
  const { annual } = await getDefaultOfferingPackages();
  if (!annual) {
    throw new Error(
      "Annual package missing. In RevenueCat, attach an Annual product to the current offering (entitlement “pro”)."
    );
  }
  const { customerInfo } = await Purchases.purchasePackage(annual);
  applyCustomerInfoToStore(customerInfo);
  return customerInfo;
};

export const purchaseLifetime = async (): Promise<CustomerInfo> => {
  if (!configureRevenueCat()) {
    throw new Error(REVENUECAT_NOT_CONFIGURED_MESSAGE);
  }
  const { lifetime } = await getDefaultOfferingPackages();
  if (!lifetime) {
    throw new Error(
      "Lifetime package missing. In RevenueCat, attach a Lifetime product to the current offering (entitlement “Gig-it Pro”)."
    );
  }
  const { customerInfo } = await Purchases.purchasePackage(lifetime);
  applyCustomerInfoToStore(customerInfo);
  return customerInfo;
};

export const restorePurchases = async (): Promise<CustomerInfo> => {
  if (!configureRevenueCat()) {
    throw new Error(REVENUECAT_NOT_CONFIGURED_MESSAGE);
  }
  const info = await Purchases.restorePurchases();
  applyCustomerInfoToStore(info);
  return info;
};

/** Refresh entitlement from network (call after app start / restore). */
export const checkProStatus = async (): Promise<void> => {
  if (!configureRevenueCat()) {
    useProStore.getState().reconcileEntitlement();
    return;
  }
  try {
    const info = await Purchases.getCustomerInfo();
    applyCustomerInfoToStore(info);
  } catch {
    useProStore.getState().reconcileEntitlement();
  }
};

export const openRevenueCatManage = async (): Promise<void> => {
  if (!isRevenueCatSupported() || !getRevenueCatPublicKey()) return;
  if (!configureRevenueCat()) return;
  await Purchases.showManageSubscriptions();
};

export const initializeRevenueCat = async (): Promise<void> => {
  if (!configureRevenueCat()) return;
  await checkProStatus();
};
