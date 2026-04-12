import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../theme';

type Props = {
  children: React.ReactNode;
};

export const ScreenCanvas = ({ children }: Props) => {
  const theme = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <LinearGradient colors={theme.gradients.appBackground} style={StyleSheet.absoluteFillObject} />
      <View
        style={[
          styles.orb,
          styles.orbTop,
          { backgroundColor: theme.colors.overlay, borderColor: theme.colors.border },
        ]}
      />
      <View
        style={[
          styles.orb,
          styles.orbBottom,
          { backgroundColor: theme.colors.blueSoft, opacity: theme.isDark ? 0.45 : 0.7 },
        ]}
      />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbTop: {
    width: 220,
    height: 220,
    top: -40,
    right: -60,
    borderWidth: 1,
  },
  orbBottom: {
    width: 180,
    height: 180,
    bottom: 120,
    left: -60,
  },
});
