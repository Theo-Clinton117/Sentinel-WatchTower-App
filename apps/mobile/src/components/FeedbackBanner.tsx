import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme';

type BannerTone = 'info' | 'error' | 'success' | 'warning';

type Props = {
  title?: string;
  message: string;
  tone?: BannerTone;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
};

export const FeedbackBanner = ({
  title,
  message,
  tone = 'info',
  loading = false,
  actionLabel,
  onAction,
}: Props) => {
  const theme = useAppTheme();
  const styles = createStyles(theme, tone);

  return (
    <View
      style={styles.wrap}
      accessibilityRole={tone === 'error' ? 'alert' : loading ? 'progressbar' : undefined}
      accessibilityLiveRegion={tone === 'error' ? 'polite' : 'none'}
    >
      <View style={styles.iconRail}>
        {loading ? <ActivityIndicator color={styles.accent.color} size="small" /> : <View style={styles.dot} />}
      </View>
      <View style={styles.copy}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        <Text style={styles.message}>{message}</Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          accessibilityRole="button"
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>, tone: BannerTone) => {
  const semanticTone = tone === 'error' ? 'danger' : tone;
  const accent = theme.semantic[semanticTone].solid;

  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 20,
      backgroundColor: theme.isDark ? 'rgba(12,21,38,0.9)' : 'rgba(255,255,255,0.94)',
      borderWidth: 1,
      borderColor: theme.semantic[semanticTone].border,
      borderLeftWidth: 4,
      borderLeftColor: accent,
    },
    iconRail: {
      width: 28,
      height: 28,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.backgroundElevated,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    dot: {
      width: 9,
      height: 9,
      borderRadius: 4.5,
      backgroundColor: accent,
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 17,
      marginBottom: 2,
    },
    message: {
      color: theme.colors.muted,
      fontSize: 12,
      lineHeight: 17,
      flexShrink: 1,
    },
    action: {
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.blueSoft,
    },
    actionPressed: {
      opacity: 0.82,
      transform: [{ scale: 0.98 }],
    },
    actionText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '800',
    },
    accent: {
      color: accent,
    },
  });
};
