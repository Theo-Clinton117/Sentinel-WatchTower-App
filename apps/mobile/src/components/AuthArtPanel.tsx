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

        <View style={styles.networkGrid}>
          <View style={[styles.networkTile, styles.networkTileAccent]}>
            <Text style={styles.tileValue}>{chipA}</Text>
            <Text style={styles.tileLabel}>Status lane</Text>
          </View>
          <View style={styles.networkTile}>
            <Text style={styles.tileValue}>{chipB}</Text>
            <Text style={styles.tileLabel}>Coverage lane</Text>
          </View>
          <View style={styles.networkTile}>
            <Text style={styles.tileValue}>24/7</Text>
            <Text style={styles.tileLabel}>Monitoring</Text>
          </View>
          <View style={styles.networkTile}>
            <Text style={styles.tileValue}>Live</Text>
            <Text style={styles.tileLabel}>Routing</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    wrap: {
      borderRadius: 24,
      overflow: 'hidden',
      marginBottom: 18,
      ...theme.shadow.card,
    },
    panel: {
      padding: 22,
      borderRadius: 24,
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
      borderRadius: 12,
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
    networkGrid: {
      marginTop: 4,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    networkTile: {
      width: '48%',
      minHeight: 78,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: 'space-between',
    },
    networkTileAccent: {
      backgroundColor: theme.colors.blueSoft,
      borderColor: theme.colors.blueGlow,
    },
    tileValue: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 22,
    },
    tileLabel: {
      color: theme.colors.muted,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
  });
