import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme';

export const StatusIndicator = ({ status }: { status: 'safe' | 'armed' | 'active' }) => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const isActive = status === 'active';
  const isArmed = status === 'armed';

  return (
    <View style={[styles.container, isArmed && styles.armed, isActive && styles.active]}>
      <View style={[styles.dot, isArmed && styles.dotArmed, isActive && styles.dotActive]} />
      <Text style={styles.text}>
        {isActive ? 'ALERT ACTIVE' : isArmed ? 'GUARD ARMED' : 'SAFE'}
      </Text>
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
    armed: {
      borderColor: theme.colors.blue,
      backgroundColor: theme.colors.blueSoft,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.blueGlow,
      marginRight: 8,
    },
    dotArmed: {
      backgroundColor: theme.colors.blue,
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
