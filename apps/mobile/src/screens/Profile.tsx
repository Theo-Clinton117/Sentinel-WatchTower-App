import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { shallow } from 'zustand/shallow';
import { MotionView } from '../components/MotionView';
import { ProfileGlyph, ProfileGlyphName } from '../components/ProfileGlyph';
import { getCurrentUser } from '../services/users';
import { AppUser, Screen, useAppStore } from '../store/useAppStore';
import { useAppTheme } from '../theme';

const accountItems: Array<{ label: string; icon: ProfileGlyphName; screen: Screen }> = [
  { label: 'Personal info', icon: 'user', screen: 'profile-personal-info' },
  { label: 'Family profile', icon: 'users', screen: 'profile-family' },
  { label: 'Organizations', icon: 'building-2', screen: 'organizations' },
  { label: 'Safety', icon: 'shield', screen: 'profile-safety' },
  { label: 'Login & security', icon: 'lock', screen: 'profile-login-security' },
  { label: 'Privacy', icon: 'eye-off', screen: 'profile-privacy' },
];

const MenuRow = ({
  icon,
  label,
  onPress,
  isLast = false,
}: {
  icon: ProfileGlyphName;
  label: string;
  onPress: () => void;
  isLast?: boolean;
}) => {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        !isLast && styles.menuRowBorder,
        pressed && styles.menuRowPressed,
      ]}
    >
      <View style={styles.menuLabelWrap}>
        <View style={styles.menuIconWrap}>
          <ProfileGlyph name={icon} size={19} color={theme.colors.muted} />
        </View>
        <Text style={styles.menuLabel}>{label}</Text>
      </View>
      <ProfileGlyph name="chevron-right" size={20} color={theme.colors.muted} />
    </Pressable>
  );
};

const resolveDisplayName = (user?: AppUser | null) =>
  user?.name || user?.email || user?.phone || 'Sentinel member';

const resolveProfileRating = (score?: number | null) => {
  if (typeof score !== 'number') {
    return '4.92';
  }

  return Math.max(4.1, Math.min(4.99, 4 + score / 100)).toFixed(2);
};

export const ProfileScreen = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { pushScreen, savedPlaces, user, setUser } = useAppStore(
    (state) => ({
      pushScreen: state.pushScreen,
      savedPlaces: state.savedPlaces,
      user: state.user,
      setUser: state.setUser,
    }),
    shallow,
  );
  const [isRefreshingUser, setIsRefreshingUser] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    const hydrateProfile = async () => {
      try {
        setIsRefreshingUser(true);
        const freshUser = await getCurrentUser();
        if (active) {
          setUser(freshUser);
        }
      } catch {
        // Keep the last hydrated session user when the refresh call is unavailable.
      } finally {
        if (active) {
          setIsRefreshingUser(false);
        }
      }
    };

    void hydrateProfile();

    return () => {
      active = false;
    };
  }, [setUser]);

  const displayName = resolveDisplayName(user);
  const profileRating = resolveProfileRating(user?.credibility?.score);
  const savedPlaceCount =
    Number(Boolean(savedPlaces.home?.addressLine)) + Number(Boolean(savedPlaces.work?.addressLine));
  const savedPlaceItems: Array<{ label: string; icon: ProfileGlyphName; screen: Screen }> = [
    {
      label: savedPlaces.home?.addressLine ? 'Home address' : 'Add home address',
      icon: 'home',
      screen: 'profile-home-address',
    },
    {
      label: savedPlaces.work?.addressLine ? 'Work address' : 'Add work address',
      icon: 'briefcase',
      screen: 'profile-work-address',
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <MotionView delay={40} style={styles.heroBlock}>
        <View style={[styles.heroSurface, theme.shadow.card]}>
          <View style={styles.heroTopRow}>
            <View style={styles.avatar}>
              <ProfileGlyph name="user" size={34} color={theme.colors.blue} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroLabel}>Account</Text>
              <Text style={styles.name}>{displayName}</Text>
              <View style={styles.ratingRow}>
                <ProfileGlyph name="star" size={16} color={theme.colors.success} />
                <Text style={styles.ratingValue}>{profileRating}</Text>
                <Text style={styles.ratingLabel}>Rating</Text>
              </View>
            </View>
          </View>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{profileRating}</Text>
              <Text style={styles.heroStatLabel}>Score</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{savedPlaceCount}</Text>
              <Text style={styles.heroStatLabel}>Saved</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{accountItems.length}</Text>
              <Text style={styles.heroStatLabel}>Sections</Text>
            </View>
          </View>
        </View>
      </MotionView>

      <MotionView delay={100}>
        <Pressable
          onPress={() => pushScreen('profile-personal-info')}
          style={({ pressed }) => [
            styles.verificationCard,
            pressed && styles.verificationCardPressed,
            theme.shadow.card,
          ]}
        >
          <View style={styles.verificationIcon}>
            <ProfileGlyph name="shield" size={22} color={theme.colors.success} />
          </View>
          <View style={styles.verificationTextWrap}>
            <Text style={styles.verificationTitle}>
              Keep your details ready before you need help
            </Text>
            <Text style={styles.verificationMeta}>Check your name, phone, and email so trusted people can recognize you quickly.</Text>
          </View>
        </Pressable>
      </MotionView>

      <MotionView delay={150} style={[styles.menuCard, theme.shadow.card]}>
        {accountItems.map((item, index) => (
          <MenuRow
            key={item.label}
            icon={item.icon}
            label={item.label}
            onPress={() => pushScreen(item.screen)}
            isLast={index === accountItems.length - 1}
          />
        ))}
      </MotionView>

      <MotionView delay={210} style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Saved places</Text>
      </MotionView>

      <MotionView delay={240} style={[styles.menuCard, theme.shadow.card]}>
        {savedPlaceItems.map((item, index) => (
          <MenuRow
            key={item.label}
            icon={item.icon}
            label={item.label}
            onPress={() => pushScreen(item.screen)}
            isLast={index === savedPlaceItems.length - 1}
          />
        ))}
      </MotionView>

      <MotionView delay={300}>
        <Text style={styles.footerText}>
          {isRefreshingUser
            ? 'Refreshing your account details...'
            : user?.email || user?.phone || 'Signed in on this device'}
        </Text>
      </MotionView>
    </ScrollView>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 28,
      paddingBottom: 132,
    },
    heroBlock: {
      marginBottom: 18,
    },
    heroSurface: {
      padding: 18,
      borderRadius: 30,
      backgroundColor: theme.isDark ? 'rgba(10,20,35,0.92)' : 'rgba(255,255,255,0.95)',
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,21,38,0.06)',
      gap: 14,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    heroCopy: {
      flex: 1,
      minWidth: 0,
    },
    heroLabel: {
      color: theme.colors.blue,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 1.1,
      marginBottom: 4,
    },
    heroStatsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    avatar: {
      width: 86,
      height: 86,
      borderRadius: 28,
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(29,103,255,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '800',
      lineHeight: 26,
      marginBottom: 6,
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    ratingValue: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    ratingLabel: {
      color: theme.colors.muted,
      fontSize: 12,
      fontWeight: '700',
    },
    heroStat: {
      flex: 1,
      minHeight: 58,
      borderRadius: 20,
      backgroundColor: theme.colors.backgroundElevated,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,21,38,0.06)',
      paddingHorizontal: 12,
      paddingVertical: 10,
      justifyContent: 'center',
    },
    heroStatValue: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '900',
      lineHeight: 20,
    },
    heroStatLabel: {
      color: theme.colors.muted,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: 2,
    },
    verificationCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 18,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(67,201,139,0.20)' : 'rgba(43,174,115,0.14)',
      backgroundColor: theme.isDark ? 'rgba(67,201,139,0.10)' : 'rgba(232,246,237,0.9)',
      marginBottom: 16,
    },
    verificationCardPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.99 }],
    },
    verificationIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.7)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    verificationTextWrap: {
      flex: 1,
      gap: 4,
      minWidth: 0,
    },
    verificationTitle: {
      color: theme.isDark ? '#F0FFF7' : '#173925',
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 24,
    },
    verificationMeta: {
      color: theme.isDark ? 'rgba(240,255,247,0.76)' : '#50725C',
      lineHeight: 18,
    },
    menuCard: {
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,21,38,0.06)',
      backgroundColor: theme.colors.backgroundElevated,
      overflow: 'hidden',
      marginBottom: 18,
    },
    menuRow: {
      minHeight: 68,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.backgroundElevated,
    },
    menuRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(12,21,38,0.05)',
    },
    menuRowPressed: {
      backgroundColor: theme.colors.blueSoft,
    },
    menuLabelWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      flex: 1,
      minWidth: 0,
    },
    menuIconWrap: {
      width: 28,
      alignItems: 'center',
    },
    menuLabel: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 22,
      flexShrink: 1,
    },
    sectionHeader: {
      marginBottom: 10,
    },
    sectionTitle: {
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: '800',
    },
    footerText: {
      color: theme.colors.muted,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
