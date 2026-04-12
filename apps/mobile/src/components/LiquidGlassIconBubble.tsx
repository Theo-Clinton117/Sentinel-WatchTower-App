import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../theme';

type Props = {
  active?: boolean;
  size?: number;
  children: React.ReactNode;
};

export const LiquidGlassIconBubble = ({ active = false, size = 44, children }: Props) => {
  const theme = useAppTheme();
  const styles = createStyles(theme, size);

  return (
    <View style={[styles.shell, active && styles.shellActive, theme.shadow.card]}>
      <LinearGradient
        colors={
          active
            ? theme.isDark
              ? ['rgba(171, 208, 255, 0.42)', 'rgba(29, 97, 255, 0.2)']
              : ['rgba(255, 255, 255, 0.95)', 'rgba(116, 173, 255, 0.38)']
            : theme.isDark
              ? ['rgba(255, 255, 255, 0.18)', 'rgba(49, 93, 158, 0.08)']
              : ['rgba(255, 255, 255, 0.88)', 'rgba(191, 220, 255, 0.42)']
        }
        style={styles.gradient}
      >
        <View style={styles.highlight} />
        <View style={styles.innerGlow} />
        <View style={styles.content}>{children}</View>
      </LinearGradient>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>, size: number) =>
  StyleSheet.create({
    shell: {
      width: size,
      height: size,
      borderRadius: size / 2,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(169, 204, 255, 0.18)' : 'rgba(255, 255, 255, 0.95)',
      backgroundColor: theme.isDark ? 'rgba(21, 38, 74, 0.34)' : 'rgba(255, 255, 255, 0.56)',
    },
    shellActive: {
      borderColor: theme.isDark ? 'rgba(151, 204, 255, 0.48)' : 'rgba(87, 156, 255, 0.54)',
    },
    gradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    highlight: {
      position: 'absolute',
      top: 3,
      left: 5,
      right: 5,
      height: size * 0.34,
      borderRadius: size / 2,
      backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.74)',
    },
    innerGlow: {
      position: 'absolute',
      bottom: -size * 0.08,
      width: size * 0.76,
      height: size * 0.44,
      borderRadius: size / 2,
      backgroundColor: theme.isDark ? 'rgba(64, 134, 255, 0.2)' : 'rgba(82, 154, 255, 0.18)',
    },
    content: {
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
