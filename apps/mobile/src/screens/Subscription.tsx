import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotionView } from '../components/MotionView';
import { useAppTheme } from '../theme';

type PlanTone = 'default' | 'silver' | 'gold' | 'platinum';

type Plan = {
  id: string;
  name: string;
  price: string;
  cadence: string;
  tone: PlanTone;
  summary: string;
  features: string[];
  isCurrent?: boolean;
};

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free Tier',
    price: 'NGN 0',
    cadence: 'default plan',
    tone: 'default',
    summary: 'Essential access for personal safety, SOS triggers, and live location awareness.',
    features: [
      'Emergency SOS access',
      'Basic trusted contact support',
      'Live location view on your device',
    ],
    isCurrent: true,
  },
  {
    id: 'individual',
    name: 'Individual',
    price: 'NGN 1000',
    cadence: 'per month',
    tone: 'silver',
    summary: 'Silver coverage for stronger solo monitoring and richer alert follow-through.',
    features: [
      'Priority monitoring workflows',
      'Expanded alert history and follow-up visibility',
      'Improved trusted contact coordination',
    ],
  },
  {
    id: 'family',
    name: 'Family',
    price: 'NGN 3500',
    cadence: 'per month',
    tone: 'gold',
    summary: 'Gold access for households that want better shared safety coverage across members.',
    features: [
      'Multi-member family coverage',
      'Shared household alert visibility',
      'Better watch session coordination for loved ones',
    ],
  },
  {
    id: 'platinum',
    name: 'Platinum',
    price: 'NGN 7000',
    cadence: 'per month',
    tone: 'platinum',
    summary: 'Organization-grade coverage for teams, institutions, and larger coordinated response groups.',
    features: [
      'Organization-level safety coverage',
      'Centralized visibility across members',
      'Advanced coordination for active incidents',
    ],
  },
];

const toneColors = {
  default: {
    accent: '#1E63FF',
    border: '#B7CBF2',
    fill: 'rgba(30,99,255,0.08)',
  },
  silver: {
    accent: '#8A96A8',
    border: '#CAD3DE',
    fill: 'rgba(138,150,168,0.12)',
  },
  gold: {
    accent: '#C89211',
    border: '#E5CD8A',
    fill: 'rgba(200,146,17,0.12)',
  },
  platinum: {
    accent: '#35517D',
    border: '#9DB1CF',
    fill: 'rgba(53,81,125,0.12)',
  },
} as const;

export const SubscriptionScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const currentPlan = plans.find((plan) => plan.isCurrent) ?? plans[0];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <MotionView delay={40}>
        <Text style={styles.title}>Subscription</Text>
        <Text style={styles.subtitle}>
          Choose the level of coverage that fits how you use Sentinel-Watchtower right now.
        </Text>
      </MotionView>

      <MotionView delay={110} style={[styles.heroWrap, theme.shadow.card]}>
        <LinearGradient colors={theme.gradients.hero} style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Current plan</Text>
          <Text style={styles.heroTitle}>{currentPlan.name}</Text>
          <Text style={styles.heroPrice}>
            {currentPlan.price} <Text style={styles.heroCadence}>/ {currentPlan.cadence}</Text>
          </Text>
          <Text style={styles.heroText}>{currentPlan.summary}</Text>
        </LinearGradient>
      </MotionView>

      <View style={styles.planList}>
        {plans.map((plan, index) => {
          const tone = toneColors[plan.tone];

          return (
            <MotionView
              key={plan.id}
              delay={170 + index * 60}
              style={[
                styles.planCard,
                theme.shadow.card,
                {
                  borderColor: plan.isCurrent ? tone.border : theme.colors.border,
                  backgroundColor: plan.isCurrent ? tone.fill : theme.colors.surface,
                },
              ]}
            >
              <View style={styles.planHeader}>
                <View style={styles.planTitleWrap}>
                  <View style={[styles.planDot, { backgroundColor: tone.accent }]} />
                  <Text style={styles.planName}>{plan.name}</Text>
                </View>
                {plan.isCurrent ? (
                  <View style={[styles.planBadge, { backgroundColor: tone.accent }]}>
                    <Text style={styles.planBadgeText}>DEFAULT</Text>
                  </View>
                ) : null}
              </View>

              <Text style={[styles.planPrice, { color: tone.accent }]}>{plan.price}</Text>
              <Text style={styles.planCadence}>{plan.cadence}</Text>
              <Text style={styles.planSummary}>{plan.summary}</Text>

              <View style={styles.featureList}>
                {plan.features.map((feature) => (
                  <Text key={feature} style={styles.feature}>
                    • {feature}
                  </Text>
                ))}
              </View>
            </MotionView>
          );
        })}
      </View>

      <MotionView delay={430}>
        <Pressable style={[styles.button, theme.shadow.glow]}>
          <Text style={styles.buttonText}>Manage Plan</Text>
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
      paddingBottom: 120,
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
      marginBottom: 18,
    },
    heroCard: {
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.blueGlow,
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
      color: theme.colors.blue,
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
    button: {
      marginTop: 22,
      padding: 16,
      borderRadius: 18,
      backgroundColor: theme.colors.blue,
      alignItems: 'center',
    },
    buttonText: {
      color: theme.colors.text,
      fontWeight: '700',
    },
  });
