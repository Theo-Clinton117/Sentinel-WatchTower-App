import React from 'react';
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';
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

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <SafeAreaView pointerEvents="box-none" style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.iconRail}>
              <AlertTriangle color="#EAB308" size={16} strokeWidth={2.5} />
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
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>, tone: NoticeTone) => {
  const semanticTone = tone === 'error' ? 'danger' : tone;
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      alignSelf: 'center',
      borderRadius: 26,
      backgroundColor: theme.isDark ? 'rgba(10, 19, 34, 0.98)' : 'rgba(255,255,255,0.98)',
      borderWidth: 1,
      borderColor: theme.semantic[semanticTone].border,
      padding: 16,
      ...theme.shadow.card,
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
