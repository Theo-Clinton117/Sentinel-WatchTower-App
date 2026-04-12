import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HomeActionRail } from '../components/HomeActionRail';
import { LiveMap } from '../components/LiveMap';
import { MotionView } from '../components/MotionView';
import { PanicButton } from '../components/PanicButton';
import { RapidReportDial } from '../components/RapidReportDial';
import { StatusIndicator } from '../components/StatusIndicator';
import { useAppStore } from '../store/useAppStore';
import {
  DEFAULT_RAPID_ALERT_TAG,
  RAPID_ALERT_SEVERITIES,
  getRapidAlertTitle,
  type RapidAlertSeverity,
  type RapidAlertTag,
} from '../constants/rapid-alerts';
import { ApiError } from '../services/api';
import { createAlert } from '../services/alerts';
import {
  flushQueuedRapidReports,
  getQueuedRapidReportCount,
  queueRapidReport,
} from '../services/report-queue';
import { createRapidReport } from '../services/reports';
import { getCurrentLocation } from '../services/location';
import { getActiveSession } from '../services/sessions';
import { useAppTheme } from '../theme';

export const HomeScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const {
    activeSession,
    activeWatchSession,
    authStatus,
    emergencyLocations,
    lastKnownLocation,
    sessionStatus,
    setActiveSession,
    setScreen,
  } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [rapidLoading, setRapidLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [queueSyncing, setQueueSyncing] = useState(false);
  const [error, setError] = useState('');
  const [rapidStatus, setRapidStatus] = useState('');
  const [queuedReportsCount, setQueuedReportsCount] = useState(0);
  const [selectedTag, setSelectedTag] = useState<RapidAlertTag>(DEFAULT_RAPID_ALERT_TAG);

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

    const syncQueuedReports = async () => {
      if (authStatus !== 'authenticated') {
        return;
      }

      try {
        setQueueSyncing(true);
        const result = await flushQueuedRapidReports();
        const count = await getQueuedRapidReportCount();
        if (!active) {
          return;
        }
        setQueuedReportsCount(count);
        if (result.delivered > 0) {
          setRapidStatus(
            `${result.delivered} queued ${result.delivered === 1 ? 'alert was' : 'alerts were'} delivered when the network came back.`,
          );
        }
      } catch {
        if (!active) {
          return;
        }
        const count = await getQueuedRapidReportCount();
        if (active) {
          setQueuedReportsCount(count);
        }
      } finally {
        if (active) {
          setQueueSyncing(false);
        }
      }
    };

    void syncQueuedReports();

    return () => {
      active = false;
    };
  }, [authStatus]);

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
        startedAt: new Date().toISOString(),
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

  const handleRapidReport = async (severity: RapidAlertSeverity) => {
    try {
      setRapidLoading(true);
      setRapidStatus('');
      const location = await getCurrentLocation();
      const title = getRapidAlertTitle(selectedTag, severity);

      try {
        const report = await createRapidReport({
          title,
          severity,
          category: selectedTag,
          lat: location.lat,
          lng: location.lng,
          locationAccuracyM: location.accuracyM ?? null,
        });
        const severityEntry = RAPID_ALERT_SEVERITIES[severity];
        setRapidStatus(
          `${severityEntry.label} ${selectedTag.replace('_', ' ')} alert sent. Distribution: ${report.distribution?.status || 'queued'}.`,
        );
        const count = await getQueuedRapidReportCount();
        setQueuedReportsCount(count);
      } catch (createError) {
        if (createError instanceof ApiError && createError.status < 500) {
          setRapidStatus(createError.message);
          return;
        }
        await queueRapidReport({
          severity,
          category: selectedTag,
          lat: location.lat,
          lng: location.lng,
          locationAccuracyM: location.accuracyM ?? null,
          title,
        });
        const count = await getQueuedRapidReportCount();
        setQueuedReportsCount(count);
        setRapidStatus(
          `No network right now. Your ${RAPID_ALERT_SEVERITIES[severity].label.toLowerCase()} alert was queued and will send automatically.`,
        );
      }
    } catch (reportError) {
      const message =
        reportError instanceof ApiError
          ? reportError.message
          : reportError instanceof Error
            ? reportError.message
            : 'Could not capture your location for the rapid alert.';
      setRapidStatus(message);
    } finally {
      setRapidLoading(false);
    }
  };

  const mapLat = lastKnownLocation?.lat ?? emergencyLocations[emergencyLocations.length - 1]?.lat ?? 6.5244;
  const mapLng = lastKnownLocation?.lng ?? emergencyLocations[emergencyLocations.length - 1]?.lng ?? 3.3792;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <MotionView delay={30} style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Home Base</Text>
          <Text style={styles.title}>Watch over your route in real time.</Text>
        </View>
        <StatusIndicator status={sessionStatus === 'active' ? 'active' : 'safe'} />
      </MotionView>

      <MotionView delay={90} style={styles.mapShell}>
        <View style={[styles.mapWrap, theme.shadow.card]}>
          <LiveMap
            lat={mapLat}
            lng={mapLng}
            locations={emergencyLocations}
            statusLabel={activeWatchSession ? 'Watch session live' : 'Map live'}
            detailLabel={
              activeWatchSession
                ? `${activeWatchSession.contactName} can track you until ${new Date(
                    activeWatchSession.endsAt,
                  ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Your latest movement and emergency route appear here'
            }
          />
          <HomeActionRail
            actions={[
              { key: 'watch', label: 'Watch', icon: 'watch', onPress: () => setScreen('contacts') },
              { key: 'risk', label: 'Risk Log', icon: 'layers', onPress: () => setScreen('risk-log') },
              { key: 'circle', label: 'Circle', icon: 'contacts', onPress: () => setScreen('contacts') },
              { key: 'profile', label: 'Profile', icon: 'profile', onPress: () => setScreen('profile') },
            ]}
          />
          <LinearGradient colors={theme.gradients.hero} style={styles.mapOverlayCard}>
            <Text style={styles.mapOverlayEyebrow}>Field status</Text>
            <Text style={styles.mapOverlayTitle}>
              {activeWatchSession ? 'A trusted contact is currently watching over your trip.' : 'Ready to start a protected journey.'}
            </Text>
            <Text style={styles.mapOverlayText}>
              {activeWatchSession
                ? `Tracking access ends automatically after ${activeWatchSession.durationMinutes} minutes unless you extend it.`
                : 'Use the contacts tab to invite someone into a timed watch session before you head out.'}
            </Text>
          </LinearGradient>
        </View>
      </MotionView>

      <MotionView delay={160} style={styles.quickGrid}>
        <View style={[styles.quickCard, theme.shadow.card]}>
          <Text style={styles.quickLabel}>Active watch</Text>
          <Text style={styles.quickValue}>
            {activeWatchSession ? activeWatchSession.contactName : 'No one watching yet'}
          </Text>
          <Text style={styles.quickMeta}>
            {activeWatchSession
              ? `Ends ${new Date(activeWatchSession.endsAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : 'Start one from Contacts before a late trip or commute.'}
          </Text>
        </View>
        <View style={[styles.quickCard, theme.shadow.card]}>
          <Text style={styles.quickLabel}>Emergency route</Text>
          <Text style={styles.quickValue}>{emergencyLocations.length} checkpoints</Text>
          <Text style={styles.quickMeta}>
            {syncing ? 'Checking if an older alert is still active...' : 'Recent location updates and alert traces stay here.'}
          </Text>
        </View>
      </MotionView>

      <MotionView delay={220} style={[styles.alertCard, theme.shadow.card]}>
        <Text style={styles.reportEyebrow}>Rapid Report</Text>
        <Text style={styles.alertTitle}>Send a nearby alert in one motion.</Text>
        <Text style={styles.alertText}>
          Hold the report dial, slide toward a severity, and release. GPS and timestamp are attached automatically.
        </Text>
        <View style={styles.reportLegend}>
          {(Object.keys(RAPID_ALERT_SEVERITIES) as RapidAlertSeverity[]).map((severity) => {
            const entry = RAPID_ALERT_SEVERITIES[severity];
            return (
              <View key={severity} style={styles.reportLegendItem}>
                <View style={[styles.reportLegendDot, { backgroundColor: entry.color }]} />
                <Text style={styles.reportLegendText}>
                  {entry.label}: {entry.description}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={styles.reportDialWrap}>
          <RapidReportDial
            disabled={rapidLoading}
            loading={rapidLoading}
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
            onSubmit={handleRapidReport}
          />
        </View>
        {rapidStatus ? <Text style={styles.reportStatus}>{rapidStatus}</Text> : null}
        {queueSyncing ? (
          <View style={styles.syncRow}>
            <ActivityIndicator color={theme.colors.blueGlow} />
            <Text style={styles.syncText}>Checking if any offline alerts can be delivered...</Text>
          </View>
        ) : null}
        {queuedReportsCount > 0 ? (
          <Text style={styles.reportQueueText}>
            {queuedReportsCount} alert{queuedReportsCount === 1 ? '' : 's'} waiting for network delivery.
          </Text>
        ) : null}
      </MotionView>

      <MotionView delay={260} style={[styles.alertCard, theme.shadow.card]}>
        <Text style={styles.alertEyebrow}>SOS Access</Text>
        <Text style={styles.alertTitle}>The panic trigger still lives here.</Text>
        <Text style={styles.alertText}>
          Use it only for urgent situations that need immediate escalation to your trusted network.
        </Text>
        {syncing ? (
          <View style={styles.syncRow}>
            <ActivityIndicator color={theme.colors.blueGlow} />
            <Text style={styles.syncText}>Checking for any active emergency session...</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.panicWrap}>
          <PanicButton disabled={sessionStatus === 'active' || loading} onPress={handleStartEmergency} />
          <Text style={styles.panicCaption}>
            {loading ? 'Starting emergency session...' : 'Hold only if you need emergency help right now.'}
          </Text>
        </View>
      </MotionView>

      <MotionView delay={320} style={styles.bottomActions}>
        <Pressable style={[styles.bottomCard, theme.shadow.card]} onPress={() => setScreen('contacts')}>
          <Text style={styles.bottomTitle}>Build your trusted circle</Text>
          <Text style={styles.bottomText}>Search, add contacts, and start timed watch sessions.</Text>
        </Pressable>
        <Pressable style={[styles.bottomCard, theme.shadow.card]} onPress={() => setScreen('risk-log')}>
          <Text style={styles.bottomTitle}>Review the risk log</Text>
          <Text style={styles.bottomText}>See watch history, past alerts, and the latest risk trail on this device.</Text>
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
      padding: 20,
      paddingBottom: 120,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 16,
    },
    headerText: {
      flex: 1,
    },
    eyebrow: {
      color: theme.colors.blue,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    title: {
      color: theme.colors.text,
      fontSize: 28,
      fontWeight: '800',
      lineHeight: 34,
    },
    mapShell: {
      marginBottom: 16,
    },
    mapWrap: {
      height: 420,
      borderRadius: 30,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    mapOverlayCard: {
      position: 'absolute',
      left: 18,
      right: 118,
      top: 18,
      padding: 16,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      backgroundColor: theme.colors.surface,
    },
    mapOverlayEyebrow: {
      color: theme.colors.blue,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    mapOverlayTitle: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '800',
      lineHeight: 25,
      marginBottom: 8,
    },
    mapOverlayText: {
      color: theme.colors.muted,
      lineHeight: 19,
      fontSize: 13,
    },
    quickGrid: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    quickCard: {
      flex: 1,
      padding: 16,
      borderRadius: 22,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    quickLabel: {
      color: theme.colors.muted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    quickValue: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 23,
      marginBottom: 6,
    },
    quickMeta: {
      color: theme.colors.muted,
      fontSize: 12,
      lineHeight: 17,
    },
    alertCard: {
      padding: 18,
      borderRadius: 28,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 16,
    },
    alertEyebrow: {
      color: theme.colors.red,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    reportEyebrow: {
      color: theme.colors.blue,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    alertTitle: {
      color: theme.colors.text,
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 8,
    },
    alertText: {
      color: theme.colors.muted,
      lineHeight: 19,
    },
    syncRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 12,
    },
    syncText: {
      color: theme.colors.muted,
    },
    error: {
      color: theme.colors.red,
      marginTop: 12,
      lineHeight: 18,
    },
    reportLegend: {
      gap: 8,
      marginTop: 14,
    },
    reportLegendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    reportLegendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    reportLegendText: {
      color: theme.colors.muted,
      flex: 1,
      lineHeight: 18,
      fontSize: 12,
    },
    reportDialWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 18,
    },
    reportStatus: {
      color: theme.colors.text,
      marginTop: 14,
      lineHeight: 19,
      textAlign: 'center',
    },
    reportQueueText: {
      color: theme.colors.muted,
      marginTop: 10,
      lineHeight: 18,
      textAlign: 'center',
    },
    panicWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 18,
    },
    panicCaption: {
      color: theme.colors.muted,
      marginTop: 16,
      textAlign: 'center',
      lineHeight: 18,
    },
    bottomActions: {
      gap: 12,
    },
    bottomCard: {
      padding: 18,
      borderRadius: 22,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    bottomTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 6,
    },
    bottomText: {
      color: theme.colors.muted,
      lineHeight: 18,
    },
  });
