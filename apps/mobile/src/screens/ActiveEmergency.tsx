import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LiveMap } from '../components/LiveMap';
import { MotionView } from '../components/MotionView';
import { useAppStore } from '../store/useAppStore';
import { useAppTheme } from '../theme';
import { ApiError } from '../services/api';
import { cancelAlert } from '../services/alerts';
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
  } = useAppStore((state) => ({
    activeSession: state.activeSession,
    emergencyLocations: state.emergencyLocations,
    lastKnownLocation: state.lastKnownLocation,
    appendEmergencyLocations: state.appendEmergencyLocations,
    clearEmergencySession: state.clearEmergencySession,
    setLastKnownLocation: state.setLastKnownLocation,
  }));
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [syncing, setSyncing] = useState(true);
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
      onStatus: (status) => {
        if (status && status !== 'active') {
          clearEmergencySession();
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
  ]);

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
                <Text style={styles.alertBadgeText}>SOS BROADCAST</Text>
              </View>
              <Text style={styles.title}>Emergency Active</Text>
              <Text style={styles.subTitle}>Session {activeSession.sessionId.slice(0, 8)}</Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{activeSession.triggerSource || 'panic'}</Text>
            </View>
          </View>

          <SessionTimer startedAt={activeSession.startedAt} style={styles.timer} />
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
          detailLabel={syncing ? 'Syncing session feed' : 'Emergency route visible to your trusted circle'}
        />
      </MotionView>

      <Text style={styles.note}>
        {syncing
          ? 'Syncing session state and location feed...'
          : latestLocation
            ? `Latest update at ${new Date(
                latestLocation.recordedAt || latestLocation.createdAt || Date.now(),
              ).toLocaleTimeString()}`
            : 'Waiting for the first location update.'}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={[styles.cancel, cancelling && styles.cancelDisabled]} onPress={handleCancel} disabled={cancelling}>
        {cancelling ? <ActivityIndicator color={theme.colors.text} /> : <Text style={styles.cancelText}>Cancel Alert</Text>}
      </Pressable>
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
    cancelText: {
      color: theme.colors.text,
      fontWeight: '700',
    },
  });
