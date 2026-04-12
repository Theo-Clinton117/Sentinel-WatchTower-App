import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotionView } from '../components/MotionView';
import { useAppTheme } from '../theme';

export const SubscriptionScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <MotionView delay={40}>
        <Text style={styles.title}>Subscription</Text>
      </MotionView>
      <MotionView delay={120} style={[styles.heroWrap, theme.shadow.card]}>
        <LinearGradient colors={theme.gradients.hero} style={styles.heroCard}>
          <Text style={styles.price}>NGN 1000 / month</Text>
          <Text style={styles.cardText}>Premium monitoring, escalation triggers, and safer active sessions.</Text>
        </LinearGradient>
      </MotionView>
      <MotionView delay={190} style={[styles.card, theme.shadow.card]}>
        <Text style={styles.sectionTitle}>Included in Pro</Text>
        <Text style={styles.feature}>24/7 active alert escalation</Text>
        <Text style={styles.feature}>Expanded trusted contact workflows</Text>
        <Text style={styles.feature}>Improved session visibility and follow-up logs</Text>
      </MotionView>
      <MotionView delay={260}>
        <Pressable style={[styles.button, theme.shadow.glow]}>
          <Text style={styles.buttonText}>Manage Plan</Text>
        </Pressable>
      </MotionView>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      backgroundColor: 'transparent',
    },
    title: {
      color: theme.colors.text,
      fontSize: 28,
      fontWeight: '800',
      marginBottom: 16,
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
      borderColor: theme.colors.blueGlow,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    price: {
      color: theme.colors.blue,
      fontSize: 28,
      fontWeight: '800',
    },
    cardText: {
      color: theme.colors.muted,
      marginTop: 8,
      lineHeight: 20,
    },
    sectionTitle: {
      color: theme.colors.text,
      fontWeight: '700',
      marginBottom: 12,
      fontSize: 16,
    },
    feature: {
      color: theme.colors.text,
      marginTop: 10,
      lineHeight: 19,
    },
    button: {
      marginTop: 20,
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
