import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme';

export const StatusIndicator = ({ status }: { status: 'safe' | 'active' }) => {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <View style={[styles.container, status === 'active' && styles.active]}>
      <View style={[styles.dot, status === 'active' && styles.dotActive]} />
      <Text style={styles.text}>{status === 'active' ? 'ALERT ACTIVE' : 'SAFE'}</Text>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    },
    active: {
      borderColor: theme.colors.red,
      backgroundColor: theme.gradients.emergency[0],
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.blueGlow,
      marginRight: 8,
    },
    dotActive: {
      backgroundColor: theme.colors.red,
    },
    text: {
      color: theme.colors.text,
      fontSize: 12,
      letterSpacing: 1.2,
      fontWeight: '700',
    },
  });
