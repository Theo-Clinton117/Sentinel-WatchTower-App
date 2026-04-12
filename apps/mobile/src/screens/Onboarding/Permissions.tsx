import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthArtPanel } from '../../components/AuthArtPanel';
import { MotionView } from '../../components/MotionView';
import { useAppStore } from '../../store/useAppStore';
import {
  AppPermissionSnapshot,
  getAppPermissionSnapshot,
  requestAppPermissions,
} from '../../services/permissions';
import { useAppTheme } from '../../theme';

const defaultSnapshot: AppPermissionSnapshot = {
  foregroundLocation: { granted: false, canAskAgain: true, status: 'undetermined' },
  backgroundLocation: { granted: false, canAskAgain: true, status: 'undetermined' },
  notifications: { granted: false, canAskAgain: true, status: 'undetermined' },
};

export const OnboardingPermissionsScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { resetNavigation, setOnboardingComplete } = useAppStore();
  const [snapshot, setSnapshot] = useState<AppPermissionSnapshot>(defaultSnapshot);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadPermissions = async () => {
      try {
        const current = await getAppPermissionSnapshot();
        if (active) {
          setSnapshot(current);
        }
      } catch {
        if (active) {
          setError('Could not read permission status yet. You can still request access below.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadPermissions();

    return () => {
      active = false;
    };
  }, []);

  const allCriticalGranted = useMemo(
    () => snapshot.foregroundLocation.granted && snapshot.notifications.granted,
    [snapshot],
  );

  const handleGrantPermissions = async () => {
    try {
      setRequesting(true);
      setError('');
      const nextSnapshot = await requestAppPermissions();
      setSnapshot(nextSnapshot);
    } catch {
      setError('Permission request did not complete. You can try again or finish for now.');
    } finally {
      setRequesting(false);
    }
  };

  const renderStatus = (label: string, value: { granted: boolean; status: string }, note: string) => (
    <View style={styles.permissionCard}>
      <View>
        <Text style={styles.permissionTitle}>{label}</Text>
        <Text style={styles.permissionNote}>{note}</Text>
      </View>
      <View style={[styles.badge, value.granted ? styles.badgeGranted : styles.badgePending]}>
        <Text style={styles.badgeText}>{value.granted ? 'Granted' : value.status}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <MotionView delay={20}>
        <AuthArtPanel
          eyebrow="Device Access"
          title="Let WatchTower stay with you."
          caption="Background location and notifications keep emergency broadcasts alive even after the screen changes."
          chipA="BACKGROUND GPS"
          chipB="ALERT DELIVERY"
        />
      </MotionView>
      <MotionView delay={40}>
        <Text style={styles.title}>Permissions</Text>
        <Text style={styles.subtitle}>
          Enable location and notifications so the app can alert trusted contacts and keep your live session visible.
        </Text>
      </MotionView>

      <MotionView delay={120} style={styles.permissionsWrap}>
        {renderStatus(
          'Foreground location',
          snapshot.foregroundLocation,
          'Needed to detect your position while the app is open.',
        )}
        {renderStatus(
          'Background location',
          snapshot.backgroundLocation,
          'Needed to keep emergency sessions active after you leave the screen.',
        )}
        {renderStatus(
          'Notifications',
          snapshot.notifications,
          'Needed for alerts, reminders, and escalations.',
        )}
      </MotionView>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={theme.colors.blueGlow} />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.button, requesting && styles.buttonDisabled]}
        onPress={handleGrantPermissions}
        disabled={requesting}
      >
        {requesting ? (
          <ActivityIndicator color={theme.colors.text} />
        ) : (
          <Text style={styles.buttonText}>Grant Permissions</Text>
        )}
      </Pressable>
      <Pressable
        style={styles.secondary}
        onPress={() => {
          setOnboardingComplete(true);
          resetNavigation('home');
        }}
      >
        <Text style={styles.secondaryText}>
          {allCriticalGranted ? 'Finish Setup' : 'Finish for Now'}
        </Text>
      </Pressable>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: 'transparent',
  },
  title: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 10,
  },
  subtitle: {
    color: theme.colors.muted,
    lineHeight: 20,
    marginBottom: 18,
  },
  permissionsWrap: {
    gap: 12,
    marginBottom: 16,
  },
  permissionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...theme.shadow.card,
  },
  permissionTitle: {
    color: theme.colors.text,
    fontWeight: '700',
    marginBottom: 5,
  },
  permissionNote: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 17,
    maxWidth: 220,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeGranted: {
    backgroundColor: theme.colors.blueSoft,
    borderColor: '#3CB371',
  },
  badgePending: {
    backgroundColor: theme.colors.backgroundElevated,
    borderColor: '#A86C1E',
  },
  badgeText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  loaderWrap: {
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  error: {
    color: theme.colors.red,
    marginBottom: 12,
    lineHeight: 18,
  },
  button: {
    backgroundColor: theme.colors.blue,
    padding: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
    minHeight: 52,
    justifyContent: 'center',
    ...theme.shadow.glow,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  secondary: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  secondaryText: {
    color: theme.colors.text,
    fontWeight: '600',
  },
});
