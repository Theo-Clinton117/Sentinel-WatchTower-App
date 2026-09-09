import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AuthArtPanel } from '../../components/AuthArtPanel';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { MotionView } from '../../components/MotionView';
import { OnboardingProgress } from '../../components/OnboardingProgress';
import { SkeletonBlock } from '../../components/Skeleton';
import { useAppStore } from '../../store/useAppStore';
import {
  AppPermissionSnapshot,
  getAppPermissionSnapshot,
  PermissionKind,
  requestPermission,
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
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadPermissions();
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const allCriticalGranted = useMemo(
    () => snapshot.foregroundLocation.granted && snapshot.notifications.granted,
    [snapshot],
  );

  const handlePermission = async (kind: PermissionKind) => {
    try {
      setRequesting(true);
      setError('');
      const nextSnapshot = await requestPermission(kind);
      setSnapshot(nextSnapshot);
    } catch {
      setError('Permission request did not complete. You can try again or finish for now.');
    } finally {
      setRequesting(false);
    }
  };

  const describeStatus = (value: { granted: boolean; canAskAgain: boolean; status: string }) => {
    if (value.granted) return 'Granted';
    if (!value.canAskAgain) return 'Requires system settings';
    if (value.status === 'undetermined') return 'Not requested';
    if (value.status === 'denied') return 'Denied';
    return 'Unavailable';
  };
  const renderStatus = (kind: PermissionKind, label: string, value: { granted: boolean; canAskAgain: boolean; status: string }, note: string) => (
    <View style={styles.permissionCard}>
      <View>
        <Text style={styles.permissionTitle}>{label}</Text>
        <Text style={styles.permissionNote}>{note}</Text>
      </View>
      <View style={[styles.badge, value.granted ? styles.badgeGranted : styles.badgePending]}>
        <Text style={styles.badgeText}>{describeStatus(value)}</Text>
      </View>
      <Pressable
        style={styles.cardAction}
        onPress={() => value.canAskAgain && !value.granted ? handlePermission(kind) : Linking.openSettings().catch(() => undefined)}
        disabled={requesting}
      >
        <Text style={styles.cardActionText}>{value.granted ? 'Done' : value.canAskAgain ? 'Allow' : 'Settings'}</Text>
      </Pressable>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <MotionView delay={20}>
        <OnboardingProgress currentStep={2} />
      </MotionView>
      <MotionView delay={40}>
        <AuthArtPanel
          eyebrow="Device Access"
          title="Let Sentinel work when it matters."
          caption="Location and notifications keep alerts useful."
          chipA="LOCATION"
          chipB="ALERTS"
        />
      </MotionView>
      <MotionView delay={70}>
        <Text style={styles.title}>Permissions</Text>
        <Text style={styles.subtitle}>
          Enable what you need now. You can change it later in phone settings.
        </Text>
      </MotionView>

      <MotionView delay={120} style={styles.permissionsWrap}>
        {renderStatus(
          'foregroundLocation', 'Location while using Sentinel',
          snapshot.foregroundLocation,
          'Shows your current position while you are using Sentinel.',
        )}
        {renderStatus(
          'backgroundLocation', 'Location during an active alert',
          snapshot.backgroundLocation,
          'Keeps location updates going if the screen changes during an alert.',
        )}
        {renderStatus(
          'notifications', 'Safety notifications',
          snapshot.notifications,
          'Lets Sentinel show important safety updates on your phone.',
        )}
      </MotionView>

      {loading ? (
        <View style={styles.bannerSpace}>
          <View style={[styles.loadingCard, theme.shadow.card]}>
            <SkeletonBlock width="42%" height={14} />
            <SkeletonBlock width="72%" height={12} />
          </View>
        </View>
      ) : null}

      {error ? (
        <View style={styles.bannerSpace}>
          <FeedbackBanner
            tone="error"
            title="Permission check failed"
            message={error}
            actionLabel="Settings"
            onAction={() => Linking.openSettings().catch(() => undefined)}
          />
        </View>
      ) : null}

      {requesting ? <ActivityIndicator color={theme.colors.blueGlow} /> : null}
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
    </ScrollView>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: 20,
    paddingBottom: 120,
    gap: 16,
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
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 14,
    padding: 16,
    borderRadius: 8,
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
    borderRadius: 8,
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
  cardAction: { minHeight: 36, paddingHorizontal: 12, borderRadius: 10, backgroundColor: theme.colors.blue, justifyContent: 'center' },
  cardActionText: { color: '#fff', fontSize: 12, fontWeight: '800' },
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
  bannerSpace: {
    marginBottom: 0,
  },
  loadingCard: {
    gap: 10,
    padding: 14,
    borderRadius: 20,
    backgroundColor: theme.isDark ? 'rgba(12,21,38,0.9)' : 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,21,38,0.06)',
  },
  button: {
    backgroundColor: theme.colors.blue,
    padding: 14,
    borderRadius: 8,
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  secondaryText: {
    color: theme.colors.text,
    fontWeight: '600',
  },
});
