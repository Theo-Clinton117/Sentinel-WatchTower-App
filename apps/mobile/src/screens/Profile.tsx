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
  { label: 'Safety', icon: 'shield', screen: 'profile-safety' },
  { label: 'Login & security', icon: 'lock', screen: 'profile-login-security' },
  { label: 'Privacy', icon: 'eye-off', screen: 'profile-privacy' },
];

const savedPlaceItems: Array<{ label: string; icon: ProfileGlyphName; screen: Screen }> = [
  { label: 'Add home address', icon: 'home', screen: 'profile-home-address' },
  { label: 'Add work address', icon: 'briefcase', screen: 'profile-work-address' },
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
  const { pushScreen, user, setUser } = useAppStore(
    (state) => ({
      pushScreen: state.pushScreen,
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <MotionView delay={40} style={styles.heroBlock}>
        <View style={styles.avatar}>
          <ProfileGlyph name="user" size={34} color={theme.colors.muted} />
        </View>
        <Text style={styles.name}>{displayName}</Text>
        <View style={styles.ratingRow}>
          <ProfileGlyph name="star" size={16} color={theme.colors.success} />
          <Text style={styles.ratingValue}>{profileRating}</Text>
          <Text style={styles.ratingLabel}>Rating</Text>
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
              Complete your verification for smoother access and safer alerts
            </Text>
            <Text style={styles.verificationMeta}>Review your account details and keep your identity ready.</Text>
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
      alignItems: 'center',
      paddingTop: 10,
      marginBottom: 22,
    },
    avatar: {
      width: 86,
      height: 86,
      borderRadius: 43,
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : '#F1F4FA',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    name: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: 8,
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
      fontSize: 16,
    },
    verificationCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 18,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(67,201,139,0.28)' : '#D1E8D8',
      backgroundColor: theme.isDark ? 'rgba(67,201,139,0.14)' : '#E8F6ED',
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
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    verificationTextWrap: {
      flex: 1,
      gap: 4,
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
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceStrong,
      overflow: 'hidden',
      marginBottom: 18,
    },
    menuRow: {
      minHeight: 68,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surfaceStrong,
    },
    menuRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    menuRowPressed: {
      backgroundColor: theme.colors.blueSoft,
    },
    menuLabelWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      flex: 1,
    },
    menuIconWrap: {
      width: 24,
      alignItems: 'center',
    },
    menuLabel: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '600',
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
