import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Logs,
} from 'lucide-react-native';

import { EmptyState } from '../components/EmptyState';
import { MotionView } from '../components/MotionView';
import {
  AlertHistoryItem,
  getAlertHistory,
} from '../services/alerts';
import { useAppStore } from '../store/useAppStore';
import { useAppTheme } from '../theme';

const MAX_VISIBLE_HISTORY = 20;

export const RiskLogScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const {
    activeWatchSession,
    watchSessionHistory,
  } = useAppStore();

  const [alertHistory, setAlertHistory] = useState<
    AlertHistoryItem[]
  >([]);

  const [loadingAlerts, setLoadingAlerts] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [historyError, setHistoryError] =
    useState<string | null>(null);

  const loadAlertHistory = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoadingAlerts(true);
        }

        setHistoryError(null);

        const history = await getAlertHistory(
          MAX_VISIBLE_HISTORY,
        );

        setAlertHistory(
          Array.isArray(history)
            ? history.slice(
                0,
                MAX_VISIBLE_HISTORY,
              )
            : [],
        );
      } catch (error) {
        console.error(
          '[Sentinel] Failed to load alert history:',
          error,
        );

        setHistoryError(
          error instanceof Error
            ? error.message
            : 'Unable to load emergency history.',
        );
      } finally {
        setLoadingAlerts(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadAlertHistory();
  }, [loadAlertHistory]);

  const formatDate = (
    value?: string | null,
  ) => {
    if (!value) {
      return 'Unknown';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return 'Unknown';
    }

    return date.toLocaleString();
  };

  const formatLabel = (
    value?: string | null,
  ) => {
    if (!value) {
      return null;
    }

    return value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase(),
      );
  };

  const getAlertTitle = (
    alert: AlertHistoryItem,
  ) => {
    switch (alert.triggerSource) {
      case 'panic':
        return 'Manual panic alert';

      case 'passive_detection':
        return 'Safety check alert';

      default:
        return 'Emergency alert';
    }
  };

  const getAlertIcon = (
    alert: AlertHistoryItem,
  ) => {
    if (alert.status === 'cancelled') {
      return CheckCircle2;
    }

    if (
      alert.stage === 'critical' ||
      alert.severity === 'Critical'
    ) {
      return AlertTriangle;
    }

    return Logs;
  };

  const renderEmergencyAlert = (
    alert: AlertHistoryItem,
  ) => {
    const Icon = getAlertIcon(alert);

    const startedAt =
      alert.session?.startedAt ||
      alert.createdAt;

    const endedAt =
      alert.session?.endedAt ||
      alert.resolvedAt;

    return (
      <View
        key={alert.id}
        style={styles.alertItem}
      >
        <View style={styles.alertHeader}>
          <View style={styles.alertIcon}>
            <Icon
              size={18}
              color={theme.colors.text}
            />
          </View>

          <View style={styles.alertHeaderText}>
            <Text style={styles.timelineTitle}>
              {getAlertTitle(alert)}
            </Text>

            {alert.severity ? (
              <Text style={styles.timelineMeta}>
                {alert.severity}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.details}>
          <Text style={styles.timelineMeta}>
            Started {formatDate(startedAt)}
          </Text>

          {endedAt ? (
            <Text style={styles.timelineMeta}>
              Ended {formatDate(endedAt)}
            </Text>
          ) : null}

          {alert.stage ? (
            <Text style={styles.timelineMeta}>
              Highest stage{' '}
              {formatLabel(alert.stage)}
            </Text>
          ) : null}

          {alert.status ? (
            <Text style={styles.timelineMeta}>
              Status{' '}
              {formatLabel(alert.status)}
            </Text>
          ) : null}
        </View>

        {alert.detectionSummary?.length ? (
          <View style={styles.noteBox}>
            <Text style={styles.timelineNote}>
              {alert.detectionSummary.join(' • ')}
            </Text>
          </View>
        ) : null}

        {alert.latestAudit ? (
          <Text style={styles.auditMeta}>
            Last event:{' '}
            {formatLabel(
              alert.latestAudit.eventType,
            )}{' '}
            ·{' '}
            {formatDate(
              alert.latestAudit.createdAt,
            )}
          </Text>
        ) : null}
      </View>
    );
  };

  const visibleWatchSessions =
    watchSessionHistory.slice(
      0,
      MAX_VISIBLE_HISTORY,
    );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() =>
            void loadAlertHistory(true)
          }
          tintColor={theme.colors.text}
          colors={[theme.colors.text]}
          progressBackgroundColor={
            theme.colors.surface
          }
        />
      }
    >
      <MotionView delay={40}>
        <Text style={styles.title}>
          History
        </Text>

        <Text style={styles.subtitle}>
          Review recent watch sessions and
          emergency alerts so you can remember
          what happened and when.
        </Text>
      </MotionView>

      <MotionView
        delay={120}
        style={[
          styles.card,
          theme.shadow.card,
        ]}
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionTitle}>
              Watch sessions
            </Text>

            <Text style={styles.sourceText}>
              Recent sessions
            </Text>
          </View>
        </View>

        {activeWatchSession ? (
          <View style={styles.sessionItem}>
            <View style={styles.activeRow}>
              <View
                style={styles.activeIndicator}
              />

              <Text style={styles.activeLabel}>
                Active watch
              </Text>
            </View>

            <Text style={styles.timelineTitle}>
              Watching with{' '}
              {activeWatchSession.contactName}
            </Text>

            <Text style={styles.timelineMeta}>
              Ends{' '}
              {new Date(
                activeWatchSession.endsAt,
              ).toLocaleString()}
            </Text>

            {activeWatchSession.note ? (
              <Text style={styles.timelineNote}>
                {activeWatchSession.note}
              </Text>
            ) : null}
          </View>
        ) : null}

        {visibleWatchSessions.length === 0 &&
        !activeWatchSession ? (
          <EmptyState
            icon={Clock3}
            title="No watch sessions yet"
            message="Start one from Contacts when you want someone to keep an eye on a trip, commute, or late walk."
          />
        ) : null}

        {visibleWatchSessions.map(
          (session) => (
            <View
              key={session.id}
              style={styles.sessionItem}
            >
              <Text style={styles.timelineTitle}>
                {session.contactName}
              </Text>

              <Text style={styles.timelineMeta}>
                {session.durationMinutes}{' '}
                minutes · ended{' '}
                {new Date(
                  session.endsAt,
                ).toLocaleString()}
              </Text>

              {session.note ? (
                <Text style={styles.timelineNote}>
                  {session.note}
                </Text>
              ) : null}
            </View>
          ),
        )}

        {watchSessionHistory.length >
        MAX_VISIBLE_HISTORY ? (
          <Text style={styles.limitText}>
            Showing the {MAX_VISIBLE_HISTORY}{' '}
            most recent watch sessions.
          </Text>
        ) : null}
      </MotionView>

      <MotionView
        delay={180}
        style={[
          styles.card,
          theme.shadow.card,
        ]}
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionTitle}>
              Emergency history
            </Text>

            <Text style={styles.sourceText}>
              Showing the {MAX_VISIBLE_HISTORY}{' '}
              most recent alerts
            </Text>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Refresh emergency history"
            onPress={() =>
              void loadAlertHistory(true)
            }
            disabled={refreshing}
            activeOpacity={0.7}
            style={[
              styles.refreshButton,
              refreshing &&
                styles.refreshButtonDisabled,
            ]}
          >
            <Text
              style={styles.refreshButtonText}
            >
              {refreshing
                ? 'Refreshing'
                : 'Refresh'}
            </Text>
          </TouchableOpacity>
        </View>

        {loadingAlerts ? (
          <View style={styles.loadingState}>
            <Text style={styles.timelineMeta}>
              Loading emergency history...
            </Text>
          </View>
        ) : historyError ? (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>
              {historyError}
            </Text>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Retry loading emergency history"
              onPress={() =>
                void loadAlertHistory()
              }
              activeOpacity={0.7}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>
                Try again
              </Text>
            </TouchableOpacity>
          </View>
        ) : alertHistory.length === 0 ? (
          <EmptyState
            icon={Logs}
            title="No emergency history"
            message="When you use SOS or a safety check escalates, the alert will appear here."
          />
        ) : (
          alertHistory.map(
            renderEmergencyAlert,
          )
        )}
      </MotionView>
    </ScrollView>
  );
};

export const AlertHistoryScreen =
  RiskLogScreen;

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        theme.colors.background,
    },

    content: {
      padding: 20,
      paddingBottom: 40,
      gap: 16,
    },

    title: {
      fontSize: 30,
      fontWeight: '800',
      color: theme.colors.text,
      marginBottom: 6,
    },

    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.textMuted,
    },

    card: {
      backgroundColor:
        theme.colors.surface,
      borderRadius: 18,
      padding: 18,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        theme.colors.border,
    },

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },

    sectionHeaderText: {
      flex: 1,
    },

    sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.text,
      marginBottom: 4,
    },

    sourceText: {
      fontSize: 12,
      lineHeight: 17,
      color: theme.colors.textMuted,
    },

    refreshButton: {
      minHeight: 36,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        theme.colors.background,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        theme.colors.border,
    },

    refreshButtonDisabled: {
      opacity: 0.55,
    },

    refreshButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.text,
    },

    sessionItem: {
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        theme.colors.border,
      paddingTop: 14,
      marginTop: 14,
    },

    alertItem: {
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        theme.colors.border,
      paddingTop: 16,
      marginTop: 16,
    },

    alertHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },

    alertIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        theme.colors.background,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        theme.colors.border,
      marginRight: 11,
    },

    alertHeaderText: {
      flex: 1,
    },

    timelineTitle: {
      fontSize: 16,
      lineHeight: 21,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 5,
    },

    timelineMeta: {
      fontSize: 13,
      lineHeight: 19,
      color: theme.colors.textMuted,
      marginTop: 2,
    },

    timelineNote: {
      fontSize: 13,
      lineHeight: 19,
      color: theme.colors.text,
    },

    details: {
      marginTop: 2,
    },

    noteBox: {
      marginTop: 10,
      padding: 10,
      borderRadius: 10,
      backgroundColor:
        theme.colors.background,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        theme.colors.border,
    },

    auditMeta: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.colors.textMuted,
      marginTop: 10,
    },

    activeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },

    activeIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor:
        theme.colors.text,
      marginRight: 7,
    },

    activeLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.text,
    },

    limitText: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.colors.textMuted,
      marginTop: 16,
      textAlign: 'center',
    },

    loadingState: {
      paddingTop: 16,
    },

    errorState: {
      paddingTop: 16,
    },

    errorText: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.text,
    },

    retryButton: {
      alignSelf: 'flex-start',
      marginTop: 12,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor:
        theme.colors.background,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        theme.colors.border,
    },

    retryButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.text,
    },
  });