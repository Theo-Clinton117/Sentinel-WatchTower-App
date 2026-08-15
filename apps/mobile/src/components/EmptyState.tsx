import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { useAppTheme } from '../theme';

type Props = {
  title: string;
  message: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
};

export const EmptyState = ({ title, message, icon: Icon, actionLabel, onAction }: Props) => {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.wrap}>
      {Icon ? (
        <View style={styles.iconWrap}>
          <Icon color={theme.colors.blue} size={20} strokeWidth={2.25} />
        </View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
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

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    wrap: {
      alignItems: 'center',
      padding: 18,
      borderRadius: 22,
      backgroundColor: theme.isDark ? 'rgba(12,21,38,0.9)' : 'rgba(255,255,255,0.94)',
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,21,38,0.06)',
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.blueSoft,
      marginBottom: 12,
    },
    title: {
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: '800',
      lineHeight: 22,
      marginBottom: 6,
      textAlign: 'center',
    },
    message: {
      color: theme.colors.muted,
      lineHeight: 19,
      textAlign: 'center',
      maxWidth: 280,
    },
    action: {
      minHeight: 42,
      paddingHorizontal: 14,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.blue,
      marginTop: 12,
    },
    actionPressed: {
      opacity: 0.86,
      transform: [{ scale: 0.98 }],
    },
    actionText: {
      color: '#FFFFFF',
      fontWeight: '800',
    },
  });
