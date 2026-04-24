import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { shallow } from 'zustand/shallow';
import { MotionView } from '../components/MotionView';
import {
  ReviewerClassification,
  ReviewerFilter,
  ReviewerQueueReport,
  classifyReviewerReport,
  getReviewerQueue,
} from '../services/admin';
import { getCurrentUser } from '../services/users';
import { useAppStore } from '../store/useAppStore';
import { useAppTheme } from '../theme';

const reviewerFilters: Array<{ label: string; value: ReviewerFilter }> = [
  { label: 'Queue', value: 'pending' },
  { label: 'Reviewed', value: 'reviewed' },
  { label: 'Flagged', value: 'flagged' },
  { label: 'All', value: 'all' },
];

const reviewerActions: Array<{
  label: string;
  classification: ReviewerClassification;
  responseOutcome: 'validated' | 'pending' | 'dismissed';
}> = [
  { label: 'Confirm', classification: 'confirmed_true', responseOutcome: 'validated' },
  { label: 'Likely', classification: 'likely_true', responseOutcome: 'validated' },
  { label: 'Reset', classification: 'inconclusive', responseOutcome: 'pending' },
  { label: 'False', classification: 'false', responseOutcome: 'dismissed' },
  { label: 'Malicious', classification: 'malicious', responseOutcome: 'dismissed' },
];

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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <MotionView delay={40}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </MotionView>
      {children}
    </ScrollView>
  );
};

const InfoCard = ({
  title,
  copy,
  delay,
}: {
  title: string;
  copy: string;
  delay: number;
}) => {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <MotionView delay={delay} style={[styles.card, theme.shadow.card]}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardCopy}>{copy}</Text>
    </MotionView>
  );
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return 'Just now';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Just now';
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const titleCase = (value?: string | null) =>
  String(value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Unknown';

const getSeverityTone = (severity: ReviewerQueueReport['severity']) => {
  switch (severity) {
    case 'critical':
      return {
        text: 'Critical',
        accent: '#FF6B82',
        fill: 'rgba(255,107,130,0.14)',
        border: 'rgba(255,107,130,0.25)',
      };
    case 'high':
      return {
        text: 'High',
        accent: '#F3A72F',
        fill: 'rgba(243,167,47,0.14)',
        border: 'rgba(243,167,47,0.24)',
      };
    case 'low':
      return {
        text: 'Low',
        accent: '#2BAE73',
        fill: 'rgba(43,174,115,0.14)',
        border: 'rgba(43,174,115,0.24)',
      };
    default:
      return {
        text: 'Medium',
        accent: '#1E63FF',
        fill: 'rgba(30,99,255,0.12)',
        border: 'rgba(30,99,255,0.22)',
      };
  }
};

const getClassificationTone = (classification: ReviewerQueueReport['classification']['status']) => {
  switch (classification) {
    case 'confirmed_true':
      return { accent: '#2BAE73', fill: 'rgba(43,174,115,0.14)', border: 'rgba(43,174,115,0.24)' };
    case 'likely_true':
      return { accent: '#3E8BFF', fill: 'rgba(62,139,255,0.14)', border: 'rgba(62,139,255,0.24)' };
    case 'false':
      return { accent: '#FF8A3D', fill: 'rgba(255,138,61,0.14)', border: 'rgba(255,138,61,0.24)' };
    case 'malicious':
      return { accent: '#FF5E78', fill: 'rgba(255,94,120,0.14)', border: 'rgba(255,94,120,0.24)' };
    default:
      return { accent: '#8EA0C6', fill: 'rgba(142,160,198,0.14)', border: 'rgba(142,160,198,0.24)' };
  }
};

const SummaryTile = ({
  label,
  value,
  delay,
}: {
  label: string;
  value: number;
  delay: number;
}) => {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <MotionView delay={delay} style={[styles.summaryTile, theme.shadow.card]}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </MotionView>
  );
};

const ReviewerReportCard = ({
  report,
  busyActionKey,
  onClassify,
}: {
  report: ReviewerQueueReport;
  busyActionKey: string | null;
  onClassify: (report: ReviewerQueueReport, classification: ReviewerClassification) => void;
}) => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const severityTone = getSeverityTone(report.severity);
  const classificationTone = getClassificationTone(report.classification.status);

  return (
    <View style={[styles.reviewCard, theme.shadow.card]}>
      <View style={styles.reviewCardHeader}>
        <View style={[styles.tagPill, { backgroundColor: severityTone.fill, borderColor: severityTone.border }]}>
          <Text style={[styles.tagPillText, { color: severityTone.accent }]}>{severityTone.text}</Text>
        </View>
        <View
          style={[
            styles.tagPill,
            { backgroundColor: classificationTone.fill, borderColor: classificationTone.border },
          ]}
        >
          <Text style={[styles.tagPillText, { color: classificationTone.accent }]}>
            {titleCase(report.classification.status)}
          </Text>
        </View>
      </View>

      <Text style={styles.reviewTitle}>{report.title}</Text>
      {report.description ? <Text style={styles.reviewDescription}>{report.description}</Text> : null}

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          Reporter: {report.reporter.name || report.reporter.phone || 'Sentinel user'}
        </Text>
        <Text style={styles.metaText}>{formatDateTime(report.createdAt)}</Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>Flags: {report.flagsCount}</Text>
        <Text style={styles.metaText}>Confirms: {report.confirmationsCount}</Text>
        <Text style={styles.metaText}>Trust: {report.reporter.score}</Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>Distribution: {titleCase(report.distribution.status)}</Text>
        <Text style={styles.metaText}>Outcome: {titleCase(report.classification.responseOutcome)}</Text>
      </View>

      <View style={styles.metricRow}>
        <View style={styles.metricChip}>
          <Text style={styles.metricLabel}>AI</Text>
          <Text style={styles.metricValue}>{Math.round(report.classification.aiConfidence * 100)}%</Text>
        </View>
        <View style={styles.metricChip}>
          <Text style={styles.metricLabel}>Quality</Text>
          <Text style={styles.metricValue}>{Math.round(report.classification.qualityScore)}</Text>
        </View>
        <View style={styles.metricChip}>
          <Text style={styles.metricLabel}>Corroboration</Text>
          <Text style={styles.metricValue}>{report.classification.corroborationCount}</Text>
        </View>
      </View>

      {report.classification.reviewedAt ? (
        <Text style={styles.reviewedText}>
          Last reviewed {formatDateTime(report.classification.reviewedAt)}
        </Text>
      ) : (
        <Text style={styles.reviewedText}>Not reviewed yet</Text>
      )}

      <View style={styles.actionWrap}>
        {reviewerActions.map((action) => {
          const actionKey = `${report.id}:${action.classification}`;
          const isBusy = busyActionKey === actionKey;

          return (
            <Pressable
              key={action.classification}
              onPress={() => onClassify(report, action.classification)}
              disabled={Boolean(busyActionKey)}
              style={[
                styles.actionChip,
                {
                  borderColor:
                    report.classification.status === action.classification
                      ? theme.colors.blue
                      : theme.colors.borderStrong,
                  backgroundColor:
                    report.classification.status === action.classification
                      ? theme.colors.blueSoft
                      : theme.colors.surface,
                  opacity: busyActionKey ? (isBusy ? 1 : 0.58) : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.actionChipText,
                  {
                    color:
                      report.classification.status === action.classification
                        ? theme.colors.blue
                        : theme.colors.text,
                  },
                ]}
              >
                {isBusy ? 'Saving...' : action.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export const SupportScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <ScreenFrame
      title="Support"
      subtitle="Find the fastest way to get help with alerts, account access, and app issues."
    >
      <InfoCard
        title="Help options"
        copy="If something feels off, start here before an emergency moment becomes stressful. We can connect this page to chat, email, or a support form next."
        delay={110}
      />
      <InfoCard
        title="Common help topics"
        copy="Alert not starting, account login problems, live location concerns, trusted contact setup, and subscription questions."
        delay={170}
      />
      <MotionView delay={230}>
        <Pressable style={[styles.primaryButton, theme.shadow.glow]}>
          <Text style={styles.primaryButtonText}>Contact support</Text>
        </Pressable>
      </MotionView>
    </ScreenFrame>
  );
};

export const AboutScreen = () => {
  return (
    <ScreenFrame
      title="About"
      subtitle="A quick overview of what Sentinel Watchtower is built to do."
    >
      <InfoCard
        title="Mission"
        copy="Sentinel Watchtower focuses on faster emergency response, trusted-circle visibility, and calmer safety workflows during urgent moments."
        delay={110}
      />
      <InfoCard
        title="What this app includes"
        copy="Location-aware alerts, watch sessions, trusted contacts, account safety controls, and a cleaner emergency-first mobile experience."
        delay={170}
      />
      <InfoCard
        title="Version note"
        copy="This page is ready for real version metadata later if you want to surface build number and release details."
        delay={230}
      />
    </ScreenFrame>
  );
};

export const ReviewerDashboardScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { user, setUser } = useAppStore(
    (state) => ({
      user: state.user,
      setUser: state.setUser,
    }),
    shallow,
  );
  const roles = user?.roles || ['user'];
  const canReview = roles.includes('reviewer') || roles.includes('admin');
  const [filter, setFilter] = React.useState<ReviewerFilter>('pending');
  const [busyActionKey, setBusyActionKey] = React.useState<string | null>(null);

  const queueQuery = useQuery({
    queryKey: ['reviewer-queue', filter],
    enabled: canReview,
    queryFn: () => getReviewerQueue(filter),
  });

  const refreshRoleMutation = useMutation({
    mutationFn: getCurrentUser,
    onSuccess: (freshUser: Awaited<ReturnType<typeof getCurrentUser>>) => {
      setUser(freshUser);
    },
    onError: (error: unknown) => {
      Alert.alert(
        'Refresh failed',
        error instanceof Error ? error.message : 'Could not refresh your role right now.',
      );
    },
  });

  const classifyMutation = useMutation({
    mutationFn: async ({
      report,
      classification,
    }: {
      report: ReviewerQueueReport;
      classification: ReviewerClassification;
    }) => {
      const mapping = reviewerActions.find((item) => item.classification === classification);
      const nextActionKey = `${report.id}:${classification}`;
      setBusyActionKey(nextActionKey);

      return classifyReviewerReport(report.id, {
        classification,
        responseOutcome: mapping?.responseOutcome || 'pending',
        aiConfidence: report.classification.aiConfidence,
        qualityScore: report.classification.qualityScore,
        corroborationCount: report.classification.corroborationCount,
      });
    },
    onSuccess: async () => {
      await queueQuery.refetch();
    },
    onError: (error: unknown) => {
      Alert.alert(
        'Review failed',
        error instanceof Error ? error.message : 'Could not save this review right now.',
      );
    },
    onSettled: () => {
      setBusyActionKey(null);
    },
  });

  return (
    <ScreenFrame
      title="Reviewer Dashboard"
      subtitle="Triage incoming reports, verify trust signals, and keep the moderation queue moving."
    >
      {!canReview ? (
        <>
          <MotionView delay={110} style={[styles.card, theme.shadow.card]}>
            <Text style={styles.cardTitle}>Reviewer access required</Text>
            <Text style={styles.cardCopy}>
              This workspace unlocks once your account has the reviewer or admin role. If your
              request was just approved, refresh your account roles below.
            </Text>
            <Text style={styles.helperText}>
              Current status: {user?.reviewerRequest?.status ? titleCase(user.reviewerRequest.status) : 'No reviewer request yet'}
            </Text>
          </MotionView>

          <MotionView delay={170}>
            <Pressable
              onPress={() => refreshRoleMutation.mutate()}
              disabled={refreshRoleMutation.isPending}
              style={[styles.primaryButton, theme.shadow.glow, refreshRoleMutation.isPending && styles.buttonDisabled]}
            >
              <Text style={styles.primaryButtonText}>
                {refreshRoleMutation.isPending ? 'Refreshing...' : 'Refresh reviewer access'}
              </Text>
            </Pressable>
          </MotionView>
        </>
      ) : (
        <>
          <MotionView delay={110} style={styles.summaryRow}>
            <SummaryTile
              label="Pending"
              value={queueQuery.data?.summary.pendingReviewCount ?? 0}
              delay={110}
            />
            <SummaryTile
              label="Reviewed"
              value={queueQuery.data?.summary.reviewedCount ?? 0}
              delay={150}
            />
          </MotionView>

          <MotionView delay={190} style={styles.summaryRow}>
            <SummaryTile
              label="High Priority"
              value={queueQuery.data?.summary.highPriorityCount ?? 0}
              delay={190}
            />
            <SummaryTile
              label="Flagged"
              value={queueQuery.data?.summary.flaggedCount ?? 0}
              delay={230}
            />
          </MotionView>

          <MotionView delay={250} style={[styles.filterCard, theme.shadow.card]}>
            <Text style={styles.cardTitle}>Queue filter</Text>
            <View style={styles.filterWrap}>
              {reviewerFilters.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setFilter(option.value)}
                  style={[
                    styles.filterChip,
                    {
                      borderColor: filter === option.value ? theme.colors.blue : theme.colors.border,
                      backgroundColor:
                        filter === option.value ? theme.colors.blueSoft : theme.colors.surface,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      {
                        color: filter === option.value ? theme.colors.blue : theme.colors.text,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </MotionView>

          {queueQuery.isLoading ? (
            <MotionView delay={300} style={[styles.card, theme.shadow.card]}>
              <Text style={styles.cardTitle}>Loading moderation queue</Text>
              <Text style={styles.cardCopy}>
                Pulling the latest reports that need reviewer attention.
              </Text>
            </MotionView>
          ) : queueQuery.isError ? (
            <MotionView delay={300} style={[styles.card, theme.shadow.card]}>
              <Text style={styles.cardTitle}>Queue unavailable</Text>
              <Text style={styles.cardCopy}>
                {queueQuery.error instanceof Error
                  ? queueQuery.error.message
                  : 'The reviewer queue could not be loaded right now.'}
              </Text>
              <Pressable onPress={() => queueQuery.refetch()} style={[styles.primaryButton, styles.inlineButton]}>
                <Text style={styles.primaryButtonText}>Retry queue</Text>
              </Pressable>
            </MotionView>
          ) : queueQuery.data?.reports.length ? (
            <View style={styles.reviewList}>
              {queueQuery.data.reports.map((report: ReviewerQueueReport, index: number) => (
                <MotionView key={report.id} delay={300 + index * 40}>
                  <ReviewerReportCard
                    report={report}
                    busyActionKey={busyActionKey}
                    onClassify={(currentReport, classification) =>
                      classifyMutation.mutate({ report: currentReport, classification })
                    }
                  />
                </MotionView>
              ))}
            </View>
          ) : (
            <MotionView delay={300} style={[styles.card, theme.shadow.card]}>
              <Text style={styles.cardTitle}>Queue clear</Text>
              <Text style={styles.cardCopy}>
                No reports match the current filter right now. Switch filters or check back after
                new community reports arrive.
              </Text>
            </MotionView>
          )}
        </>
      )}
    </ScreenFrame>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 24,
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
      marginBottom: 10,
    },
    cardCopy: {
      color: theme.colors.muted,
      lineHeight: 20,
    },
    helperText: {
      color: theme.colors.muted,
      marginTop: 12,
      lineHeight: 19,
    },
    primaryButton: {
      minHeight: 50,
      borderRadius: 18,
      backgroundColor: theme.colors.blue,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    primaryButtonText: {
      color: theme.colors.text,
      fontWeight: '700',
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    inlineButton: {
      marginTop: 14,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    summaryTile: {
      flex: 1,
      minHeight: 104,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceStrong,
      padding: 16,
      justifyContent: 'center',
    },
    summaryValue: {
      color: theme.colors.text,
      fontSize: 30,
      fontWeight: '900',
    },
    summaryLabel: {
      color: theme.colors.muted,
      marginTop: 8,
      fontWeight: '600',
    },
    filterCard: {
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceStrong,
      padding: 18,
      marginBottom: 14,
    },
    filterWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    filterChip: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    filterChipText: {
      fontWeight: '700',
    },
    reviewList: {
      gap: 14,
    },
    reviewCard: {
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceStrong,
      padding: 18,
    },
    reviewCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 14,
    },
    tagPill: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    tagPillText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    reviewTitle: {
      color: theme.colors.text,
      fontSize: 19,
      fontWeight: '800',
      lineHeight: 24,
    },
    reviewDescription: {
      color: theme.colors.muted,
      marginTop: 8,
      lineHeight: 20,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 12,
    },
    metaText: {
      color: theme.colors.muted,
      lineHeight: 18,
    },
    metricRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
    },
    metricChip: {
      flex: 1,
      minHeight: 62,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 10,
      justifyContent: 'center',
    },
    metricLabel: {
      color: theme.colors.muted,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    metricValue: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
      marginTop: 4,
    },
    reviewedText: {
      color: theme.colors.muted,
      marginTop: 14,
      lineHeight: 18,
    },
    actionWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 16,
    },
    actionChip: {
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    actionChipText: {
      fontWeight: '700',
    },
  });
