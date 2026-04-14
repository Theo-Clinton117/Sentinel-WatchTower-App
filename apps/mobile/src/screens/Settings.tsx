import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MotionView } from '../components/MotionView';
import { ThemePreference, useAppStore } from '../store/useAppStore';
import { useAppTheme } from '../theme';

export const SettingsScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { clearAuthSession, setThemePreference, themePreference, user } = useAppStore();
  const modes: ThemePreference[] = ['system', 'light', 'dark'];

  return (
    <View style={styles.container}>
      <MotionView delay={40}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Control the app appearance and the account currently active on this device.</Text>
      </MotionView>
      <MotionView delay={120} style={[styles.profileCard, theme.shadow.card]}>
        <Text style={styles.profileLabel}>Signed in as</Text>
        <Text style={styles.profileValue}>{user?.name || user?.email || user?.phone || 'Unknown user'}</Text>
        {user?.email ? <Text style={styles.profileMeta}>{user.email}</Text> : null}
      </MotionView>
      <MotionView delay={180} style={[styles.themeCard, theme.shadow.card]}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.modeRow}>
          {modes.map((mode) => {
            const active = themePreference === mode;

            return (
              <Pressable
                key={mode}
                onPress={() => setThemePreference(mode)}
                style={[styles.modeChip, active && styles.modeChipActive]}
              >
                <Text style={[styles.modeText, active && styles.modeTextActive]}>
                  {mode === 'system' ? 'System' : mode === 'light' ? 'Light' : 'Dark'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </MotionView>
      <MotionView delay={240}>
        <Pressable style={styles.item}>
          <Text style={styles.itemText}>Privacy Controls</Text>
        </Pressable>
        <Pressable style={styles.item}>
          <Text style={styles.itemText}>Device Management</Text>
        </Pressable>
        <Pressable style={styles.item}>
          <Text style={styles.itemText}>Delete My Data</Text>
        </Pressable>
      </MotionView>
      <MotionView delay={300}>
        <Pressable style={styles.logout} onPress={clearAuthSession}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>
      </MotionView>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      backgroundColor: 'transparent',
    },
    title: {
      color: theme.colors.text,
      fontSize: 28,
      fontWeight: '800',
      marginBottom: 8,
    },
    subtitle: {
      color: theme.colors.muted,
      lineHeight: 20,
      marginBottom: 16,
    },
    profileCard: {
      padding: 18,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      marginBottom: 14,
    },
    profileLabel: {
      color: theme.colors.muted,
      fontSize: 12,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    profileValue: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '800',
    },
    profileMeta: {
      color: theme.colors.muted,
      marginTop: 4,
    },
    themeCard: {
      padding: 18,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      marginBottom: 14,
    },
    sectionTitle: {
      color: theme.colors.text,
      fontWeight: '700',
      fontSize: 16,
      marginBottom: 12,
    },
    modeRow: {
      flexDirection: 'row',
      gap: 10,
    },
    modeChip: {
      flex: 1,
      minHeight: 46,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modeChipActive: {
      backgroundColor: theme.colors.blueSoft,
      borderColor: theme.colors.blueGlow,
    },
    modeText: {
      color: theme.colors.muted,
      fontWeight: '700',
    },
    modeTextActive: {
      color: theme.colors.text,
    },
    item: {
      padding: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      marginBottom: 12,
      ...theme.shadow.card,
    },
    itemText: {
      color: theme.colors.text,
      fontWeight: '600',
    },
    logout: {
      marginTop: 8,
      padding: 15,
      borderRadius: 18,
      backgroundColor: theme.gradients.emergency[0],
      borderWidth: 1,
      borderColor: theme.colors.red,
      alignItems: 'center',
    },
    logoutText: {
      color: theme.colors.text,
      fontWeight: '700',
    },
  });
