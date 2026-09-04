import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { shallow } from 'zustand/shallow';
import { MotionView } from '../components/MotionView';
import {
  SubscriptionState,
  syncSubscriptionState,
} from '../services/subscriptions';
import { useAppStore } from '../store/useAppStore';
import { useAppTheme } from '../theme';

type Props = {
  reference: string | null;
};

export const PaymentSuccessScreen = ({ reference }: Props) => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const queryClient = useQueryClient();
  const { setScreen } = useAppStore(
    (state) => ({
      setScreen: state.setScreen,
    }),
    shallow,
  );
  const verifyMutation = useMutation({
    mutationFn: async (): Promise<SubscriptionState> => syncSubscriptionState('purchase', reference),
    onSuccess: (state: SubscriptionState) => {
      queryClient.setQueryData(['subscription-state'], state);
      void queryClient.invalidateQueries({ queryKey: ['subscription-state'] });
    },
  });

  React.useEffect(() => {
    if (reference) {
      verifyMutation.mutate();
    }
    // The callback screen represents one payment attempt and should verify once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  const verified = verifyMutation.data?.activePlanId !== 'free';
  const planName = verifyMutation.data?.catalog.find(
    (plan: SubscriptionState['catalog'][number]) => plan.id === verifyMutation.data?.activePlanId,
  )?.name;

  return (
    <View style={styles.container}>
      <LinearGradient colors={theme.gradients.appBackground} style={StyleSheet.absoluteFill} />
      <View style={styles.glow} />
      <MotionView delay={40} style={styles.content}>
        <View style={[styles.icon, { borderColor: verified ? theme.semantic.success.border : theme.colors.borderStrong }]}>
          {verifyMutation.isPending ? (
            <ActivityIndicator color={theme.colors.blueGlow} size="large" />
          ) : (
            <Text style={[styles.iconText, { color: verified ? theme.colors.success : theme.colors.red }]}>
              {verified ? 'OK' : '!'}
            </Text>
          )}
        </View>
        <Text style={styles.eyebrow}>PAYMENT RETURN</Text>
        <Text style={styles.title}>
          {verifyMutation.isPending
            ? 'Confirming your payment'
            : verified
              ? 'Payment successful'
              : 'Payment needs attention'}
        </Text>
        <Text style={styles.copy}>
          {verifyMutation.isPending
            ? 'Paystack returned you to Sentinel. We are checking the transaction reference now.'
            : verified
              ? `${planName || 'Your paid plan'} is now active on this account.`
              : verifyMutation.error?.message ||
                (reference
                  ? 'The payment could not be confirmed yet. You can retry the verification.'
                  : 'No Paystack transaction reference was included in the callback.')}
        </Text>

        {reference ? (
          <Text style={styles.reference} numberOfLines={1}>
            Reference: {reference}
          </Text>
        ) : null}

        <View style={styles.actions}>
          {!verifyMutation.isPending && !verified && reference ? (
            <Pressable
              onPress={() => verifyMutation.mutate()}
              style={[styles.primaryButton, { backgroundColor: theme.colors.blue }]}
            >
              <Text style={styles.primaryButtonText}>Try verification again</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setScreen('subscription')}
            style={[styles.secondaryButton, { borderColor: theme.colors.borderStrong }]}
          >
            <Text style={styles.secondaryButtonText}>View subscription</Text>
          </Pressable>
          <Pressable onPress={() => setScreen('home')} style={styles.homeButton}>
            <Text style={styles.homeButtonText}>Return home</Text>
          </Pressable>
        </View>
      </MotionView>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: { flex: 1, overflow: 'hidden' },
    glow: {
      position: 'absolute',
      width: 280,
      height: 280,
      borderRadius: 999,
      backgroundColor: theme.colors.blueGlow,
      opacity: theme.isDark ? 0.08 : 0.13,
      top: -100,
      right: -100,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 28,
      paddingBottom: 32,
    },
    icon: {
      width: 88,
      height: 88,
      borderRadius: 44,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      marginBottom: 28,
    },
    iconText: { fontSize: 48, fontWeight: '800' },
    eyebrow: { color: theme.colors.blueGlow, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
    title: { color: theme.colors.text, fontSize: 32, fontWeight: '800', marginTop: 10 },
    copy: { color: theme.colors.muted, fontSize: 16, lineHeight: 24, marginTop: 14 },
    reference: { color: theme.colors.muted, fontSize: 12, marginTop: 18 },
    actions: { gap: 12, marginTop: 34 },
    primaryButton: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
    primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
    secondaryButton: { borderWidth: 1, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
    secondaryButtonText: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
    homeButton: { alignItems: 'center', paddingVertical: 10 },
    homeButtonText: { color: theme.colors.muted, fontSize: 14, fontWeight: '700' },
  });
