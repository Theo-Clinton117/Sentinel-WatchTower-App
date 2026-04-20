import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { shallow } from 'zustand/shallow';
import { LiveMap } from '../components/LiveMap';
import { MotionView } from '../components/MotionView';
import { AppIcon } from '../components/AppIcon';
import { useAppStore } from '../store/useAppStore';
import { ApiError } from '../services/api';
import { createAlert } from '../services/alerts';
import { evaluateGuardianRisk } from '../services/guardian';
import {
  getCoordinateDistanceMeters,
  getCurrentLocation,
  getReadableLocationLabel,
  startForegroundTracking,
} from '../services/location';
import { getAppPermissionSnapshot } from '../services/permissions';
import { listRiskZones } from '../services/risk-zones';
import { getActiveSession } from '../services/sessions';
import { useAppTheme } from '../theme';

const ORANGE = '#F19A3E';

export const HomeScreen = () => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {
    activeSession,
    activeWatchSession,
    authStatus,
    emergencyLocations,
    lastKnownLocation,
    openSidebar,
    sessionStatus,
    setActiveSession,
    setLastKnownLocation,
    user,
  } = useAppStore(
    (state) => ({
      activeSession: state.activeSession,
      activeWatchSession: state.activeWatchSession,
      authStatus: state.authStatus,
      emergencyLocations: state.emergencyLocations,
      lastKnownLocation: state.lastKnownLocation,
      openSidebar: state.openSidebar,
      sessionStatus: state.sessionStatus,
      setActiveSession: state.setActiveSession,
      setLastKnownLocation: state.setLastKnownLocation,
      user: state.user,
    }),
    shallow,
  );
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [locationBannerText, setLocationBannerText] = useState(
    'Live location: finding your address...',
  );
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const lastResolvedLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let active = true;
    let subscription: Awaited<ReturnType<typeof startForegroundTracking>> | null = null;

    const beginLiveTracking = async () => {
      try {
        setLocationPermissionDenied(false);
        const currentLocation = await getCurrentLocation();
        if (!active) {
          return;
        }

        setLastKnownLocation(currentLocation);
        subscription = await startForegroundTracking();
        if (!active) {
          subscription?.remove();
        }
      } catch {
        if (active) {
          setLocationPermissionDenied(true);
        }
      }
    };

    void beginLiveTracking();

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [setLastKnownLocation]);

  useEffect(() => {
    let active = true;

    const syncSession = async () => {
      if (authStatus !== 'authenticated' || sessionStatus === 'active' || activeSession) {
        return;
      }

      try {
        setSyncing(true);
        const session = await getActiveSession();
        if (active && session) {
          setActiveSession(session);
        }
      } catch {
        if (active) {
          setError('');
        }
      } finally {
        if (active) {
          setSyncing(false);
        }
      }
    };

    void syncSession();

    return () => {
      active = false;
    };
  }, [activeSession, authStatus, sessionStatus, setActiveSession]);

  useEffect(() => {
    let active = true;

    const runGuardianCheck = async () => {
      if (
        authStatus !== 'authenticated' ||
        activeSession ||
        sessionStatus === 'active' ||
        sessionStatus === 'soft_alert'
      ) {
        return;
      }

      try {
        const permissions = await getAppPermissionSnapshot();
        if (!permissions.foregroundLocation.granted) {
          return;
        }

        const [riskZones, location] = await Promise.all([
          listRiskZones(),
          getCurrentLocation(),
        ]);
        const assessment = evaluateGuardianRisk(location, riskZones, activeWatchSession);

        if (!active || assessment.stage !== 'soft_alert') {
          return;
        }

        const alert = await createAlert({
          triggerSource: 'passive_detection',
          stage: 'soft_alert',
          riskScore: assessment.riskScore,
          riskSnapshot: assessment.snapshot,
          detectionSummary: assessment.summary,
          cancelWindowSeconds: 10,
        });

        if (!active) {
          return;
        }

        setActiveSession({
          alertId: alert.alertId,
          sessionId: alert.sessionId,
          status: alert.status,
          triggerSource: alert.triggerSource,
          startedAt: alert.startedAt || new Date().toISOString(),
          alertStage: alert.alertStage,
          escalationLevel: alert.escalationLevel,
          alertStatus: alert.alertStatus,
          riskScore: alert.riskScore ?? assessment.riskScore,
          cancelExpiresAt: alert.cancelExpiresAt,
          riskSnapshot: alert.riskSnapshot ?? assessment.snapshot,
          detectionSummary: alert.detectionSummary ?? assessment.summary,
        });
      } catch {
        // Keep the map surface quiet during passive checks.
      }
    };

    void runGuardianCheck();

    return () => {
      active = false;
    };
  }, [activeSession, activeWatchSession, authStatus, sessionStatus, setActiveSession]);

  useEffect(() => {
    if (!lastKnownLocation) {
      setLocationBannerText(
        locationPermissionDenied
          ? 'Live location unavailable. Enable location access to show it here.'
          : 'Live location: finding your address...',
      );
      return;
    }

    const currentCoordinates = {
      lat: lastKnownLocation.lat,
      lng: lastKnownLocation.lng,
    };
    const loadingLabel = 'Live location: finding your address...';
    const unavailableLabel = 'Live location: address unavailable right now.';
    const lastResolvedLocation = lastResolvedLocationRef.current;
    const shouldRefreshLabel =
      !lastResolvedLocation ||
      getCoordinateDistanceMeters(lastResolvedLocation, currentCoordinates) >= 80;

    if (!shouldRefreshLabel) {
      return;
    }

    let active = true;
    lastResolvedLocationRef.current = currentCoordinates;
    setLocationBannerText(loadingLabel);

    const resolveReadableLocation = async () => {
      try {
        const readableLocation = await getReadableLocationLabel(currentCoordinates);
        if (active) {
          setLocationBannerText(
            readableLocation
              ? `Live location: ${readableLocation}`
              : unavailableLabel,
          );
        }
      } catch {
        if (active) {
          setLocationBannerText(unavailableLabel);
        }
      }
    };

    void resolveReadableLocation();

    return () => {
      active = false;
    };
  }, [lastKnownLocation, locationPermissionDenied]);

  const handleStartEmergency = async () => {
    try {
      setLoading(true);
      setError('');
      const alert = await createAlert('panic');
      setActiveSession({
        alertId: alert.alertId,
        sessionId: alert.sessionId,
        status: alert.status,
        triggerSource: alert.triggerSource,
        startedAt: alert.startedAt || new Date().toISOString(),
        alertStage: alert.alertStage,
        escalationLevel: alert.escalationLevel,
        alertStatus: alert.alertStatus,
        riskScore: alert.riskScore ?? 100,
        cancelExpiresAt: alert.cancelExpiresAt,
        riskSnapshot: alert.riskSnapshot ?? {},
        detectionSummary: alert.detectionSummary ?? [],
      });
    } catch (requestError) {
      const message =
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not start the emergency alert right now.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const mapLat =
    lastKnownLocation?.lat ??
    emergencyLocations[emergencyLocations.length - 1]?.lat ??
    6.5244;
  const mapLng =
    lastKnownLocation?.lng ??
    emergencyLocations[emergencyLocations.length - 1]?.lng ??
    3.3792;
  const markerLabel = (user?.name || activeWatchSession?.contactName || 'S')
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <View style={styles.container}>
      <LiveMap
        variant="minimal"
        markerLabel={markerLabel}
        markerColor={ORANGE}
        lat={mapLat}
        lng={mapLng}
        locations={emergencyLocations}
        detailLabel="Tracking active"
      />

      <Pressable
        onPress={openSidebar}
        style={({ pressed }) => [styles.settingsButton, pressed && styles.settingsButtonPressed]}
      >
        <AppIcon name="settings" color="#FFFFFF" />
      </Pressable>

      <MotionView delay={20} style={[styles.locationStrip, theme.shadow.card]}>
        <Text numberOfLines={1} style={styles.locationStripText}>
          {locationBannerText}
        </Text>
      </MotionView>

      {syncing ? (
        <MotionView delay={40} style={styles.statusWrap}>
          <Text style={styles.statusText}>Refreshing session...</Text>
        </MotionView>
      ) : null}

      {error ? (
        <MotionView delay={40} style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
        </MotionView>
      ) : null}

      <MotionView delay={80} style={styles.sosWrap}>
        <Pressable
          onPress={() => setError('Hold the SOS button to confirm the emergency alert.')}
          onLongPress={handleStartEmergency}
          delayLongPress={260}
          disabled={loading}
          style={({ pressed }) => [
            styles.sosButton,
            pressed && !loading && styles.sosButtonPressed,
            loading && styles.sosButtonDisabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.sosButtonText}>SOS</Text>
          )}
        </Pressable>
        <Text style={styles.sosHint}>Hold to trigger emergency alert</Text>
      </MotionView>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      overflow: 'hidden',
      backgroundColor: theme.colors.background,
    },
    statusWrap: {
      position: 'absolute',
      top: 84,
      alignSelf: 'center',
    },
    statusText: {
      color: theme.colors.blue,
      fontSize: 13,
      fontWeight: '700',
      textShadowColor: 'rgba(255,255,255,0.92)',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 8,
    },
    errorWrap: {
      position: 'absolute',
      left: 24,
      right: 24,
      bottom: 132,
      alignItems: 'center',
    },
    errorText: {
      color: '#A63A4A',
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
      textShadowColor: 'rgba(255,255,255,0.96)',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 10,
    },
    sosWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 26,
      alignItems: 'center',
      gap: 10,
    },
    sosButton: {
      minWidth: 124,
      height: 58,
      paddingHorizontal: 28,
      borderRadius: 29,
      backgroundColor: theme.colors.blue,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.blue,
      shadowOpacity: 0.28,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 14,
    },
    sosButtonPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.98 }],
    },
    sosButtonDisabled: {
      opacity: 0.8,
    },
    sosButtonText: {
      color: '#FFFFFF',
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: 0.4,
    },
    sosHint: {
      color: theme.colors.muted,
      fontSize: 12,
      fontWeight: '700',
      textShadowColor: 'rgba(255,255,255,0.96)',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 8,
    },
    settingsButton: {
      position: 'absolute',
      top: 18,
      left: 16,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.blue,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.blue,
      shadowOpacity: 0.28,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 14,
      zIndex: 10,
    },
    settingsButtonPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.98 }],
    },
    locationStrip: {
      position: 'absolute',
      top: 18,
      left: 84,
      right: 18,
      minHeight: 56,
      paddingHorizontal: 18,
      borderRadius: 999,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: 'center',
      zIndex: 9,
    },
    locationStripText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
  });
