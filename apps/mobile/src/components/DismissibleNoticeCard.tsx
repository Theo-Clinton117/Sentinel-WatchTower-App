import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useAppTheme } from '../theme';

type NoticeTone = 'info' | 'error' | 'success' | 'warning';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  tone?: NoticeTone;
  onDismiss: () => void;
  actionLabel?: string;
  onAction?: () => void;
};

export const DismissibleNoticeCard = ({
  visible,
  title,
  message,
  tone = 'error',
  onDismiss,
  actionLabel,
  onAction,
}: Props) => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme, tone), [theme, tone]);

  if (!visible) {
    return null;
  }

  const semanticTone = tone === 'error' ? 'danger' : tone;
  const accent = theme.semantic[semanticTone].solid;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityRole="button">
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <View style={styles.headerRow}>
            <View style={styles.iconRail}>
              <View style={[styles.dot, { backgroundColor: accent }]} />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>
            </View>
            <Pressable
              onPress={onDismiss}
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
            >
              <X color={theme.colors.text} size={16} strokeWidth={2.4} />
            </Pressable>
          </View>

          {(actionLabel && onAction) ? (
            <View style={styles.actionRow}>
              <Pressable
                onPress={onAction}
                style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
                accessibilityRole="button"
              >
                <Text style={styles.actionText}>{actionLabel}</Text>
              </Pressable>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>, tone: NoticeTone) => {
  const semanticTone = tone === 'error' ? 'danger' : tone;
  const accent = theme.semantic[semanticTone].solid;

  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: theme.colors.overlay,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 26,
      backgroundColor: theme.isDark ? 'rgba(10, 19, 34, 0.98)' : 'rgba(255,255,255,0.98)',
      borderWidth: 1,
      borderColor: theme.semantic[semanticTone].border,
      padding: 16,
      ...theme.shadow.card,
    },
    cardPressed: {
      transform: [{ scale: 0.995 }],
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    iconRail: {
      width: 38,
      height: 38,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.semantic[semanticTone].soft,
      borderWidth: 1,
      borderColor: theme.semantic[semanticTone].border,
      marginTop: 2,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      color: theme.colors.text,
      fontSize: 16,
      lineHeight: 21,
      fontWeight: '800',
      marginBottom: 4,
    },
    message: {
      color: theme.colors.muted,
      fontSize: 13,
      lineHeight: 19,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.backgroundElevated,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    closeButtonPressed: {
      opacity: 0.86,
      transform: [{ scale: 0.98 }],
    },
    actionRow: {
      marginTop: 14,
      alignItems: 'flex-end',
    },
    actionButton: {
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.blueSoft,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    actionButtonPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.98 }],
    },
    actionText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
  });
};
