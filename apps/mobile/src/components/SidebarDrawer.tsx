import React from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { shallow } from 'zustand/shallow';
import { ProfileGlyph } from './ProfileGlyph';
import { Screen, useAppStore } from '../store/useAppStore';
import { useAppTheme } from '../theme';

const drawerItems: Array<{ label: string; screen: Screen; blurb: string }> = [
  {
    label: 'Settings',
    screen: 'settings',
    blurb: 'Control privacy, device management, and local data on this device.',
  },
  {
    label: 'Notifications',
    screen: 'notifications',
    blurb: 'See alert updates and trusted-contact activity delivered through Sentinel.',
  },
  {
    label: 'Reviewer Dashboard',
    screen: 'reviewer-dashboard',
    blurb: 'Review and manage user reports and credibility scores.',
  },
  {
    label: 'Subscriptions',
    screen: 'subscription',
    blurb: 'Manage your plan and premium safety features.',
  },
  {
    label: 'Support',
    screen: 'support',
    blurb: 'Get help with alerts, account access, and troubleshooting.',
  },
  {
    label: 'About',
    screen: 'about',
    blurb: 'Learn more about Sentinel Watchtower and the app version.',
  },
];

export const SidebarDrawer = () => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { sidebarOpen, closeSidebar, pushScreen, user } = useAppStore(
    (state) => ({
      sidebarOpen: state.sidebarOpen,
      closeSidebar: state.closeSidebar,
      pushScreen: state.pushScreen,
      user: state.user,
    }),
    shallow,
  );
  const slide = React.useRef(new Animated.Value(-320)).current;
  const fade = React.useRef(new Animated.Value(0)).current;
  const [isMounted, setIsMounted] = React.useState(sidebarOpen);

  React.useEffect(() => {
    if (sidebarOpen) {
      setIsMounted(true);
      Animated.parallel([
        Animated.timing(slide, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();

      return;
    }

    Animated.parallel([
      Animated.timing(slide, {
        toValue: -320,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setIsMounted(false);
      }
    });
  }, [fade, sidebarOpen, slide]);

  if (!isMounted) {
    return null;
  }

  const handleNavigate = (screen: Screen) => {
    closeSidebar();
    pushScreen(screen);
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.scrim, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeSidebar} />
      </Animated.View>

      <Animated.View
        style={[
          styles.drawerWrap,
          {
            transform: [{ translateX: slide }],
          },
        ]}
      >
        <View style={[styles.drawer, theme.shadow.card]}>
          <View style={styles.header}>
            <Pressable onPress={closeSidebar} style={styles.closeButton}>
              <ProfileGlyph name="chevron-left" size={18} color={theme.colors.text} />
            </Pressable>
            <Text style={styles.eyebrow}>MENU</Text>
            <Text style={styles.title}>Sentinel Watchtower</Text>
            <Text style={styles.userText}>
              {user?.name || user?.email || user?.phone || 'Safety account'}
            </Text>
          </View>

          <View style={styles.menuList}>
            {drawerItems.map((item, index) => (
              <Pressable
                key={item.label}
                onPress={() => handleNavigate(item.screen)}
                style={({ pressed }) => [
                  styles.menuItem,
                  index < drawerItems.length - 1 && styles.menuItemBorder,
                  pressed && styles.menuItemPressed,
                ]}
              >
                <View style={styles.menuCopy}>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Text style={styles.menuBlurb}>{item.blurb}</Text>
                </View>
                <ProfileGlyph name="chevron-right" size={18} color={theme.colors.muted} />
              </Pressable>
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    scrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(5, 10, 18, 0.28)',
    },
    drawerWrap: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
    },
    drawer: {
      width: 286,
      height: '100%',
      paddingTop: 26,
      paddingHorizontal: 18,
      paddingBottom: 24,
      backgroundColor: theme.colors.surfaceStrong,
      borderRightWidth: 1,
      borderRightColor: theme.colors.border,
    },
    header: {
      paddingBottom: 22,
    },
    closeButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    eyebrow: {
      color: theme.colors.blue,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.8,
      marginBottom: 10,
    },
    title: {
      color: theme.colors.text,
      fontSize: 25,
      fontWeight: '800',
      lineHeight: 31,
      marginBottom: 8,
    },
    userText: {
      color: theme.colors.muted,
      lineHeight: 20,
    },
    menuList: {
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      backgroundColor: theme.colors.backgroundElevated,
    },
    menuItem: {
      minHeight: 86,
      paddingHorizontal: 16,
      paddingVertical: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surfaceStrong,
      gap: 12,
    },
    menuItemBorder: {
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    menuItemPressed: {
      backgroundColor: theme.colors.blueSoft,
    },
    menuCopy: {
      flex: 1,
      gap: 4,
    },
    menuLabel: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    menuBlurb: {
      color: theme.colors.muted,
      lineHeight: 18,
    },
  });
