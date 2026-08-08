import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { shallow } from 'zustand/shallow';
import { LiveMap } from '../components/LiveMap';
import { MotionView } from '../components/MotionView';
import { AppIcon } from '../components/AppIcon';
import { useAppStore } from '../store/useAppStore';
import type { Screen } from '../store/useAppStore';
import { ApiError } from '../services/api';
import { createAlert } from '../services/alerts';
import { evaluateGuardianRisk } from '../services/guardian';
import {
  getCoordinateDistanceMeters,
  getCurrentLocation,
  getReadableLocationLabel,
  startForegroundTracking,
} from '../services/location';
import { requestAppPermissions } from '../services/permissions';
import {
  buildNearbySafetyMeshContext,
  syncNearbySafetyMeshSignals,
} from '../services/nearby-safety-mesh';
import { getAppPermissionSnapshot } from '../services/permissions';
import { listRiskZones } from '../services/risk-zones';
import { getActiveSession } from '../services/sessions';
import { useAppTheme } from '../theme';

const ORANGE = '#F19A3E';
const PASSIVE_GUARDIAN_CHECK_INTERVAL_MS = 60_000;
const PASSIVE_GUARDIAN_CHECK_DISTANCE_M = 120;

export const HomeScreen = () => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {
    activeSession,
    activeWatchSession,
    authStatus,
    emergencyLocations,
    lastKnownLocation,
    nearbySafetyMeshEnabled,
    openSidebar,
    sessionStatus,
    setActiveSession,
    setLastKnownLocation,
    setNearbySafetyMeshEnabled,
    setScreen,
    user,
  } = useAppStore(
    (state) => ({
      activeSession: state.activeSession,
      activeWatchSession: state.activeWatchSession,
      authStatus: state.authStatus,
      emergencyLocations: state.emergencyLocations,
      lastKnownLocation: state.lastKnownLocation,
      nearbySafetyMeshEnabled: state.nearbySafetyMeshEnabled,
      openSidebar: state.openSidebar,
      sessionStatus: state.sessionStatus,
      setActiveSession: state.setActiveSession,
      setLastKnownLocation: state.setLastKnownLocation,
      setNearbySafetyMeshEnabled: state.setNearbySafetyMeshEnabled,
      setScreen: state.setScreen,
      user: state.user,
    }),
    shallow,
  );
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [holdPrompt, setHoldPrompt] = useState('');
  const [mapLayer, setMapLayer] = useState<'street' | 'satellite'>('street');
  const [mapRefreshKey, setMapRefreshKey] = useState(0);
  const sosHoldProgress = useRef(new Animated.Value(0)).current;
  const [locationBannerText, setLocationBannerText] = useState(
    'Live location: finding your address...',
  );
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const lastResolvedLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastGuardianCheckRef = useRef<{ checkedAtMs: number; lat: number; lng: number } | null>(null);

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
        const knownLocation = lastKnownLocation;
        const nowMs = Date.now();
        const lastCheck = lastGuardianCheckRef.current;

        if (knownLocation && lastCheck) {
          const movedSinceLastCheck =
            getCoordinateDistanceMeters(lastCheck, knownLocation) >=
            PASSIVE_GUARDIAN_CHECK_DISTANCE_M;
          const checkIsFresh =
            nowMs - lastCheck.checkedAtMs < PASSIVE_GUARDIAN_CHECK_INTERVAL_MS;

          if (checkIsFresh && !movedSinceLastCheck) {
            return;
          }
        }

        const permissions = await getAppPermissionSnapshot();
        if (!permissions.foregroundLocation.granted) {
          return;
        }

        const location = knownLocation ?? (await getCurrentLocation());
        const movedSinceLastCheck = lastCheck
          ? getCoordinateDistanceMeters(lastCheck, location) >= PASSIVE_GUARDIAN_CHECK_DISTANCE_M
          : true;
        const checkIsFresh = lastCheck
          ? nowMs - lastCheck.checkedAtMs < PASSIVE_GUARDIAN_CHECK_INTERVAL_MS
          : false;

        if (checkIsFresh && !movedSinceLastCheck) {
          return;
        }

        lastGuardianCheckRef.current = {
          checkedAtMs: nowMs,
          lat: location.lat,
          lng: location.lng,
        };

        const riskZones = await listRiskZones();
        await syncNearbySafetyMeshSignals({
          enabled: nearbySafetyMeshEnabled,
          currentLocation: location,
          recentLocations: emergencyLocations,
          nowMs,
        });
        const nearbySafetyMesh = buildNearbySafetyMeshContext({
          enabled: nearbySafetyMeshEnabled,
          currentLocation: location,
          recentLocations: emergencyLocations,
          nowMs,
        });
        const assessment = evaluateGuardianRisk(
          location,
          riskZones,
          activeWatchSession,
          nearbySafetyMesh,
        );

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
  }, [
    activeSession,
    activeWatchSession,
    authStatus,
    emergencyLocations,
    lastKnownLocation,
    nearbySafetyMeshEnabled,
    sessionStatus,
    setActiveSession,
  ]);

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

  const handleStartEmergency = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setHoldPrompt('');
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
  }, [setActiveSession]);

  const handleSosPressIn = useCallback(() => {
    setError('');
    setHoldPrompt('Keep holding SOS to send an emergency alert.');
    sosHoldProgress.stopAnimation();
    sosHoldProgress.setValue(0);
    Animated.timing(sosHoldProgress, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [sosHoldProgress]);

  const handleSosPressOut = useCallback(() => {
    if (loading) {
      return;
    }

    Animated.timing(sosHoldProgress, {
      toValue: 0,
      duration: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [loading, sosHoldProgress]);

  const handleEnableLocation = useCallback(async () => {
    try {
      setError('');
      setLocationPermissionDenied(false);
      await requestAppPermissions();
      const currentLocation = await getCurrentLocation();
      setLastKnownLocation(currentLocation);
    } catch {
      setLocationPermissionDenied(true);
      setError('Location is still unavailable. Check app permissions in your phone settings.');
      void Linking.openSettings().catch(() => undefined);
    }
  }, [setLastKnownLocation]);

  const handleRecenterMap = useCallback(() => {
    setMapRefreshKey((value) => value + 1);
  }, []);

  const handleToggleMapLayer = useCallback(() => {
    setMapLayer((value) => (value === 'street' ? 'satellite' : 'street'));
  }, []);

  const handleToggleMesh = useCallback(() => {
    setNearbySafetyMeshEnabled(!nearbySafetyMeshEnabled);
  }, [nearbySafetyMeshEnabled, setNearbySafetyMeshEnabled]);

  const quickActions = useMemo<Array<{
    key: Screen;
    label: string;
    meta: string;
    icon: 'watch' | 'contacts' | 'layers' | 'profile';
  }>>(
    () => [
      {
        key: 'contacts',
        label: 'Watch',
        meta: activeWatchSession ? 'Active' : 'Start',
        icon: 'watch',
      },
      {
        key: 'contacts',
        label: 'Circle',
        meta: 'People',
        icon: 'contacts',
      },
      {
        key: 'risk-log',
        label: 'History',
        meta: 'Review',
        icon: 'layers',
      },
    ],
    [activeWatchSession],
  );

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
  const locationStatusLabel = locationPermissionDenied
    ? 'Location off'
    : lastKnownLocation
      ? 'Live location'
      : 'Finding location';
  const locationStatusTone = locationPermissionDenied
    ? styles.statusPillWarning
    : lastKnownLocation
      ? styles.statusPillReady
      : styles.statusPillNeutral;
  const watchStatusText = activeWatchSession
    ? `Watching with ${activeWatchSession.contactName}`
    : 'No watch session';
  const watchMetaText = activeWatchSession
    ? `Ends ${new Date(activeWatchSession.endsAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : 'Ask a trusted contact to follow your route.';
  const sosProgressTranslateX = sosHoldProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-43, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <LiveMap
        key={`${mapRefreshKey}:${mapLayer}`}
        variant="minimal"
        markerLabel={markerLabel}
        markerColor={ORANGE}
        lat={mapLat}
        lng={mapLng}
        locations={emergencyLocations}
        detailLabel="Tracking active"
        mapLayer={mapLayer}
      />

      <Pressable
        onPress={openSidebar}
        style={({ pressed }) => [styles.settingsButton, pressed && styles.settingsButtonPressed]}
        accessibilityRole="button"
        accessibilityLabel="Open side menu"
      >
        <AppIcon name="settings" color="#FFFFFF" />
      </Pressable>

      <MotionView delay={35} style={[styles.mapControlWrap, theme.shadow.card]}>
        <Pressable
          onPress={handleRecenterMap}
          style={({ pressed }) => [styles.mapControlButton, pressed && styles.mapControlPressed]}
          accessibilityRole="button"
          accessibilityLabel="Recenter map"
          accessibilityHint="Moves the map back to your latest known location."
        >
          <AppIcon name="location" color={theme.colors.text} active />
        </Pressable>
        <View style={styles.mapControlDivider} />
        <Pressable
          onPress={handleToggleMapLayer}
          style={({ pressed }) => [styles.mapControlButton, pressed && styles.mapControlPressed]}
          accessibilityRole="button"
          accessibilityLabel="Toggle map layer"
          accessibilityHint={`Switches to ${mapLayer === 'street' ? 'satellite' : 'street'} map view.`}
        >
          <AppIcon name="layers" color={theme.colors.text} active />
        </Pressable>
      </MotionView>

      <MotionView delay={20} style={[styles.locationStrip, theme.shadow.card]}>
        <View style={[styles.statusPill, locationStatusTone]}>
          <Text style={styles.statusPillText}>{locationStatusLabel}</Text>
        </View>
        <Text style={styles.locationStripText}>
          {locationBannerText}
        </Text>
        {locationPermissionDenied ? (
          <Pressable
            onPress={handleEnableLocation}
            style={({ pressed }) => [styles.locationAction, pressed && styles.locationActionPressed]}
            accessibilityRole="button"
            accessibilityLabel="Enable location access"
          >
            <Text style={styles.locationActionText}>Enable</Text>
          </Pressable>
        ) : null}
      </MotionView>

      {syncing ? (
        <MotionView delay={40} style={[styles.syncWrap, theme.shadow.card]}>
          <ActivityIndicator color={theme.colors.blue} size="small" />
          <Text style={styles.syncText}>Refreshing session</Text>
        </MotionView>
      ) : null}

      {error ? (
        <MotionView delay={40} style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
        </MotionView>
      ) : null}

      <MotionView
        delay={80}
        style={
          nearbySafetyMeshEnabled
            ? [styles.controlPanel, theme.shadow.card]
            : [styles.controlPanel, styles.controlPanelCompact, theme.shadow.card]
        }
      >
        {nearbySafetyMeshEnabled ? (
          <View style={styles.panelHeader}>
            <View style={styles.panelCopy}>
              <Text style={styles.panelEyebrow}>Ready when you need help</Text>
              <Text style={styles.panelTitle}>{watchStatusText}</Text>
              <Text style={styles.panelMeta}>{watchMetaText}</Text>
            </View>
            <Pressable
              onPress={handleToggleMesh}
              style={({ pressed }) => [styles.guardianBadge, pressed && styles.guardianBadgePressed]}
              accessibilityRole="switch"
              accessibilityLabel="Safety mesh panel"
              accessibilityState={{ checked: nearbySafetyMeshEnabled }}
            >
              <Text style={styles.guardianBadgeText}>Mesh on</Text>
            </Pressable>
          </View>
        ) : null}

        {nearbySafetyMeshEnabled ? (
          <View style={styles.quickActionRow}>
            {quickActions.map((action) => (
              <Pressable
                key={`${action.key}:${action.label}`}
                onPress={() => setScreen(action.key)}
                accessibilityRole="button"
                accessibilityLabel={`${action.label}: ${action.meta}`}
                style={({ pressed }) => [
                  styles.quickAction,
                  pressed && styles.quickActionPressed,
                ]}
              >
                <View style={styles.quickIcon}>
                  <AppIcon name={action.icon} color={theme.colors.blue} active />
                </View>
                <Text style={styles.quickLabel}>{action.label}</Text>
                <Text style={styles.quickMeta}>{action.meta}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={[styles.sosRow, !nearbySafetyMeshEnabled && styles.sosRowCompact]}>
          {nearbySafetyMeshEnabled ? (
            <View style={styles.sosCopy}>
              <Text style={styles.sosTitle}>Emergency alert</Text>
              <Text style={styles.sosHint}>
                {holdPrompt || 'Press and hold to notify your emergency network.'}
              </Text>
            </View>
          ) : null}
          <Pressable
            onPressIn={handleSosPressIn}
            onPressOut={handleSosPressOut}
            onLongPress={handleStartEmergency}
            delayLongPress={320}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="SOS emergency alert"
            accessibilityHint="Press and hold to notify your emergency network."
            style={({ pressed }) => [
              styles.sosButton,
              !nearbySafetyMeshEnabled && styles.sosButtonCompact,
              pressed && !loading && styles.sosButtonPressed,
              loading && styles.sosButtonDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.sosButtonText}>SOS</Text>
            )}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.sosProgress,
                {
                  transform: [
                    { translateX: sosProgressTranslateX },
                    { scaleX: sosHoldProgress },
                  ],
                },
              ]}
            />
          </Pressable>
          {!nearbySafetyMeshEnabled ? (
            <Pressable
              onPress={handleToggleMesh}
              style={({ pressed }) => [styles.meshRestoreButton, pressed && styles.meshRestorePressed]}
              accessibilityRole="switch"
              accessibilityLabel="Safety mesh panel"
              accessibilityState={{ checked: nearbySafetyMeshEnabled }}
            >
              <AppIcon name="layers" color={theme.colors.blue} active />
              <Text style={styles.meshRestoreText}>Show mesh panel</Text>
            </Pressable>
          ) : null}
        </View>
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
    syncWrap: {
      position: 'absolute',
      top: 84,
      alignSelf: 'center',
      minHeight: 38,
      paddingHorizontal: 14,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    syncText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    errorWrap: {
      position: 'absolute',
      left: 24,
      right: 24,
      bottom: 280,
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
    controlPanel: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 18,
      padding: 14,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 14,
      alignItems: 'stretch',
    },
    controlPanelCompact: {
      left: 0,
      right: 0,
      bottom: 16,
      padding: 0,
      backgroundColor: 'transparent',
      borderWidth: 0,
      alignItems: 'center',
    },
    panelHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    panelCopy: {
      flex: 1,
      minWidth: 0,
    },
    panelEyebrow: {
      color: theme.colors.blue,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      marginBottom: 5,
    },
    panelTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 23,
    },
    panelMeta: {
      color: theme.colors.muted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 4,
    },
    guardianBadge: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: theme.colors.backgroundElevated,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    guardianBadgePressed: {
      opacity: 0.84,
      transform: [{ scale: 0.98 }],
    },
    guardianBadgeText: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '800',
    },
    quickActionRow: {
      flexDirection: 'row',
      gap: 8,
    },
    quickAction: {
      flex: 1,
      minHeight: 74,
      borderRadius: 8,
      backgroundColor: theme.colors.backgroundElevated,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 10,
      justifyContent: 'center',
    },
    quickActionPressed: {
      opacity: 0.86,
      transform: [{ scale: 0.98 }],
    },
    quickIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.blueSoft,
      marginBottom: 7,
    },
    quickLabel: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 17,
    },
    quickMeta: {
      color: theme.colors.muted,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
      marginTop: 1,
    },
    sosRow: {
      minHeight: 72,
      padding: 10,
      borderRadius: 8,
      backgroundColor: theme.isDark ? 'rgba(255, 107, 130, 0.1)' : '#FFF1F4',
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255, 107, 130, 0.28)' : '#FFC8D3',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    sosRowCompact: {
      minHeight: 116,
      padding: 0,
      backgroundColor: 'transparent',
      borderWidth: 0,
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 10,
    },
    sosCopy: {
      flex: 1,
      minWidth: 0,
    },
    sosTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 4,
    },
    sosButton: {
      width: 86,
      height: 58,
      borderRadius: 8,
      backgroundColor: theme.colors.red,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      shadowColor: theme.colors.red,
      shadowOpacity: 0.28,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 14,
    },
    sosButtonCompact: {
      width: 116,
      height: 66,
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
      zIndex: 1,
    },
    sosProgress: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 5,
      backgroundColor: 'rgba(255,255,255,0.72)',
    },
    sosHint: {
      color: theme.colors.muted,
      fontSize: 12,
      lineHeight: 17,
      flexShrink: 1,
    },
    settingsButton: {
      position: 'absolute',
      top: 18,
      left: 16,
      width: 56,
      height: 56,
      borderRadius: 8,
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
    mapControlWrap: {
      position: 'absolute',
      top: 86,
      right: 18,
      width: 50,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      zIndex: 10,
    },
    mapControlButton: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    mapControlPressed: {
      backgroundColor: theme.colors.blueSoft,
    },
    mapControlDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
    },
    meshRestoreButton: {
      minHeight: 38,
      paddingHorizontal: 12,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    meshRestorePressed: {
      backgroundColor: theme.colors.blueSoft,
    },
    meshRestoreText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '800',
    },
    locationStrip: {
      position: 'absolute',
      top: 18,
      left: 84,
      right: 18,
      minHeight: 56,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: 'center',
      zIndex: 9,
    },
    statusPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      marginBottom: 6,
    },
    statusPillReady: {
      backgroundColor: theme.isDark ? 'rgba(67,201,139,0.18)' : '#E6F7EF',
    },
    statusPillWarning: {
      backgroundColor: theme.isDark ? 'rgba(255,107,130,0.18)' : '#FFE9ED',
    },
    statusPillNeutral: {
      backgroundColor: theme.colors.blueSoft,
    },
    statusPillText: {
      color: theme.colors.text,
      fontSize: 10,
      fontWeight: '800',
      lineHeight: 13,
    },
    locationStripText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
      flexShrink: 1,
    },
    locationAction: {
      alignSelf: 'flex-start',
      minHeight: 32,
      paddingHorizontal: 11,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.blue,
      marginTop: 8,
    },
    locationActionPressed: {
      opacity: 0.86,
      transform: [{ scale: 0.98 }],
    },
    locationActionText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '800',
    },
  });
