import { Linking, Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesPackage,
} from 'react-native-purchases';
import { AppUser } from '../store/useAppStore';
import { apiGet, apiPost } from './api';

export type SubscriptionPlanId = 'free' | 'basic' | 'pro' | 'family';

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  name: string;
  priceLabel: string;
  cadence: string;
  summary: string;
  features: string[];
  amountNgn: number;
  entitlementKey: string | null;
  packageIdentifiers: string[];
  productIdentifiers: {
    ios: string[];
    android: string[];
  };
};

export type SubscriptionState = {
  catalog: SubscriptionPlan[];
  activePlanId: SubscriptionPlanId;
  status: 'inactive' | 'active' | 'trialing' | 'grace_period' | 'cancelled' | 'expired';
  currentPeriodEnd: string | null;
  provider: string | null;
  lastSyncedAt: string | null;
  syncStatus: string;
  revenueCat: {
    configured: boolean;
    customerId: string;
  };
  management: {
    provider: string | null;
    mode: 'native_store';
    helpText: string;
  };
};

export type RevenueCatPlanOffer = {
  planId: SubscriptionPlanId;
  priceLabel: string | null;
  packageIdentifier: string | null;
  productIdentifier: string | null;
  isAvailable: boolean;
};

type SyncSource = 'manual' | 'purchase' | 'restore';

const packageCache = new Map<SubscriptionPlanId, PurchasesPackage>();

let configuredAppUserId: string | null = null;
let configuredApiKey: string | null = null;
let didSetLogLevel = false;

function getRevenueCatApiKey() {
  const sharedKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim() || '';

  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY?.trim() || sharedKey;
  }

  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY?.trim() || sharedKey;
  }

  return sharedKey;
}

function getPlanLookupTokens(plan: SubscriptionPlan) {
  const productIds =
    Platform.OS === 'ios' ? plan.productIdentifiers.ios : plan.productIdentifiers.android;

  return [
    plan.id,
    ...plan.packageIdentifiers,
    ...productIds,
  ]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function matchesPlan(plan: SubscriptionPlan, candidate: string) {
  const normalized = candidate.trim().toLowerCase();
  return getPlanLookupTokens(plan).some(
    (token) => normalized === token || normalized.includes(token),
  );
}

async function ensureRevenueCatConfigured(user: AppUser | null) {
  if (!user?.id) {
    throw new Error('Sign in before managing your subscription.');
  }

  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    throw new Error(
      'RevenueCat is not configured for this build yet. Add the platform public API key to your Expo environment.',
    );
  }

  if (__DEV__ && !didSetLogLevel) {
    didSetLogLevel = true;
    await Purchases.setLogLevel(LOG_LEVEL.DEBUG).catch(() => undefined);
  }

  const isConfigured = await Purchases.isConfigured().catch(() => false);

  if (!isConfigured) {
    Purchases.configure({
      apiKey,
      appUserID: user.id,
    });
    configuredAppUserId = user.id;
    configuredApiKey = apiKey;
  } else {
    const currentAppUserId = await Purchases.getAppUserID().catch(
      () => configuredAppUserId || '',
    );

    if (configuredApiKey !== apiKey || currentAppUserId !== user.id) {
      await Purchases.logIn(user.id);
    }

    configuredAppUserId = user.id;
    configuredApiKey = apiKey;
  }

  if (user.email) {
    await Purchases.setEmail(user.email).catch(() => undefined);
  }

  if (user.name) {
    await Purchases.setDisplayName(user.name).catch(() => undefined);
  }
}

export async function initializeRevenueCatForUser(user: AppUser | null) {
  if (!user?.id) {
    return false;
  }

  await ensureRevenueCatConfigured(user);
  return true;
}

export async function getSubscriptionState() {
  return apiGet<SubscriptionState>('/subscriptions', { auth: true });
}

export async function syncSubscriptionState(source: SyncSource = 'manual') {
  return apiPost<SubscriptionState>('/subscriptions/sync', { source }, { auth: true });
}

export async function getRevenueCatPlanOffers(
  user: AppUser | null,
  catalog: SubscriptionPlan[],
) {
  await ensureRevenueCatConfigured(user);
  const offerings = await Purchases.getOfferings();
  const availablePackages = offerings.current?.availablePackages || [];

  packageCache.clear();

  const offers = Object.fromEntries(
    catalog.map((plan) => [
      plan.id,
      {
        planId: plan.id,
        priceLabel: null,
        packageIdentifier: null,
        productIdentifier: null,
        isAvailable: plan.id === 'free',
      } satisfies RevenueCatPlanOffer,
    ]),
  ) as Record<SubscriptionPlanId, RevenueCatPlanOffer>;

  availablePackages.forEach((aPackage) => {
    const matchingPlan = catalog.find(
      (plan) =>
        matchesPlan(plan, aPackage.identifier) ||
        matchesPlan(plan, aPackage.product.identifier),
    );

    if (!matchingPlan || packageCache.has(matchingPlan.id)) {
      return;
    }

    packageCache.set(matchingPlan.id, aPackage);
    offers[matchingPlan.id] = {
      planId: matchingPlan.id,
      priceLabel: aPackage.product.priceString,
      packageIdentifier: aPackage.identifier,
      productIdentifier: aPackage.product.identifier,
      isAvailable: true,
    };
  });

  return offers;
}

async function getRevenueCatPackageForPlan(user: AppUser | null, plan: SubscriptionPlan) {
  const cached = packageCache.get(plan.id);
  if (cached) {
    return cached;
  }

  await getRevenueCatPlanOffers(user, [plan]);
  return packageCache.get(plan.id) || null;
}

export async function purchaseSubscriptionPlan(
  user: AppUser | null,
  plan: SubscriptionPlan,
) {
  if (plan.id === 'free') {
    throw new Error('The free tier does not require a purchase.');
  }

  const aPackage = await getRevenueCatPackageForPlan(user, plan);
  if (!aPackage) {
    throw new Error(
      'This plan has not been mapped to a RevenueCat offering for the current platform yet.',
    );
  }

  const result = await Purchases.purchasePackage(aPackage);
  return result.customerInfo;
}

export async function restoreSubscriptionPurchases(user: AppUser | null) {
  await ensureRevenueCatConfigured(user);
  return Purchases.restorePurchases();
}

export async function openNativeSubscriptionManagement() {
  if (Platform.OS === 'ios') {
    try {
      await Purchases.showManageSubscriptions();
      return true;
    } catch {
      // Fall back to external store management below.
    }
  }

  const fallbackUrl =
    Platform.OS === 'android'
      ? 'https://play.google.com/store/account/subscriptions'
      : 'https://apps.apple.com/account/subscriptions';

  const canOpen = await Linking.canOpenURL(fallbackUrl);
  if (!canOpen) {
    return false;
  }

  await Linking.openURL(fallbackUrl);
  return true;
}

export function getFirstActiveEntitlement(customerInfo: CustomerInfo) {
  const activeEntitlements = Object.keys(customerInfo.entitlements.active || {});
  return activeEntitlements[0] || null;
}
