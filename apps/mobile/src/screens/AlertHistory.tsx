import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MotionView } from '../components/MotionView';
import { useAppStore } from '../store/useAppStore';
import { useAppTheme } from '../theme';

export const RiskLogScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { activeWatchSession, sessionHistory, watchSessionHistory } = useAppStore();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <MotionView delay={40}>
        <Text style={styles.title}>Risk Log</Text>
        <Text style={styles.subtitle}>
          Your recent watch sessions, emergency activations, and on-device safety trail appear here.
        </Text>
      </MotionView>

      <MotionView delay={120} style={[styles.card, theme.shadow.card]}>
        <Text style={styles.sectionTitle}>Watch sessions</Text>
        {activeWatchSession ? (
          <View style={styles.timelineRow}>
            <Text style={styles.timelineTitle}>Active watch with {activeWatchSession.contactName}</Text>
            <Text style={styles.timelineMeta}>
              Ends {new Date(activeWatchSession.endsAt).toLocaleString()}
            </Text>
            {activeWatchSession.note ? (
              <Text style={styles.timelineNote}>{activeWatchSession.note}</Text>
            ) : null}
          </View>
        ) : null}
        {watchSessionHistory.length === 0 && !activeWatchSession ? (
          <Text style={styles.cardText}>No watch sessions recorded yet.</Text>
        ) : null}
        {watchSessionHistory.map((session) => (
          <View key={session.id} style={styles.timelineRow}>
            <Text style={styles.timelineTitle}>{session.contactName}</Text>
            <Text style={styles.timelineMeta}>
              {session.durationMinutes} minutes • ended {new Date(session.endsAt).toLocaleString()}
            </Text>
            {session.note ? <Text style={styles.timelineNote}>{session.note}</Text> : null}
          </View>
        ))}
      </MotionView>

      <MotionView delay={180} style={[styles.card, theme.shadow.card]}>
        <Text style={styles.sectionTitle}>Emergency history</Text>
        {sessionHistory.length === 0 ? (
          <Text style={styles.cardText}>No past emergency sessions yet.</Text>
        ) : (
          sessionHistory.map((session) => (
            <View key={session.sessionId} style={styles.timelineRow}>
              <Text style={styles.timelineTitle}>
                {session.triggerSource === 'panic' ? 'Panic alert' : 'Emergency session'}
              </Text>
              <Text style={styles.timelineMeta}>
                Started {new Date(session.startedAt || Date.now()).toLocaleString()}
              </Text>
              <Text style={styles.timelineMeta}>
                Ended {new Date(session.endedAt || Date.now()).toLocaleString()}
              </Text>
              <Text style={styles.timelineNote}>{session.locationCount} location samples captured</Text>
            </View>
          ))
        )}
      </MotionView>
    </ScrollView>
  );
};

export const AlertHistoryScreen = RiskLogScreen;

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    content: {
      padding: 20,
      paddingBottom: 120,
    },
    title: {
      color: theme.colors.text,
      fontSize: 28,
      fontWeight: '800',
      marginBottom: 10,
    },
    subtitle: {
      color: theme.colors.muted,
      lineHeight: 20,
      marginBottom: 16,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 16,
    },
    sectionTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 12,
    },
    cardText: {
      color: theme.colors.muted,
      lineHeight: 18,
    },
    timelineRow: {
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    timelineTitle: {
      color: theme.colors.text,
      fontWeight: '700',
      marginBottom: 4,
    },
    timelineMeta: {
      color: theme.colors.muted,
      marginTop: 2,
      fontSize: 12,
    },
    timelineNote: {
      color: theme.colors.blue,
      marginTop: 6,
      fontSize: 12,
      lineHeight: 17,
    },
  });
