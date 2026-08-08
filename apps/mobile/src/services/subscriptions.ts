import { Linking } from 'react-native';
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
  paystack: {
    configured: boolean;
    customerId: string;
  };
  management: {
    provider: string | null;
    mode: 'paystack';
    helpText: string;
  };
};

export type PaystackPlanOffer = {
  planId: SubscriptionPlanId;
  priceLabel: string | null;
  isAvailable: boolean;
};

export type CheckoutResult = {
  provider: 'paystack';
  planId: SubscriptionPlanId;
  authorizationUrl: string | null;
  accessCode: string | null;
  reference: string | null;
};

type SyncSource = 'manual' | 'purchase' | 'restore';

export async function initializePaystackForUser(user: AppUser | null) {
  return Boolean(user?.id);
}

export async function getSubscriptionState() {
  return apiGet<SubscriptionState>('/subscriptions', { auth: true });
}

export async function syncSubscriptionState(
  source: SyncSource = 'manual',
  reference?: string | null,
) {
  return apiPost<SubscriptionState>('/subscriptions/sync', { source, reference }, { auth: true });
}

export function getPaystackPlanOffers(
  catalog: SubscriptionPlan[],
  paystackConfigured = false,
) {
  return Object.fromEntries(
    catalog.map((plan) => [
      plan.id,
      {
        planId: plan.id,
        priceLabel: plan.priceLabel,
        isAvailable: plan.id === 'free' || paystackConfigured,
      } satisfies PaystackPlanOffer,
    ]),
  ) as Record<SubscriptionPlanId, PaystackPlanOffer>;
}

export async function purchaseSubscriptionPlan(
  user: AppUser | null,
  plan: SubscriptionPlan,
) {
  if (!user?.id) {
    throw new Error('Sign in before managing your subscription.');
  }

  if (plan.id === 'free') {
    throw new Error('The free tier does not require a purchase.');
  }

  const checkout = await apiPost<CheckoutResult>(
    '/subscriptions/checkout',
    {
      planId: plan.id,
      email: user.email,
    },
    { auth: true },
  );

  if (!checkout.authorizationUrl || !checkout.reference) {
    throw new Error('Paystack did not return a checkout link. Try again shortly.');
  }

  const canOpen = await Linking.canOpenURL(checkout.authorizationUrl);
  if (!canOpen) {
    throw new Error('This device cannot open the Paystack checkout page.');
  }

  await Linking.openURL(checkout.authorizationUrl);
  return checkout;
}

export async function restoreSubscriptionPaymentStatus() {
  return syncSubscriptionState('restore');
}

export async function openPaystackBillingManagement() {
  const url = 'https://paystack.com/pay';
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    return false;
  }

  await Linking.openURL(url);
  return true;
}
