import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MotionView } from '../components/MotionView';
import { useAppTheme } from '../theme';

const ScreenFrame = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) => {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <MotionView delay={40}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </MotionView>
      {children}
    </ScrollView>
  );
};

const InfoCard = ({
  title,
  copy,
  delay,
}: {
  title: string;
  copy: string;
  delay: number;
}) => {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <MotionView delay={delay} style={[styles.card, theme.shadow.card]}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardCopy}>{copy}</Text>
    </MotionView>
  );
};

export const SupportScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <ScreenFrame
      title="Support"
      subtitle="Find the fastest way to get help with alerts, account access, and app issues."
    >
      <InfoCard
        title="Help options"
        copy="If something feels off, start here before an emergency moment becomes stressful. We can connect this page to chat, email, or a support form next."
        delay={110}
      />
      <InfoCard
        title="Common help topics"
        copy="Alert not starting, account login problems, live location concerns, trusted contact setup, and subscription questions."
        delay={170}
      />
      <MotionView delay={230}>
        <Pressable style={[styles.primaryButton, theme.shadow.glow]}>
          <Text style={styles.primaryButtonText}>Contact support</Text>
        </Pressable>
      </MotionView>
    </ScreenFrame>
  );
};

export const AboutScreen = () => {
  return (
    <ScreenFrame
      title="About"
      subtitle="A quick overview of what Sentinel Watchtower is built to do."
    >
      <InfoCard
        title="Mission"
        copy="Sentinel Watchtower focuses on faster emergency response, trusted-circle visibility, and calmer safety workflows during urgent moments."
        delay={110}
      />
      <InfoCard
        title="What this app includes"
        copy="Location-aware alerts, watch sessions, trusted contacts, account safety controls, and a cleaner emergency-first mobile experience."
        delay={170}
      />
      <InfoCard
        title="Version note"
        copy="This page is ready for real version metadata later if you want to surface build number and release details."
        delay={230}
      />
    </ScreenFrame>
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
      paddingTop: 24,
      paddingBottom: 120,
    },
    title: {
      color: theme.colors.text,
      fontSize: 28,
      fontWeight: '800',
      marginBottom: 8,
    },
    subtitle: {
      color: theme.colors.muted,
      lineHeight: 20,
      marginBottom: 18,
    },
    card: {
      padding: 18,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceStrong,
      marginBottom: 14,
    },
    cardTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 10,
    },
    cardCopy: {
      color: theme.colors.muted,
      lineHeight: 20,
    },
    primaryButton: {
      minHeight: 50,
      borderRadius: 18,
      backgroundColor: theme.colors.blue,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    primaryButtonText: {
      color: theme.colors.text,
      fontWeight: '700',
    },
  });
