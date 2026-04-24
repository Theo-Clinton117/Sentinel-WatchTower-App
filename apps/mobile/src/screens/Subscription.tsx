import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { CustomerInfo } from 'react-native-purchases';
import { shallow } from 'zustand/shallow';
import { MotionView } from '../components/MotionView';
import {
  SubscriptionPlan,
  SubscriptionState,
  RevenueCatPlanOffer,
  getFirstActiveEntitlement,
  getRevenueCatPlanOffers,
  getSubscriptionState,
  openNativeSubscriptionManagement,
  purchaseSubscriptionPlan,
  restoreSubscriptionPurchases,
  syncSubscriptionState,
} from '../services/subscriptions';
import { useAppStore } from '../store/useAppStore';
import { useAppTheme } from '../theme';

const toneColors = {
  free: {
    accent: '#1E63FF',
    border: '#B7CBF2',
    fill: 'rgba(30,99,255,0.08)',
  },
  basic: {
    accent: '#5987FF',
    border: '#BFD0FF',
    fill: 'rgba(89,135,255,0.1)',
  },
  pro: {
    accent: '#C89211',
    border: '#E5CD8A',
    fill: 'rgba(200,146,17,0.12)',
  },
  family: {
    accent: '#2BAE73',
    border: '#9DE2C2',
    fill: 'rgba(43,174,115,0.12)',
  },
} as const;

function formatSyncStatus(value?: string | null) {
  switch (value) {
    case 'verified':
      return 'Server verified';
    case 'revenuecat_not_configured':
      return 'RevenueCat not configured';
    case 'cached':
      return 'Using saved status';
    default:
      return 'Subscription status';
  }
}

function formatPlanStatus(value?: string | null) {
  switch (value) {
    case 'trialing':
      return 'Trial active';
    case 'grace_period':
      return 'Grace period';
    case 'cancelled':
      return 'Cancelled';
    case 'expired':
      return 'Expired';
    case 'active':
      return 'Active';
    default:
      return 'Free access';
  }
}

function formatDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function resolvePriceLabel(
  plan: SubscriptionPlan,
  offers?: Record<string, RevenueCatPlanOffer>,
) {
  const offer = offers?.[plan.id];
  return offer?.priceLabel || plan.priceLabel;
}

function describePlanAction(
  plan: SubscriptionPlan,
  activePlanId: SubscriptionPlan['id'],
  offers?: Record<string, RevenueCatPlanOffer>,
) {
  if (plan.id === activePlanId) {
    return 'Current plan';
  }

  if (plan.id === 'free') {
    return 'Included';
  }

  if (!offers?.[plan.id]?.isAvailable) {
    return 'Not mapped yet';
  }

  return 'Subscribe in store';
}

type RestoreResult = {
  customerInfo: CustomerInfo;
  synced: SubscriptionState;
};

type PurchaseResult = {
  customerInfo: CustomerInfo;
  synced: SubscriptionState;
  plan: SubscriptionPlan;
};

export const SubscriptionScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { user } = useAppStore(
    (state) => ({
      user: state.user,
    }),
    shallow,
  );
  const [busyPlanId, setBusyPlanId] = React.useState<SubscriptionPlan['id'] | null>(null);

  const subscriptionQuery = useQuery<SubscriptionState>({
    queryKey: ['subscription-state'],
    queryFn: getSubscriptionState,
  });

  const offersQuery = useQuery<Record<string, RevenueCatPlanOffer>>({
    queryKey: [
      'subscription-offers',
      user?.id || 'guest',
      (subscriptionQuery.data?.catalog || [])
        .map((plan: SubscriptionPlan) => plan.id)
        .join(','),
    ],
    enabled: Boolean(user?.id && subscriptionQuery.data?.catalog?.length),
    retry: false,
    queryFn: () => getRevenueCatPlanOffers(user, subscriptionQuery.data?.catalog || []),
  });

  const refreshMutation = useMutation({
    mutationFn: async () => syncSubscriptionState('manual'),
    onSuccess: async () => {
      await subscriptionQuery.refetch();
    },
    onError: (error: unknown) => {
      Alert.alert('Refresh failed', error instanceof Error ? error.message : 'Try again shortly.');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (): Promise<RestoreResult> => {
      const customerInfo = await restoreSubscriptionPurchases(user);
      const synced = await syncSubscriptionState('restore');
      return {
        customerInfo,
        synced,
      };
    },
    onSuccess: async ({ customerInfo }: RestoreResult) => {
      await subscriptionQuery.refetch();
      Alert.alert(
        'Purchases restored',
        getFirstActiveEntitlement(customerInfo)
          ? 'Your store purchases were restored and your server-side access has been refreshed.'
          : 'No active paid entitlement was found for this account yet, but your access has been refreshed.',
      );
    },
    onError: (error: unknown) => {
      Alert.alert('Restore failed', error instanceof Error ? error.message : 'Try again shortly.');
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (plan: SubscriptionPlan): Promise<PurchaseResult> => {
      setBusyPlanId(plan.id);
      const customerInfo = await purchaseSubscriptionPlan(user, plan);
      const synced = await syncSubscriptionState('purchase');
      return {
        customerInfo,
        synced,
        plan,
      };
    },
    onSuccess: async ({ customerInfo, plan }: PurchaseResult) => {
      setBusyPlanId(null);
      await subscriptionQuery.refetch();
      Alert.alert(
        'Subscription updated',
        getFirstActiveEntitlement(customerInfo)
          ? `${plan.name} was purchased and your backend access has been refreshed.`
          : 'The purchase completed, but the active entitlement was not available yet. Pull to refresh or try the refresh button again in a moment.',
      );
    },
    onError: (error: unknown) => {
      setBusyPlanId(null);
      const userCancelled =
        typeof error === 'object' &&
        error !== null &&
        'userCancelled' in error &&
        Boolean((error as { userCancelled?: unknown }).userCancelled);

      if (userCancelled) {
        return;
      }

      Alert.alert('Purchase failed', error instanceof Error ? error.message : 'Try again shortly.');
    },
  });

  const handleManageBilling = React.useCallback(async () => {
    const opened = await openNativeSubscriptionManagement();
    if (!opened) {
      Alert.alert(
        'Store management unavailable',
        'Open the App Store or Google Play subscriptions page on this device to manage billing.',
      );
    }
  }, []);

  const data = subscriptionQuery.data;
  const plans: SubscriptionPlan[] = data?.catalog || [];
  const activePlan: SubscriptionPlan | undefined =
    plans.find((plan: SubscriptionPlan) => plan.id === data?.activePlanId) || plans[0];
  const expirationLabel = formatDate(data?.currentPeriodEnd);
  const isWorking =
    refreshMutation.isPending || restoreMutation.isPending || purchaseMutation.isPending;

  if (subscriptionQuery.isLoading) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <MotionView delay={40}>
          <Text style={styles.title}>Subscription</Text>
          <Text style={styles.subtitle}>
            Loading your plan catalogue and server-verified access.
          </Text>
        </MotionView>

        <MotionView delay={120} style={[styles.emptyCard, theme.shadow.card]}>
          <Text style={styles.emptyTitle}>Preparing your subscription workspace</Text>
          <Text style={styles.emptyText}>
            Sentinel checks the backend before it unlocks paid safety features.
          </Text>
        </MotionView>
      </ScrollView>
    );
  }

  if (subscriptionQuery.isError || !data || !activePlan) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <MotionView delay={40}>
          <Text style={styles.title}>Subscription</Text>
          <Text style={styles.subtitle}>
            Sentinel could not load your subscription state right now.
          </Text>
        </MotionView>

        <MotionView delay={120} style={[styles.emptyCard, theme.shadow.card]}>
          <Text style={styles.emptyTitle}>Unable to load plans</Text>
          <Text style={styles.emptyText}>
            {subscriptionQuery.error instanceof Error
              ? subscriptionQuery.error.message
              : 'Please retry once the backend is reachable.'}
          </Text>
          <Pressable
            onPress={() => subscriptionQuery.refetch()}
            style={[styles.retryButton, theme.shadow.glow]}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </MotionView>
      </ScrollView>
    );
  }

  const activeTone = toneColors[activePlan.id];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <MotionView delay={40}>
        <Text style={styles.title}>Subscription</Text>
        <Text style={styles.subtitle}>
          Native App Store and Google Play purchases, with backend verification before access is
          granted.
        </Text>
      </MotionView>

      <MotionView delay={110} style={[styles.heroWrap, theme.shadow.card]}>
        <LinearGradient
          colors={theme.gradients.hero}
          style={[styles.heroCard, { borderColor: activeTone.border }]}
        >
          <View style={styles.heroHeader}>
            <View style={[styles.planBadge, { backgroundColor: activeTone.accent }]}>
              <Text style={styles.planBadgeText}>{formatPlanStatus(data.status).toUpperCase()}</Text>
            </View>
            <View
              style={[
                styles.syncPill,
                {
                  backgroundColor: activeTone.fill,
                  borderColor: activeTone.border,
                },
              ]}
            >
              <Text style={[styles.syncPillText, { color: activeTone.accent }]}>
                {formatSyncStatus(data.syncStatus)}
              </Text>
            </View>
          </View>

          <Text style={styles.heroEyebrow}>Current access</Text>
          <Text style={styles.heroTitle}>{activePlan.name}</Text>
          <Text style={[styles.heroPrice, { color: activeTone.accent }]}>
            {resolvePriceLabel(activePlan, offersQuery.data)}{' '}
            <Text style={styles.heroCadence}>/ {activePlan.cadence}</Text>
          </Text>
          <Text style={styles.heroText}>{activePlan.summary}</Text>

          <View style={styles.heroMetaList}>
            <Text style={styles.heroMeta}>
              Backend source: {data.provider ? data.provider.replace('_', ' ') : 'free tier'}
            </Text>
            <Text style={styles.heroMeta}>
              {expirationLabel ? `Current period ends ${expirationLabel}` : 'No paid renewal date yet'}
            </Text>
          </View>
        </LinearGradient>
      </MotionView>

      <MotionView delay={150} style={styles.actionRow}>
        <Pressable
          onPress={() => restoreMutation.mutate()}
          disabled={isWorking}
          style={[
            styles.secondaryButton,
            {
              borderColor: theme.colors.borderStrong,
              backgroundColor: theme.colors.surface,
              opacity: isWorking ? 0.6 : 1,
            },
          ]}
        >
          <Text style={styles.secondaryButtonText}>Restore purchases</Text>
        </Pressable>

        <Pressable
          onPress={() => refreshMutation.mutate()}
          disabled={isWorking}
          style={[
            styles.secondaryButton,
            {
              borderColor: theme.colors.borderStrong,
              backgroundColor: theme.colors.surface,
              opacity: isWorking ? 0.6 : 1,
            },
          ]}
        >
          <Text style={styles.secondaryButtonText}>Refresh access</Text>
        </Pressable>
      </MotionView>

      <MotionView delay={190} style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Plans</Text>
        <Text style={styles.sectionText}>
          Keep core safety available for everyone, then monetize higher-trust automation and
          family coverage.
        </Text>
      </MotionView>

      <View style={styles.planList}>
        {plans.map((plan: SubscriptionPlan, index: number) => {
          const tone = toneColors[plan.id];
          const isActive = plan.id === data.activePlanId;
          const ctaLabel = describePlanAction(plan, data.activePlanId, offersQuery.data);
          const isPlanBusy =
            busyPlanId === plan.id && purchaseMutation.isPending;
          const actionDisabled =
            isWorking || isActive || plan.id === 'free' || !offersQuery.data?.[plan.id]?.isAvailable;

          return (
            <MotionView
              key={plan.id}
              delay={230 + index * 50}
              style={[
                styles.planCard,
                theme.shadow.card,
                {
                  borderColor: tone.border,
                  backgroundColor: theme.colors.surface,
                },
              ]}
            >
              <View style={styles.planHeader}>
                <View style={styles.planTitleWrap}>
                  <View style={[styles.planDot, { backgroundColor: tone.accent }]} />
                  <Text style={styles.planName}>{plan.name}</Text>
                </View>
                <View
                  style={[
                    styles.planPill,
                    {
                      backgroundColor: tone.fill,
                      borderColor: tone.border,
                    },
                  ]}
                >
                  <Text style={[styles.planPillText, { color: tone.accent }]}>
                    {isActive ? 'ACTIVE' : plan.id === 'free' ? 'DEFAULT' : 'PAID'}
                  </Text>
                </View>
              </View>

              <Text style={[styles.planPrice, { color: tone.accent }]}>
                {resolvePriceLabel(plan, offersQuery.data)}
              </Text>
              <Text style={styles.planCadence}>{plan.cadence}</Text>
              <Text style={styles.planSummary}>{plan.summary}</Text>

              <View style={styles.featureList}>
                {plan.features.map((feature: string) => (
                  <Text key={feature} style={styles.feature}>
                    - {feature}
                  </Text>
                ))}
              </View>

              <Pressable
                onPress={() => purchaseMutation.mutate(plan)}
                disabled={actionDisabled}
                style={[
                  styles.planAction,
                  {
                    backgroundColor: actionDisabled ? theme.colors.blueSoft : tone.accent,
                    opacity: actionDisabled ? 0.72 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.planActionText,
                    { color: actionDisabled ? theme.colors.muted : '#FFFFFF' },
                  ]}
                >
                  {isPlanBusy ? 'Opening store...' : ctaLabel}
                </Text>
              </Pressable>
            </MotionView>
          );
        })}
      </View>

      <MotionView delay={430} style={[styles.noteCard, theme.shadow.card]}>
        <Text style={styles.noteTitle}>Billing and verification</Text>
        <Text style={styles.noteText}>
          Purchases happen in the native store, then Sentinel syncs RevenueCat-backed status to the
          backend before paid features should be trusted.
        </Text>
        <Text style={styles.noteText}>
          {offersQuery.error instanceof Error
            ? offersQuery.error.message
            : data.revenueCat.configured
              ? 'Store packages will appear as soon as the current offering is mapped to your plan identifiers.'
              : 'Set the RevenueCat project secret on the backend and platform public keys in Expo env to complete the flow.'}
        </Text>
        <Pressable onPress={handleManageBilling} style={[styles.manageButton, theme.shadow.glow]}>
          <Text style={styles.manageButtonText}>Manage billing in store</Text>
        </Pressable>
      </MotionView>
    </ScrollView>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 132,
    },
    title: {
      color: theme.colors.text,
      fontSize: 28,
      fontWeight: '800',
    },
    subtitle: {
      color: theme.colors.muted,
      marginTop: 10,
      lineHeight: 20,
      marginBottom: 18,
    },
    heroWrap: {
      borderRadius: 24,
      overflow: 'hidden',
      marginBottom: 16,
    },
    heroCard: {
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
    },
    heroHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14,
    },
    heroEyebrow: {
      color: theme.colors.blue,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    heroTitle: {
      color: theme.colors.text,
      fontSize: 24,
      fontWeight: '800',
    },
    heroPrice: {
      fontSize: 28,
      fontWeight: '900',
      marginTop: 8,
    },
    heroCadence: {
      color: theme.colors.muted,
      fontSize: 15,
      fontWeight: '700',
    },
    heroText: {
      color: theme.colors.muted,
      marginTop: 10,
      lineHeight: 20,
    },
    heroMetaList: {
      marginTop: 14,
      gap: 8,
    },
    heroMeta: {
      color: theme.colors.text,
      lineHeight: 19,
    },
    planBadge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    planBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
    syncPill: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    syncPillText: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 20,
    },
    secondaryButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 16,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    secondaryButtonText: {
      color: theme.colors.text,
      fontWeight: '700',
      textAlign: 'center',
    },
    sectionHeader: {
      marginBottom: 14,
    },
    sectionTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    sectionText: {
      color: theme.colors.muted,
      marginTop: 8,
      lineHeight: 20,
    },
    planList: {
      gap: 14,
    },
    planCard: {
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
    },
    planHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    planTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexShrink: 1,
    },
    planDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    planName: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    planPill: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    planPillText: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
    planPrice: {
      fontSize: 28,
      fontWeight: '900',
      marginTop: 14,
    },
    planCadence: {
      color: theme.colors.muted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: 4,
    },
    planSummary: {
      color: theme.colors.muted,
      lineHeight: 20,
      marginTop: 12,
    },
    featureList: {
      marginTop: 14,
      gap: 8,
    },
    feature: {
      color: theme.colors.text,
      lineHeight: 19,
    },
    planAction: {
      marginTop: 18,
      minHeight: 48,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    planActionText: {
      fontWeight: '800',
      textAlign: 'center',
    },
    noteCard: {
      marginTop: 22,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceStrong,
      padding: 18,
      gap: 10,
    },
    noteTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    noteText: {
      color: theme.colors.muted,
      lineHeight: 20,
    },
    manageButton: {
      marginTop: 8,
      minHeight: 50,
      borderRadius: 18,
      backgroundColor: theme.colors.blue,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
    },
    manageButtonText: {
      color: theme.colors.text,
      fontWeight: '700',
      textAlign: 'center',
    },
    emptyCard: {
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceStrong,
      padding: 20,
      gap: 10,
    },
    emptyTitle: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '800',
    },
    emptyText: {
      color: theme.colors.muted,
      lineHeight: 20,
    },
    retryButton: {
      marginTop: 8,
      minHeight: 48,
      borderRadius: 16,
      backgroundColor: theme.colors.blue,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
    },
    retryButtonText: {
      color: theme.colors.text,
      fontWeight: '700',
    },
  });
