import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { shallow } from 'zustand/shallow';
import { MotionView } from '../components/MotionView';
import { ProfileGlyph } from '../components/ProfileGlyph';
import { ApiError } from '../services/api';
import { requestReviewerRole } from '../services/roles';
import { getCurrentUser } from '../services/users';
import { ThemePreference, useAppStore } from '../store/useAppStore';
import { useAppTheme } from '../theme';

const resolveDisplayName = (name?: string | null, email?: string | null, phone?: string | null) =>
  name || email || phone || 'Sentinel member';

const resolveProfileRating = (score?: number | null) => {
  if (typeof score !== 'number') {
    return '4.92';
  }

  return Math.max(4.1, Math.min(4.99, 4 + score / 100)).toFixed(2);
};

const resolveTrustSummary = (
  restrictionLevel?:
    | 'none'
    | 'warning'
    | 'temporary_restriction'
    | 'shadow_restriction'
    | 'ban',
) => {
  switch (restrictionLevel) {
    case 'ban':
      return 'Account access is blocked from sending new public reports.';
    case 'shadow_restriction':
      return 'Recent reports are being sandboxed while trust signals recover.';
    case 'temporary_restriction':
      return 'New reports are temporarily throttled until your safety score improves.';
    case 'warning':
      return 'A warning is active because recent reports need stronger corroboration.';
    default:
      return 'Consistent and accurate reporting helps alerts move faster through the network.';
  }
};

const formatReviewerStatus = (
  reviewerRequest?: {
    status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
    requestedAt?: string | null;
    adminNote?: string | null;
  } | null,
  roles: string[] = [],
) => {
  if (roles.includes('admin')) {
    return 'Admin access is already active on this account.';
  }

  if (roles.includes('reviewer')) {
    return 'Reviewer access is active on this account.';
  }

  if (reviewerRequest?.status === 'pending') {
    return `Reviewer request pending${reviewerRequest.requestedAt ? ` since ${new Date(reviewerRequest.requestedAt).toLocaleDateString()}` : ''}.`;
  }

  if (reviewerRequest?.status === 'rejected') {
    return `Reviewer request declined${reviewerRequest.adminNote ? `: ${reviewerRequest.adminNote}` : '.'}`;
  }

  if (reviewerRequest?.status === 'approved') {
    return 'Reviewer request approved. Refresh if your role chip has not updated yet.';
  }

  return 'Request reviewer access when you are ready to help validate community reports.';
};

const ScreenFrame = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) => {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <MotionView delay={40}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </MotionView>
      {children}
    </ScrollView>
  );
};

const DetailCard = ({
  title,
  children,
  delay,
}: {
  title: string;
  children: React.ReactNode;
  delay: number;
}) => {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <MotionView delay={delay} style={[styles.card, theme.shadow.card]}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </MotionView>
  );
};

const InfoRow = ({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) => {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <View style={[styles.infoRow, !isLast && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
};

const ThemeChipRow = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { themePreference, setThemePreference } = useAppStore(
    (state) => ({
      themePreference: state.themePreference,
      setThemePreference: state.setThemePreference,
    }),
    shallow,
  );
  const modes: ThemePreference[] = ['system', 'light', 'dark'];

  return (
    <View style={styles.modeRow}>
      {modes.map((mode) => {
        const active = themePreference === mode;

        return (
          <Pressable
            key={mode}
            onPress={() => setThemePreference(mode)}
            style={[styles.modeChip, active && styles.modeChipActive]}
          >
            <Text style={[styles.modeText, active && styles.modeTextActive]}>
              {mode === 'system' ? 'System' : mode === 'light' ? 'Light' : 'Dark'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const SavedPlaceContent = ({
  title,
  helper,
}: {
  title: string;
  helper: string;
}) => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const lastKnownLocation = useAppStore((state) => state.lastKnownLocation);
  const formattedLocation = lastKnownLocation
    ? `${lastKnownLocation.lat.toFixed(5)}, ${lastKnownLocation.lng.toFixed(5)}`
    : 'No recent location available';

  return (
    <ScreenFrame
      title={title}
      subtitle="Save familiar places so alerts, watch sessions, and quick references feel more personal."
    >
      <DetailCard title="Saved place" delay={110}>
        <View style={styles.savedPlaceHero}>
          <View style={styles.savedPlaceIcon}>
            <ProfileGlyph
              name={title === 'Home address' ? 'home' : 'briefcase'}
              size={22}
              color={theme.colors.blue}
            />
          </View>
          <View style={styles.savedPlaceCopy}>
            <Text style={styles.savedPlaceState}>Not added yet</Text>
            <Text style={styles.savedPlaceText}>{helper}</Text>
          </View>
        </View>
      </DetailCard>

      <DetailCard title="Quick details" delay={170}>
        <InfoRow label="Current status" value="Waiting for an address" />
        <InfoRow label="Nearby pin" value={formattedLocation} />
        <InfoRow label="Best use" value="Fast recall during an alert or check-in" isLast />
      </DetailCard>
    </ScreenFrame>
  );
};

export const PersonalInfoScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const user = useAppStore((state) => state.user);
  const displayName = resolveDisplayName(user?.name, user?.email, user?.phone);
  const roles = user?.roles || ['user'];

  return (
    <ScreenFrame
      title="Personal info"
      subtitle="Review the identity and contact details tied to this account."
    >
      <MotionView delay={100} style={[styles.profileIdentityCard, theme.shadow.card]}>
        <View style={styles.avatarLarge}>
          <ProfileGlyph name="user" size={28} color={theme.colors.muted} />
        </View>
        <View style={styles.profileIdentityCopy}>
          <Text style={styles.identityName}>{displayName}</Text>
          <Text style={styles.identityHint}>Keep your core profile details accurate for smoother support and alerts.</Text>
        </View>
      </MotionView>

      <DetailCard title="Account details" delay={150}>
        <InfoRow label="Full name" value={displayName} />
        <InfoRow label="Email" value={user?.email || 'Not added yet'} />
        <InfoRow label="Phone" value={user?.phone || 'Not added yet'} />
        <InfoRow label="Account status" value={user?.status || 'Active'} isLast />
      </DetailCard>

      <DetailCard title="Roles" delay={210}>
        <View style={styles.roleRow}>
          {roles.map((role) => (
            <View key={role} style={styles.roleChip}>
              <Text style={styles.roleChipText}>{role.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      </DetailCard>
    </ScreenFrame>
  );
};

export const FamilyProfileScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { activeWatchSession, resetNavigation } = useAppStore(
    (state) => ({
      activeWatchSession: state.activeWatchSession,
      resetNavigation: state.resetNavigation,
    }),
    shallow,
  );

  return (
    <ScreenFrame
      title="Family profile"
      subtitle="Keep the people closest to you ready for live alerts, check-ins, and watch sessions."
    >
      <DetailCard title="Trusted circle" delay={110}>
        <Text style={styles.bodyText}>
          Your family profile is where nearby support and emergency context come together. Use your trusted contacts list to keep the right people in the loop.
        </Text>
      </DetailCard>

      <DetailCard title="Readiness" delay={170}>
        <InfoRow label="Emergency contacts" value="Managed in the Contacts tab" />
        <InfoRow
          label="Live watch session"
          value={activeWatchSession ? `Active with ${activeWatchSession.contactName}` : 'No watch session running'}
        />
        <InfoRow label="Family visibility" value="Shared only when safety workflows need it" isLast />
      </DetailCard>

      <MotionView delay={230}>
        <Pressable style={[styles.primaryButton, theme.shadow.glow]} onPress={() => resetNavigation('contacts')}>
          <Text style={styles.primaryButtonText}>Open trusted contacts</Text>
        </Pressable>
      </MotionView>
    </ScreenFrame>
  );
};

export const SafetyScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { user, setUser } = useAppStore(
    (state) => ({
      user: state.user,
      setUser: state.setUser,
    }),
    shallow,
  );
  const [isRequestingReviewer, setIsRequestingReviewer] = React.useState(false);
  const [reviewerMessage, setReviewerMessage] = React.useState('');
  const roles = user?.roles || ['user'];
  const credibility = user?.credibility;
  const canRequestReviewer =
    !roles.includes('reviewer') &&
    !roles.includes('admin') &&
    user?.reviewerRequest?.status !== 'pending';
  const trustTone =
    credibility?.ratingTier === 'high'
      ? theme.colors.blue
      : credibility?.ratingTier === 'low'
        ? theme.colors.red
        : theme.colors.text;

  const handleReviewerRequest = async () => {
    try {
      setIsRequestingReviewer(true);
      setReviewerMessage('');
      await requestReviewerRole('I want to help validate incoming community reports as a reviewer.');
      const freshUser = await getCurrentUser();
      setUser(freshUser);
      setReviewerMessage('Reviewer request sent. An admin will review it.');
    } catch (error) {
      setReviewerMessage(
        error instanceof ApiError ? error.message : 'Could not submit your reviewer request right now.',
      );
    } finally {
      setIsRequestingReviewer(false);
    }
  };

  return (
    <ScreenFrame
      title="Safety"
      subtitle="Monitor trust signals, response readiness, and reviewer access from one place."
    >
      <DetailCard title="Safety rating" delay={110}>
        <View style={styles.trustRow}>
          <View style={styles.trustScoreBubble}>
            <Text style={[styles.trustScoreValue, { color: trustTone }]}>
              {credibility?.score ?? 50}
            </Text>
            <Text style={styles.trustScoreLabel}>out of 100</Text>
          </View>
          <View style={styles.trustMeta}>
            <Text style={styles.trustTier}>
              {resolveProfileRating(credibility?.score)} rating
            </Text>
            <Text style={styles.bodyText}>{resolveTrustSummary(credibility?.restrictionLevel)}</Text>
            <Text style={styles.trustStats}>
              {credibility?.confirmedTrueReportsCount ?? 0} confirmed
              {'  -  '}
              {credibility?.likelyTrueReportsCount ?? 0} likely true
              {'  -  '}
              {(credibility?.falseReportsCount ?? 0) + (credibility?.maliciousReportsCount ?? 0)} harmful
            </Text>
          </View>
        </View>
      </DetailCard>

      <DetailCard title="Reviewer access" delay={180}>
        <Text style={styles.bodyText}>{formatReviewerStatus(user?.reviewerRequest, roles)}</Text>
        {canRequestReviewer ? (
          <Pressable
            style={[styles.primaryButton, isRequestingReviewer && styles.buttonDisabled]}
            onPress={handleReviewerRequest}
            disabled={isRequestingReviewer}
          >
            <Text style={styles.primaryButtonText}>
              {isRequestingReviewer ? 'Submitting...' : 'Request reviewer role'}
            </Text>
          </Pressable>
        ) : null}
        {reviewerMessage ? <Text style={styles.helperText}>{reviewerMessage}</Text> : null}
      </DetailCard>
    </ScreenFrame>
  );
};

export const LoginSecurityScreen = () => {
  const theme = useAppTheme();
  const { clearAuthSession, deviceId, user, sessionStatus } = useAppStore(
    (state) => ({
      clearAuthSession: state.clearAuthSession,
      deviceId: state.deviceId,
      user: state.user,
      sessionStatus: state.sessionStatus,
    }),
    shallow,
  );
  const styles = createStyles(theme);

  return (
    <ScreenFrame
      title="Login & security"
      subtitle="Manage sign-in details, device presence, and secure session behavior."
    >
      <DetailCard title="Sign-in details" delay={110}>
        <InfoRow label="Email" value={user?.email || 'Not added yet'} />
        <InfoRow label="Phone" value={user?.phone || 'Not added yet'} />
        <InfoRow label="Device" value={deviceId} />
        <InfoRow label="Session status" value={sessionStatus.replace('_', ' ')} isLast />
      </DetailCard>

      <DetailCard title="Security" delay={180}>
        <Text style={styles.bodyText}>
          Your secure session is stored on this device so you can return quickly during urgent moments. Sign out below whenever you need to clear local access.
        </Text>
      </DetailCard>

      <MotionView delay={240}>
        <Pressable style={styles.logoutButton} onPress={clearAuthSession}>
          <Text style={styles.logoutButtonText}>Sign out</Text>
        </Pressable>
      </MotionView>
    </ScreenFrame>
  );
};

export const PrivacyScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <ScreenFrame
      title="Privacy"
      subtitle="Choose how safety data, appearance, and visibility behave on this device."
    >
      <DetailCard title="How data is used" delay={110}>
        <InfoRow label="Location sharing" value="Used when alerts or live sessions need it" />
        <InfoRow label="Trusted contacts" value="Notified only through your safety workflows" />
        <InfoRow label="Data requests" value="Delete-my-data flow can be connected here later" isLast />
      </DetailCard>

      <DetailCard title="Appearance" delay={180}>
        <ThemeChipRow />
      </DetailCard>

      <DetailCard title="Privacy note" delay={240}>
        <Text style={styles.bodyText}>
          Keep sensitive information minimal and review shared contacts regularly so your response circle stays intentional.
        </Text>
      </DetailCard>
    </ScreenFrame>
  );
};

export const HomeAddressScreen = () => (
  <SavedPlaceContent
    title="Home address"
    helper="Add your home base so you can reference it quickly during alerts, escorts, and check-ins."
  />
);

export const WorkAddressScreen = () => (
  <SavedPlaceContent
    title="Work address"
    helper="Save your work location to make commute-related safety flows easier to recognize and share."
  />
);

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 26,
      paddingBottom: 120,
    },
    title: {
      color: theme.colors.text,
      fontSize: 28,
      fontWeight: '800',
      marginBottom: 8,
    },
    subtitle: {
      color: theme.colors.muted,
      lineHeight: 20,
      marginBottom: 18,
    },
    card: {
      padding: 18,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceStrong,
      marginBottom: 14,
    },
    cardTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 12,
    },
    profileIdentityCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 18,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceStrong,
      marginBottom: 14,
    },
    avatarLarge: {
      width: 62,
      height: 62,
      borderRadius: 31,
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : '#F1F4FA',
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileIdentityCopy: {
      flex: 1,
      gap: 4,
    },
    identityName: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '800',
    },
    identityHint: {
      color: theme.colors.muted,
      lineHeight: 19,
    },
    infoRow: {
      paddingVertical: 12,
      gap: 4,
    },
    infoRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    infoLabel: {
      color: theme.colors.muted,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    infoValue: {
      color: theme.colors.text,
      fontSize: 16,
      lineHeight: 21,
    },
    roleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    roleChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElevated,
    },
    roleChipText: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
    bodyText: {
      color: theme.colors.muted,
      lineHeight: 20,
    },
    primaryButton: {
      minHeight: 50,
      borderRadius: 16,
      backgroundColor: theme.colors.blue,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      marginTop: 14,
    },
    primaryButtonText: {
      color: theme.colors.text,
      fontWeight: '700',
    },
    buttonDisabled: {
      opacity: 0.72,
    },
    helperText: {
      color: theme.colors.muted,
      lineHeight: 18,
      marginTop: 10,
    },
    trustRow: {
      flexDirection: 'row',
      gap: 16,
      alignItems: 'center',
    },
    trustScoreBubble: {
      width: 92,
      height: 92,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    trustScoreValue: {
      fontSize: 30,
      fontWeight: '900',
    },
    trustScoreLabel: {
      color: theme.colors.muted,
      fontSize: 11,
      marginTop: 2,
    },
    trustMeta: {
      flex: 1,
      gap: 6,
    },
    trustTier: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    trustStats: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 18,
    },
    logoutButton: {
      minHeight: 52,
      borderRadius: 18,
      backgroundColor: theme.gradients.emergency[0],
      borderWidth: 1,
      borderColor: theme.colors.red,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoutButtonText: {
      color: theme.colors.text,
      fontWeight: '700',
    },
    modeRow: {
      flexDirection: 'row',
      gap: 10,
    },
    modeChip: {
      flex: 1,
      minHeight: 46,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modeChipActive: {
      backgroundColor: theme.colors.blueSoft,
      borderColor: theme.colors.blueGlow,
    },
    modeText: {
      color: theme.colors.muted,
      fontWeight: '700',
    },
    modeTextActive: {
      color: theme.colors.text,
    },
    savedPlaceHero: {
      flexDirection: 'row',
      gap: 14,
      alignItems: 'center',
    },
    savedPlaceIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: theme.colors.blueSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    savedPlaceCopy: {
      flex: 1,
      gap: 4,
    },
    savedPlaceState: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    savedPlaceText: {
      color: theme.colors.muted,
      lineHeight: 19,
    },
  });
