import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../theme';

type Props = {
  eyebrow: string;
  title: string;
  caption: string;
  chipA: string;
  chipB: string;
};

export const AuthArtPanel = ({ eyebrow, title, caption, chipA, chipB }: Props) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.wrap}>
      <LinearGradient colors={theme.gradients.hero} style={styles.panel}>
        <View style={styles.chips}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{chipA}</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{chipB}</Text>
          </View>
        </View>

        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.caption}>{caption}</Text>

        <View style={styles.orbitWrap}>
          <View style={styles.orbitLarge} />
          <View style={styles.orbitMedium} />
          <View style={styles.orbitSmall} />
          <View style={styles.centerCard}>
            <Text style={styles.centerMini}>Sentinel</Text>
            <Text style={styles.centerTitle}>Protected network</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    wrap: {
      borderRadius: 30,
      overflow: 'hidden',
      marginBottom: 18,
      ...theme.shadow.card,
    },
    panel: {
      padding: 20,
      borderRadius: 30,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    chips: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
      flexWrap: 'wrap',
    },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    },
    chipText: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
    eyebrow: {
      color: theme.colors.blue,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    title: {
      color: theme.colors.text,
      fontSize: 26,
      fontWeight: '800',
      lineHeight: 31,
      marginBottom: 8,
    },
    caption: {
      color: theme.colors.muted,
      lineHeight: 20,
      marginBottom: 18,
    },
    orbitWrap: {
      minHeight: 120,
      justifyContent: 'center',
      alignItems: 'center',
    },
    orbitLarge: {
      position: 'absolute',
      width: 140,
      height: 140,
      borderRadius: 70,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      opacity: 0.6,
    },
    orbitMedium: {
      position: 'absolute',
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: theme.colors.blueSoft,
      opacity: theme.isDark ? 0.85 : 1,
    },
    orbitSmall: {
      position: 'absolute',
      top: 10,
      right: 44,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: theme.colors.blueGlow,
    },
    centerCard: {
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderRadius: 18,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    centerMini: {
      color: theme.colors.blue,
      fontSize: 11,
      fontWeight: '800',
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    centerTitle: {
      color: theme.colors.text,
      fontWeight: '700',
    },
  });
