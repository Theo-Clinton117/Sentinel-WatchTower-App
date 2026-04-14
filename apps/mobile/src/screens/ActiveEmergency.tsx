import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import { listSessionLocations } from '../services/sessions';
import { connectSessionSocket, disconnectSessionSocket } from '../services/websocket';

const SessionTimer = React.memo(
  ({ startedAt, style }: { startedAt?: string | null; style: { color: string; fontSize: number; fontWeight: '800'; marginTop: number } }) => {
    const [duration, setDuration] = useState('00:00');

    useEffect(() => {
      const updateDuration = () => {
        const start = startedAt ? new Date(startedAt).getTime() : Date.now();
        const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
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
  const styles = createStyles(theme);
  const {
    activeSession,
    emergencyLocations,
    lastKnownLocation,
    appendEmergencyLocations,
    clearEmergencySession,
    setLastKnownLocation,
    updateActiveSession,
  } = useAppStore((state) => ({
    activeSession: state.activeSession,
    emergencyLocations: state.emergencyLocations,
    lastKnownLocation: state.lastKnownLocation,
    appendEmergencyLocations: state.appendEmergencyLocations,
    clearEmergencySession: state.clearEmergencySession,
    setLastKnownLocation: state.setLastKnownLocation,
    updateActiveSession: state.updateActiveSession,
  }));
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [syncing, setSyncing] = useState(true);
  const [countdown, setCountdown] = useState('');
  const alertPulse = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(alertPulse, {
          toValue: 1,
          duration: 1300,
          useNativeDriver: true,
        }),
        Animated.timing(alertPulse, {
          toValue: 0,
          duration: 1300,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [alertPulse]);

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
              : 'Live session sync is degraded. We will keep trying to update your emergency state.';
          setError(message);
        }
      } finally {
        if (mounted) {
          setSyncing(false);
        }
      }
    };

    connectSessionSocket(activeSession.sessionId, {
      onLocationUpdate: (locations) => appendEmergencyLocations(locations),
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
            cancelExpiresAt: stage === 'soft_alert' ? activeSession.cancelExpiresAt : null,
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
    if (activeSession?.alertStage !== 'soft_alert' || !activeSession?.cancelExpiresAt) {
      setCountdown('');
      return;
    }

    let completed = false;
    const updateCountdown = () => {
      const remainingMs = new Date(activeSession.cancelExpiresAt || Date.now()).getTime() - Date.now();
      if (remainingMs <= 0) {
        setCountdown('00:00');
        if (!completed) {
          completed = true;
          void handleEscalate('high_alert');
        }
        return;
      }

      const totalSeconds = Math.ceil(remainingMs / 1000);
      const minutes = Math.floor(totalSeconds / 60)
        .toString()
        .padStart(2, '0');
      const seconds = (totalSeconds % 60).toString().padStart(2, '0');
      setCountdown(`${minutes}:${seconds}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 500);
    return () => clearInterval(interval);
  }, [activeSession?.alertStage, activeSession?.cancelExpiresAt]);

  const latestLocation = lastKnownLocation || (emergencyLocations.length > 0 ? emergencyLocations[emergencyLocations.length - 1] : null);
  const locationCount = emergencyLocations.length;
  const formattedAccuracy =
    typeof latestLocation?.accuracyM === 'number' ? `${Math.round(latestLocation.accuracyM)}m` : 'Unknown';

  const pulseStyle = {
    transform: [
      {
        scale: alertPulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.12],
        }),
      },
    ],
    opacity: alertPulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.36, 0.08],
    }),
  };

  const handleEscalate = async (stage: string) => {
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
        riskSnapshot: alert.riskSnapshot ?? activeSession.riskSnapshot ?? {},
        detectionSummary: alert.detectionSummary ?? activeSession.detectionSummary ?? [],
      });
    } catch (escalateError) {
      const message =
        escalateError instanceof ApiError
          ? escalateError.message
          : 'Could not escalate the alert right now.';
      setError(message);
    } finally {
      setEscalating(false);
    }
  };

  const handleCancel = async () => {
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
  };

  if (!activeSession?.sessionId) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Emergency Active</Text>
        <Text style={styles.note}>No live session is loaded yet.</Text>
      </View>
    );
  }

  const isSoftAlert = activeSession.alertStage === 'soft_alert';
  const stageLabel = (activeSession.alertStage || 'high_alert').replace('_', ' ').toUpperCase();
  const triggerLabel = activeSession.triggerSource || 'panic';
  const headerTitle = isSoftAlert ? 'Silent Verification' : 'Emergency Active';
  const headerBadge = isSoftAlert ? 'GUARDIAN VERIFYING' : 'SOS BROADCAST';
  const routeDetail = isSoftAlert
    ? syncing
      ? 'Verifying route context and waiting for the cancel window to close'
      : 'Trusted contacts will be pulled in if the verification window expires or risk rises'
    : syncing
      ? 'Syncing session feed'
      : 'Emergency route visible to your trusted circle';

  return (
    <View style={styles.container}>
      <MotionView delay={40} style={[styles.headerWrap, theme.shadow.card]}>
        <LinearGradient colors={theme.gradients.emergency} style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View>
              <View style={styles.alertBadgeRow}>
                <View style={styles.alertBadgeWrap}>
                  <Animated.View style={[styles.alertBadgePulse, pulseStyle]} />
                  <View style={styles.alertBadgeCore} />
                </View>
                <Text style={styles.alertBadgeText}>{headerBadge}</Text>
              </View>
              <Text style={styles.title}>{headerTitle}</Text>
              <Text style={styles.subTitle}>Session {activeSession.sessionId.slice(0, 8)}</Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{stageLabel}</Text>
            </View>
          </View>

          {isSoftAlert ? (
            <>
              <Text style={styles.softAlertTitle}>Cancel window</Text>
              <Text style={styles.timer}>{countdown || '00:10'}</Text>
              <Text style={styles.softAlertText}>
                Trigger source: {triggerLabel}. If you do nothing, Guardian promotes this to a high alert automatically.
              </Text>
            </>
          ) : (
            <SessionTimer startedAt={activeSession.startedAt} style={styles.timer} />
          )}
        </LinearGradient>
      </MotionView>

      <MotionView delay={120} style={styles.metricsRow}>
        <View style={[styles.metricCard, theme.shadow.card]}>
          <Text style={styles.metricLabel}>Location samples</Text>
          <Text style={styles.metricValue}>{locationCount}</Text>
        </View>
        <View style={[styles.metricCard, theme.shadow.card]}>
          <Text style={styles.metricLabel}>Latest accuracy</Text>
          <Text style={styles.metricValue}>{formattedAccuracy}</Text>
        </View>
      </MotionView>

      <MotionView delay={180} style={[styles.mapWrap, theme.shadow.card]}>
        <LiveMap
          locations={emergencyLocations}
          statusLabel="Live location"
          detailLabel={routeDetail}
        />
      </MotionView>

      <Text style={styles.note}>
        {isSoftAlert
          ? `Risk score ${activeSession.riskScore ?? 0}/100. ${activeSession.detectionSummary?.[0] || 'Guardian is validating multiple signals before broad escalation.'}`
          : syncing
          ? 'Syncing session state and location feed...'
          : latestLocation
            ? `Latest update at ${new Date(
                latestLocation.recordedAt || latestLocation.createdAt || Date.now(),
              ).toLocaleTimeString()}`
            : 'Waiting for the first location update.'}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isSoftAlert ? (
        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.secondaryAction, (escalating || cancelling) && styles.cancelDisabled]}
            onPress={() => handleEscalate('high_alert')}
            disabled={escalating || cancelling}
          >
            {escalating ? <ActivityIndicator color={theme.colors.text} /> : <Text style={styles.secondaryActionText}>Escalate Now</Text>}
          </Pressable>
          <Pressable
            style={[styles.cancel, styles.rowAction, cancelling && styles.cancelDisabled]}
            onPress={handleCancel}
            disabled={cancelling || escalating}
          >
            {cancelling ? <ActivityIndicator color={theme.colors.text} /> : <Text style={styles.cancelText}>I'm Safe</Text>}
          </Pressable>
        </View>
      ) : (
        <Pressable style={[styles.cancel, cancelling && styles.cancelDisabled]} onPress={handleCancel} disabled={cancelling}>
          {cancelling ? <ActivityIndicator color={theme.colors.text} /> : <Text style={styles.cancelText}>Cancel Alert</Text>}
        </Pressable>
      )}
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
    headerWrap: {
      borderRadius: 28,
      overflow: 'hidden',
      marginBottom: 12,
    },
    headerCard: {
      padding: 18,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    alertBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    alertBadgeWrap: {
      width: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    alertBadgePulse: {
      position: 'absolute',
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: theme.colors.red,
    },
    alertBadgeCore: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.red,
    },
    alertBadgeText: {
      color: theme.colors.red,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.2,
    },
    title: {
      color: theme.colors.text,
      fontSize: 24,
      fontWeight: '800',
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
    },
    subTitle: {
      color: theme.colors.muted,
      marginTop: 4,
    },
    statusPill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.red,
      backgroundColor: theme.gradients.emergency[0],
    },
    statusPillText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    softAlertTitle: {
      color: theme.colors.muted,
      marginTop: 16,
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      fontWeight: '700',
    },
    softAlertText: {
      color: theme.colors.text,
      marginTop: 8,
      lineHeight: 18,
    },
    timer: {
      color: theme.colors.red,
      fontSize: 42,
      fontWeight: '800',
      marginTop: 16,
    },
    metricsRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    metricCard: {
      flex: 1,
      padding: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    metricLabel: {
      color: theme.colors.muted,
      fontSize: 12,
      marginBottom: 8,
    },
    metricValue: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '700',
    },
    mapWrap: {
      flex: 1,
      marginBottom: 16,
      borderRadius: 24,
      overflow: 'hidden',
    },
    note: {
      color: theme.colors.muted,
      marginBottom: 12,
      lineHeight: 19,
    },
    error: {
      color: theme.colors.red,
      marginBottom: 12,
      lineHeight: 18,
    },
    cancel: {
      backgroundColor: theme.colors.red,
      padding: 16,
      borderRadius: 18,
      alignItems: 'center',
      minHeight: 56,
      justifyContent: 'center',
      ...theme.shadow.glow,
    },
    cancelDisabled: {
      opacity: 0.7,
    },
    rowAction: {
      flex: 1,
    },
    cancelText: {
      color: theme.colors.text,
      fontWeight: '700',
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    secondaryAction: {
      flex: 1,
      minHeight: 56,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      backgroundColor: theme.colors.surface,
    },
    secondaryActionText: {
      color: theme.colors.text,
      fontWeight: '700',
    },
  });
