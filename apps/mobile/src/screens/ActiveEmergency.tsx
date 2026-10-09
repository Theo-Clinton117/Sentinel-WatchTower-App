import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DismissibleNoticeCard } from '../components/DismissibleNoticeCard';
import { LiveMap } from '../components/LiveMap';
import { MotionView } from '../components/MotionView';
import { useAppStore } from '../store/useAppStore';
import { useAppTheme } from '../theme';
import { ApiError } from '../services/api';
import { cancelAlert, escalateAlert } from '../services/alerts';
import {
  getCurrentLocation,
  startBackgroundTracking,
  startForegroundTracking,
  stopBackgroundTracking,
} from '../services/location';
import { getActiveSession, listSessionLocations } from '../services/sessions';
import {
  connectSessionSocket,
  disconnectSessionSocket,
} from '../services/websocket';
import { shallow } from 'zustand/shallow';

const STAGES = [
  {
    id: 'monitoring', level: 1, title: 'Monitoring',
    description: 'Something may be developing; keep a private record for yourself.',
    examples: 'Suspicious situation, uncomfortable environment, unusual activity.',
  },
  {
    id: 'suspicious', level: 2, title: 'Concern',
    description: 'Tell your trusted Circle that you feel unsafe.',
    examples: 'Being followed, suspicious activity, escalating confrontation.',
  },
  {
    id: 'soft_alert', level: 3, title: 'Help needed',
    description: 'Ask your Circle for assistance through Sentinel.',
    examples: 'Stranded, harassment, minor accident, medical assistance.',
  },
  {
    id: 'high_alert', level: 4, title: 'Immediate danger',
    description: 'Use for an urgent threat to life or serious harm.',
    examples: 'Violent attack, armed threat, kidnapping attempt, serious medical emergency.',
  },
] as const;

const SessionTimer = React.memo(
  ({
    startedAt,
    style,
  }: {
    startedAt?: string | null;
    style: {
      color: string;
      fontSize: number;
      fontWeight: '800';
      marginTop: number;
    };
  }) => {
    const [duration, setDuration] = useState('00:00');

    useEffect(() => {
      const updateDuration = () => {
        const start = startedAt
          ? new Date(startedAt).getTime()
          : Date.now();

        const seconds = Math.max(
          0,
          Math.floor((Date.now() - start) / 1000),
        );

        const minutes = Math.floor(seconds / 60)
          .toString()
          .padStart(2, '0');

        const secs = (seconds % 60).toString().padStart(2, '0');

        setDuration(`${minutes}:${secs}`);
      };

      updateDuration();

      const timer = setInterval(updateDuration, 1000);

      return () => clearInterval(timer);
    }, [startedAt]);

    return <Text style={style}>{duration}</Text>;
  },
);

export const ActiveEmergencyScreen = () => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {
    activeSession,
    emergencyLocations,
    lastKnownLocation,
    appendEmergencyLocations,
    clearEmergencySession,
    setLastKnownLocation,
    updateActiveSession,
  } = useAppStore(
    (state) => ({
      activeSession: state.activeSession,
      emergencyLocations: state.emergencyLocations,
      lastKnownLocation: state.lastKnownLocation,
      appendEmergencyLocations: state.appendEmergencyLocations,
      clearEmergencySession: state.clearEmergencySession,
      setLastKnownLocation: state.setLastKnownLocation,
      updateActiveSession: state.updateActiveSession,
    }),
    shallow,
  );

  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [syncing, setSyncing] = useState(true);
  const [socketDegraded, setSocketDegraded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const pulse = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    if (!activeSession?.sessionId) {
      setSyncing(false);
      return;
    }

    let mounted = true;
    let foregroundSubscription: { remove: () => void } | null = null;

    const bootstrapSession = async () => {
      try {
        setError('');

        const [storedLocations, currentLocation] = await Promise.all([
          listSessionLocations(activeSession.sessionId),
          getCurrentLocation().catch(() => null),
        ]);

        if (!mounted) {
          return;
        }

        appendEmergencyLocations(storedLocations);

        if (currentLocation) {
          setLastKnownLocation(currentLocation);
        }

        foregroundSubscription = await startForegroundTracking();

        await startBackgroundTracking().catch(() => undefined);
      } catch (loadError) {
        if (mounted) {
          const message =
            loadError instanceof ApiError
              ? loadError.message
              : 'Emergency session sync is degraded. Sentinel will keep trying to update your state.';

          setError(message);
        }
      } finally {
        if (mounted) {
          setSyncing(false);
        }
      }
    };

    connectSessionSocket(activeSession.sessionId, {
      onConnected: () => {
        if (mounted) {
          setSocketDegraded(false);
          setError('');
        }
      },

      onDisconnected: () => {
        if (mounted) {
          setSocketDegraded(true);
          setError(
            'Live connection interrupted. Location capture is still running and will retry.',
          );
        }
      },

      onConnectionError: () => {
        if (mounted) {
          setSocketDegraded(true);
          setError(
            'Live connection could not be restored yet. Sentinel will keep retrying.',
          );
        }
      },

      onLocationUpdate: (locations) => {
        appendEmergencyLocations(locations);
      },

      onStatus: ({ status, stage }) => {
        if (status && status !== 'active') {
          clearEmergencySession();
          return;
        }

        if (stage) {
          updateActiveSession({
            status,
            alertStatus: status,
            alertStage: stage,
          });
        }
      },
    });

    void bootstrapSession();

    return () => {
      mounted = false;

      foregroundSubscription?.remove?.();

      void stopBackgroundTracking().catch(() => undefined);

      disconnectSessionSocket();
    };
  }, [
    activeSession?.sessionId,
    appendEmergencyLocations,
    clearEmergencySession,
    setLastKnownLocation,
    updateActiveSession,
  ]);

  useEffect(() => {
    if (!socketDegraded || !activeSession?.sessionId) {
      return;
    }

    let mounted = true;

    const pollSession = async () => {
      try {
        const [session, locations] = await Promise.all([
          getActiveSession(),
          listSessionLocations(activeSession.sessionId),
        ]);

        if (!mounted) {
          return;
        }

        appendEmergencyLocations(locations);

        if (!session) {
          clearEmergencySession();
          return;
        }

        updateActiveSession(session);
      } catch {
        if (mounted) {
          setError(
            'Live fallback polling is delayed. Location capture will continue retrying.',
          );
        }
      }
    };

    void pollSession();

    const interval = setInterval(pollSession, 8000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [
    activeSession?.sessionId,
    appendEmergencyLocations,
    clearEmergencySession,
    socketDegraded,
    updateActiveSession,
  ]);

  const handleEscalate = useCallback(
    async (stage: string) => {
      if (!activeSession?.alertId || escalating) {
        return;
      }

      try {
        setEscalating(true);
        setError('');

        const alert = await escalateAlert(activeSession.alertId, {
          stage,
          riskScore: activeSession.riskScore ?? undefined,
          riskSnapshot: activeSession.riskSnapshot ?? {},
          detectionSummary: activeSession.detectionSummary ?? [],
        });

        updateActiveSession({
          status: alert.status,
          triggerSource: alert.triggerSource,
          alertStage: alert.alertStage,
          escalationLevel: alert.escalationLevel,
          alertStatus: alert.alertStatus,
          riskScore: alert.riskScore ?? activeSession.riskScore,
          cancelExpiresAt: alert.cancelExpiresAt,
          riskSnapshot:
            alert.riskSnapshot ?? activeSession.riskSnapshot ?? {},
          detectionSummary:
            alert.detectionSummary ??
            activeSession.detectionSummary ??
            [],
        });

        setShowDetails(false);
      } catch (escalateError) {
        const message =
          escalateError instanceof ApiError
            ? escalateError.message
            : 'Could not update the alert right now.';

        setError(message);
      } finally {
        setEscalating(false);
      }
    },
    [activeSession, escalating, updateActiveSession],
  );

  const handleCancel = useCallback(async () => {
    if (!activeSession?.alertId) {
      clearEmergencySession();
      return;
    }

    try {
      setCancelling(true);
      setError('');

      await cancelAlert(activeSession.alertId);

      clearEmergencySession();
    } catch (cancelError) {
      const message =
        cancelError instanceof ApiError
          ? cancelError.message
          : 'Could not cancel the alert right now.';

      setError(message);
    } finally {
      setCancelling(false);
    }
  }, [activeSession?.alertId, clearEmergencySession]);

  if (!activeSession?.sessionId) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Emergency Active</Text>
        <Text style={styles.emptyText}>
          No live emergency session is loaded.
        </Text>
      </View>
    );
  }

  const stage = activeSession.alertStage || 'monitoring';

  const currentStage =
    STAGES.find((item) => item.id === stage) || STAGES[0];

  const latestLocation =
    lastKnownLocation ||
    (emergencyLocations.length
      ? emergencyLocations[emergencyLocations.length - 1]
      : null);

  const locationCount = emergencyLocations.length;

  const formattedAccuracy =
    typeof latestLocation?.accuracyM === 'number'
      ? `${Math.round(latestLocation.accuracyM)}m`
      : 'Unknown';

  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.05],
  });

  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.45],
  });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <MotionView delay={40}>
        <View style={styles.discreetHeader}>
          <View style={styles.statusGroup}>
            <View style={styles.statusIndicator}>
              <Animated.View
                style={[
                  styles.statusPulse,
                  {
                    opacity: pulseOpacity,
                    transform: [{ scale: pulseScale }],
                  },
                ]}
              />

              <View style={styles.statusDot} />
            </View>

            <View>
              <Text style={styles.statusTitle}>Sentinel active</Text>
              <Text style={styles.statusSubtitle}>
                {currentStage.title}
              </Text>
            </View>
          </View>

          <View style={styles.stageBadge}>
            <Text style={styles.stageBadgeText}>
              {stage.replace('_', ' ')}
            </Text>
          </View>
        </View>
      </MotionView>

      <MotionView delay={100}>
        <View style={styles.controlCard}>
          <Text style={styles.controlTitle}>
            What is happening?
          </Text>

          <Text style={styles.controlDescription}>
            Sentinel is already tracking this emergency. Choose the
            response level that matches your situation.
          </Text>

          <View style={styles.stageList}>
            {STAGES.map((item) => {
              const selected = item.id === stage;
              const isEscalation = item.level > currentStage.level;

              return (
                <Pressable
                  key={item.id}
                  onPress={() => handleEscalate(item.id)}
                  disabled={selected || !isEscalation || escalating || cancelling}
                  style={[
                    styles.stageOption,
                    selected && styles.stageOptionSelected,
                  ]}
                >
                  <View style={styles.stageOptionCopy}>
                    <Text style={styles.stageOptionTitle}>
                      Level {item.level} · {item.title}
                    </Text>

                    <Text style={styles.stageOptionDescription}>
                      {item.description}
                    </Text>
                    <Text style={styles.stageOptionDescription}>{item.examples}</Text>
                  </View>

                  {selected ? (
                    <View style={styles.selectedIndicator}>
                      <Text style={styles.selectedIndicatorText}>
                        ACTIVE
                      </Text>
                    </View>
                  ) : escalating ? (
                    <ActivityIndicator color={theme.colors.text} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={styles.safeButton}
            onPress={handleCancel}
            disabled={cancelling || escalating}
          >
            {cancelling ? (
              <ActivityIndicator color={theme.colors.text} />
            ) : (
              <Text style={styles.safeButtonText}>
                I'm Safe — End Alert
              </Text>
            )}
          </Pressable>
        </View>
      </MotionView>

      <DismissibleNoticeCard
        visible={Boolean(error)}
        title="Emergency update"
        message={error}
        onDismiss={() => setError('')}
      />

      <MotionView delay={160}>
        <Pressable
          style={styles.detailsToggle}
          onPress={() => setShowDetails((value) => !value)}
        >
          <Text style={styles.detailsToggleText}>
            {showDetails
              ? 'Hide emergency details'
              : 'View emergency details'}
          </Text>
        </Pressable>
      </MotionView>

      {showDetails && (
        <MotionView delay={20}>
          <View style={styles.detailsCard}>
            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>
                  Session
                </Text>

                <Text style={styles.metricValue}>
                  {activeSession.sessionId.slice(0, 8)}
                </Text>
              </View>

              <View style={styles.metric}>
                <Text style={styles.metricLabel}>
                  Location samples
                </Text>

                <Text style={styles.metricValue}>
                  {locationCount}
                </Text>
              </View>

              <View style={styles.metric}>
                <Text style={styles.metricLabel}>
                  Accuracy
                </Text>

                <Text style={styles.metricValue}>
                  {formattedAccuracy}
                </Text>
              </View>
            </View>

            <View style={styles.timerBlock}>
              <Text style={styles.metricLabel}>
                Emergency duration
              </Text>

              <SessionTimer
                startedAt={activeSession.startedAt}
                style={styles.timer}
              />
            </View>

            <View style={styles.mapWrap}>
              <LiveMap
                locations={emergencyLocations}
                statusLabel="Live location"
                detailLabel={
                  syncing
                    ? 'Updating your emergency location'
                    : 'Location tracking is active'
                }
              />
            </View>

            <Text style={styles.detailsNote}>
              {syncing
                ? 'Synchronising emergency status and location...'
                : latestLocation
                  ? `Last location update: ${new Date(
                      latestLocation.recordedAt ||
                        latestLocation.createdAt ||
                        Date.now(),
                    ).toLocaleTimeString()}`
                  : 'Waiting for the first location update.'}
            </Text>

            {activeSession.detectionSummary?.length ? (
              <Text style={styles.detailsNote}>
                {activeSession.detectionSummary[0]}
              </Text>
            ) : null}
          </View>
        </MotionView>
      )}

      <View style={styles.backgroundStatus}>
        <View style={styles.backgroundStatusDot} />

        <Text style={styles.backgroundStatusText}>
          Sentinel will continue emergency tracking while you use
          your phone.
        </Text>
      </View>
    </ScrollView>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: 'transparent',
    },

    content: {
      padding: 16,
      paddingBottom: 32,
    },

    emptyState: {
      flex: 1,
      padding: 24,
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },

    emptyTitle: {
      color: theme.colors.text,
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 8,
    },

    emptyText: {
      color: theme.colors.muted,
      lineHeight: 20,
    },

    discreetHeader: {
      minHeight: 66,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },

    statusGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },

    statusIndicator: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },

    statusPulse: {
      position: 'absolute',
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: theme.colors.red,
    },

    statusDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: theme.colors.red,
    },

    statusTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '800',
    },

    statusSubtitle: {
      color: theme.colors.muted,
      fontSize: 12,
      marginTop: 2,
    },

    stageBadge: {
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      maxWidth: 110,
    },

    stageBadgeText: {
      color: theme.colors.text,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      textAlign: 'center',
    },

    controlCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: 16,
      marginBottom: 12,
    },

    controlTitle: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '800',
    },

    controlDescription: {
      color: theme.colors.muted,
      marginTop: 6,
      lineHeight: 19,
      marginBottom: 16,
    },

    stageList: {
      gap: 8,
    },

    stageOption: {
      minHeight: 68,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      paddingHorizontal: 13,
      paddingVertical: 11,
      flexDirection: 'row',
      alignItems: 'center',
    },

    stageOptionSelected: {
      borderColor: theme.colors.red,
      backgroundColor: theme.gradients.emergency[0],
    },

    stageOptionCopy: {
      flex: 1,
      paddingRight: 8,
    },

    stageOptionTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '800',
    },

    stageOptionDescription: {
      color: theme.colors.muted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 3,
    },

    selectedIndicator: {
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: theme.colors.red,
    },

    selectedIndicatorText: {
      color: theme.colors.red,
      fontSize: 9,
      fontWeight: '800',
    },

    safeButton: {
      minHeight: 52,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      backgroundColor: theme.colors.background,
      marginTop: 12,
    },

    safeButtonText: {
      color: theme.colors.text,
      fontWeight: '700',
    },

    detailsToggle: {
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },

    detailsToggleText: {
      color: theme.colors.muted,
      fontSize: 13,
      fontWeight: '700',
    },

    detailsCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: 14,
      marginBottom: 12,
    },

    metricsRow: {
      flexDirection: 'row',
      gap: 8,
    },

    metric: {
      flex: 1,
      minWidth: 0,
    },

    metricLabel: {
      color: theme.colors.muted,
      fontSize: 10,
      marginBottom: 5,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    metricValue: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '800',
    },

    timerBlock: {
      marginTop: 18,
    },

    timer: {
      color: theme.colors.red,
      fontSize: 28,
      fontWeight: '800',
      marginTop: 4,
    },

    mapWrap: {
      height: 260,
      borderRadius: 10,
      overflow: 'hidden',
      marginTop: 16,
    },

    detailsNote: {
      color: theme.colors.muted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 10,
    },

    backgroundStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 4,
      marginTop: 4,
    },

    backgroundStatusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: theme.colors.red,
      marginRight: 8,
    },

    backgroundStatusText: {
      flex: 1,
      color: theme.colors.muted,
      fontSize: 11,
      lineHeight: 16,
    },
  });
