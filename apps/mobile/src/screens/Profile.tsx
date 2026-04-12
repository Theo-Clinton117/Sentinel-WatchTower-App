import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MotionView } from '../components/MotionView';
import { ThemePreference, useAppStore } from '../store/useAppStore';
import { ApiError } from '../services/api';
import { requestReviewerRole } from '../services/roles';
import { getCurrentUser } from '../services/users';
import { useAppTheme } from '../theme';

export const ProfileScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { clearAuthSession, setThemePreference, themePreference, user, setUser } = useAppStore();
  const modes: ThemePreference[] = ['system', 'light', 'dark'];
  const credibility = user?.credibility;
  const roles = user?.roles || ['user'];
  const reviewerRequest = user?.reviewerRequest;
  const canRequestReviewer =
    !roles.includes('reviewer') &&
    !roles.includes('admin') &&
    reviewerRequest?.status !== 'pending';
  const [isRefreshingUser, setIsRefreshingUser] = React.useState(false);
  const [isRequestingReviewer, setIsRequestingReviewer] = React.useState(false);
  const [reviewerMessage, setReviewerMessage] = React.useState('');
  const trustTone =
    credibility?.ratingTier === 'high'
      ? theme.colors.blue
      : credibility?.ratingTier === 'low'
        ? theme.colors.red
        : theme.colors.text;
  const trustSummary = credibility
    ? credibility.restrictionLevel === 'ban'
      ? 'Account banned from sending new public reports.'
      : credibility.restrictionLevel === 'shadow_restriction'
        ? 'Reports are being quietly sandboxed pending stronger signals.'
        : credibility.restrictionLevel === 'temporary_restriction'
          ? 'New reports are temporarily throttled while trust recovers.'
          : credibility.restrictionLevel === 'warning'
            ? 'A warning is active because recent reports were marked false.'
            : 'Consistent, corroborated reports move alerts faster through the network.'
    : 'Your credibility score updates as your reports are reviewed and corroborated.';

  React.useEffect(() => {
    let active = true;

    const hydrateProfile = async () => {
      try {
        setIsRefreshingUser(true);
        const freshUser = await getCurrentUser();
        if (active) {
          setUser(freshUser);
        }
      } catch {
        if (active) {
          setReviewerMessage((current) => current || '');
        }
      } finally {
        if (active) {
          setIsRefreshingUser(false);
        }
      }
    };

    void hydrateProfile();

    return () => {
      active = false;
    };
  }, [setUser]);

  const handleReviewerRequest = async () => {
    try {
      setIsRequestingReviewer(true);
      setReviewerMessage('');
      await requestReviewerRole(
        'I want to help validate incoming community reports as a reviewer.',
      );
      const freshUser = await getCurrentUser();
      setUser(freshUser);
      setReviewerMessage('Reviewer request sent. An admin will review it.');
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Could not submit your reviewer request right now.';
      setReviewerMessage(message);
    } finally {
      setIsRequestingReviewer(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <MotionView delay={40}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>
          Keep your account, plan, appearance, and personal controls in one place.
        </Text>
      </MotionView>

      <MotionView delay={110} style={[styles.heroCard, theme.shadow.card]}>
        <Text style={styles.heroLabel}>Signed in as</Text>
        <Text style={styles.heroName}>{user?.name || user?.phone || 'Unknown user'}</Text>
        {user?.email ? <Text style={styles.heroMeta}>{user.email}</Text> : null}
        <View style={styles.roleRow}>
          {roles.map((role) => (
            <View key={role} style={styles.roleChip}>
              <Text style={styles.roleChipText}>{role.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      </MotionView>

      <MotionView delay={170} style={[styles.sectionCard, theme.shadow.card]}>
        <Text style={styles.sectionTitle}>Credibility</Text>
        <View style={styles.trustRow}>
          <View style={styles.trustScoreBubble}>
            <Text style={[styles.trustScoreValue, { color: trustTone }]}>
              {credibility?.score ?? 50}
            </Text>
            <Text style={styles.trustScoreLabel}>out of 100</Text>
          </View>
          <View style={styles.trustMeta}>
            <Text style={styles.trustTier}>
              {credibility?.ratingTier
                ? `${credibility.ratingTier.toUpperCase()} trust`
                : 'Building trust'}
            </Text>
            <Text style={styles.trustText}>{trustSummary}</Text>
            {credibility ? (
              <Text style={styles.trustStats}>
                {credibility.confirmedTrueReportsCount} confirmed
                {'  •  '}
                {credibility.likelyTrueReportsCount} likely true
                {'  •  '}
                {credibility.falseReportsCount + credibility.maliciousReportsCount} harmful
              </Text>
            ) : null}
          </View>
        </View>
      </MotionView>

      <MotionView delay={200} style={[styles.sectionCard, theme.shadow.card]}>
        <Text style={styles.sectionTitle}>Subscription</Text>
        <Text style={styles.planName}>Sentinel Pro</Text>
        <Text style={styles.planMeta}>NGN 1000 / month</Text>
        <Text style={styles.sectionText}>
          Premium monitoring, escalation triggers, and safer live visibility for your trusted circle.
        </Text>
        <Pressable style={styles.primaryAction}>
          <Text style={styles.primaryActionText}>Manage plan</Text>
        </Pressable>
      </MotionView>

      <MotionView delay={260} style={[styles.sectionCard, theme.shadow.card]}>
        <Text style={styles.sectionTitle}>Role Access</Text>
        <Text style={styles.sectionText}>
          All new accounts start as users. Reviewer access is requested here and approved by an
          admin. Admin access is only granted directly in the database.
        </Text>
        {roles.includes('admin') ? (
          <Text style={styles.roleStatus}>
            You already have admin access from the system role table.
          </Text>
        ) : roles.includes('reviewer') ? (
          <Text style={styles.roleStatus}>
            Reviewer access is active on this account.
          </Text>
        ) : reviewerRequest?.status === 'pending' ? (
          <Text style={styles.roleStatus}>
            Reviewer request pending{reviewerRequest.requestedAt ? ` since ${new Date(reviewerRequest.requestedAt).toLocaleDateString()}` : ''}.
          </Text>
        ) : reviewerRequest?.status === 'rejected' ? (
          <Text style={styles.roleStatus}>
            Reviewer request declined{reviewerRequest.adminNote ? `: ${reviewerRequest.adminNote}` : '.'}
          </Text>
        ) : reviewerRequest?.status === 'approved' ? (
          <Text style={styles.roleStatus}>Reviewer request approved. Refresh if the role chip has not updated yet.</Text>
        ) : (
          <Text style={styles.roleStatus}>
            Ask for reviewer access when you are ready to help validate reports.
          </Text>
        )}
        {canRequestReviewer ? (
          <Pressable
            style={[styles.primaryAction, isRequestingReviewer && styles.actionDisabled]}
            onPress={handleReviewerRequest}
            disabled={isRequestingReviewer}
          >
            <Text style={styles.primaryActionText}>
              {isRequestingReviewer ? 'Submitting...' : 'Request reviewer role'}
            </Text>
          </Pressable>
        ) : null}
        {reviewerMessage ? <Text style={styles.helperText}>{reviewerMessage}</Text> : null}
        {isRefreshingUser ? <Text style={styles.helperText}>Refreshing account roles...</Text> : null}
      </MotionView>

      <MotionView delay={320} style={[styles.sectionCard, theme.shadow.card]}>
        <Text style={styles.sectionTitle}>Appearance</Text>
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
      </MotionView>

      <MotionView delay={380} style={[styles.sectionCard, theme.shadow.card]}>
        <Text style={styles.sectionTitle}>Tools</Text>
        <View style={styles.item}>
          <Text style={styles.itemText}>Privacy controls</Text>
          <Text style={styles.itemMeta}>Choose how your safety data is shared.</Text>
        </View>
        <View style={styles.item}>
          <Text style={styles.itemText}>Device management</Text>
          <Text style={styles.itemMeta}>Review linked devices and session behavior.</Text>
        </View>
        <View style={styles.item}>
          <Text style={styles.itemText}>Delete my data</Text>
          <Text style={styles.itemMeta}>Request a full wipe of stored app data later.</Text>
        </View>
      </MotionView>

      <MotionView delay={430}>
        <Pressable style={styles.logout} onPress={clearAuthSession}>
          <Text style={styles.logoutText}>Sign out</Text>
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
    title: {
      color: theme.colors.text,
      fontSize: 28,
      fontWeight: '800',
      marginBottom: 8,
    },
    subtitle: {
      color: theme.colors.muted,
      lineHeight: 20,
      marginBottom: 16,
    },
    heroCard: {
      padding: 18,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      marginBottom: 14,
    },
    heroLabel: {
      color: theme.colors.muted,
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 6,
    },
    heroName: {
      color: theme.colors.text,
      fontSize: 22,
      fontWeight: '800',
    },
    heroMeta: {
      color: theme.colors.muted,
      marginTop: 4,
    },
    roleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 14,
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
    trustText: {
      color: theme.colors.muted,
      lineHeight: 19,
    },
    trustStats: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 18,
    },
    roleStatus: {
      color: theme.colors.text,
      lineHeight: 20,
      marginBottom: 12,
    },
    helperText: {
      color: theme.colors.muted,
      lineHeight: 18,
      marginTop: 10,
    },
    sectionCard: {
      padding: 18,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      marginBottom: 14,
    },
    sectionTitle: {
      color: theme.colors.text,
      fontWeight: '800',
      fontSize: 18,
      marginBottom: 10,
    },
    planName: {
      color: theme.colors.blue,
      fontSize: 24,
      fontWeight: '800',
    },
    planMeta: {
      color: theme.colors.muted,
      marginTop: 2,
      marginBottom: 10,
    },
    sectionText: {
      color: theme.colors.muted,
      lineHeight: 19,
      marginBottom: 12,
    },
    primaryAction: {
      minHeight: 48,
      paddingHorizontal: 16,
      borderRadius: 16,
      backgroundColor: theme.colors.blue,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryActionText: {
      color: theme.colors.text,
      fontWeight: '700',
    },
    actionDisabled: {
      opacity: 0.7,
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
    item: {
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    itemText: {
      color: theme.colors.text,
      fontWeight: '700',
      marginBottom: 4,
    },
    itemMeta: {
      color: theme.colors.muted,
      lineHeight: 18,
    },
    logout: {
      marginTop: 4,
      minHeight: 52,
      borderRadius: 18,
      backgroundColor: theme.gradients.emergency[0],
      borderWidth: 1,
      borderColor: theme.colors.red,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoutText: {
      color: theme.colors.text,
      fontWeight: '700',
    },
  });
