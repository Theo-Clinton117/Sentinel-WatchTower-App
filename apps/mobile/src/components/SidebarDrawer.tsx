import React from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Bell,
  Building2,
  ChevronRight,
  CreditCard,
  HelpCircle,
  Info,
  LucideIcon,
  Settings2,
  ShieldCheck,
} from 'lucide-react-native';
import { shallow } from 'zustand/shallow';
import { ProfileGlyph } from './ProfileGlyph';
import { Screen, useAppStore } from '../store/useAppStore';
import { useAppTheme } from '../theme';

const CLOSE_SWIPE_DISTANCE = 72;
const CLOSE_SWIPE_VELOCITY = -0.5;

const drawerItems: Array<{
  label: string;
  screen: Screen;
  section: 'Account' | 'Operations' | 'Help';
  icon: LucideIcon;
  roles?: Array<'admin' | 'reviewer'>;
}> = [
  {
    label: 'Settings',
    screen: 'settings',
    section: 'Account',
    icon: Settings2,
  },
  {
    label: 'Organizations',
    screen: 'organizations',
    section: 'Account',
    icon: Building2,
  },
  {
    label: 'Notifications',
    screen: 'notifications',
    section: 'Account',
    icon: Bell,
  },
  {
    label: 'Subscriptions',
    screen: 'subscription',
    section: 'Account',
    icon: CreditCard,
  },
  {
    label: 'Reviewer Dashboard',
    screen: 'reviewer-dashboard',
    section: 'Operations',
    icon: ShieldCheck,
    roles: ['admin', 'reviewer'],
  },
  {
    label: 'Support',
    screen: 'support',
    section: 'Help',
    icon: HelpCircle,
  },
  {
    label: 'About',
    screen: 'about',
    section: 'Help',
    icon: Info,
  },
];

type Props = {
  drawerWidth: number;
  gestureActive?: boolean;
  gestureProgress?: Animated.Value;
};

export const SidebarDrawer = ({
  drawerWidth,
  gestureActive = false,
  gestureProgress,
}: Props) => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { currentScreen, sidebarOpen, closeSidebar, pushScreen, user } = useAppStore(
    (state) => ({
      currentScreen: state.currentScreen,
      sidebarOpen: state.sidebarOpen,
      closeSidebar: state.closeSidebar,
      pushScreen: state.pushScreen,
      user: state.user,
    }),
    shallow,
  );
  const slide = React.useRef(new Animated.Value(-drawerWidth)).current;
  const fade = React.useRef(new Animated.Value(0)).current;
  const closeGestureX = React.useRef(new Animated.Value(0)).current;
  const closeGestureActive = React.useRef(false);
  const [isMounted, setIsMounted] = React.useState(sidebarOpen || gestureActive);

  React.useEffect(() => {
    if (gestureActive) {
      setIsMounted(true);
      return;
    }

    if (sidebarOpen) {
      setIsMounted(true);
      Animated.parallel([
        Animated.timing(slide, {
          toValue: 0,
          duration: 220,
          useNativeDriver: false,
        }),
        Animated.timing(fade, {
          toValue: 1,
          duration: 220,
          useNativeDriver: false,
        }),
      ]).start();

      return;
    }

    Animated.parallel([
      Animated.timing(slide, {
        toValue: -drawerWidth,
        duration: 180,
        useNativeDriver: false,
      }),
      Animated.timing(fade, {
        toValue: 0,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setIsMounted(false);
      }
    });
  }, [drawerWidth, fade, gestureActive, sidebarOpen, slide]);

  const gestureSlide =
    gestureProgress?.interpolate({
      inputRange: [0, 1],
      outputRange: [-drawerWidth, 0],
      extrapolate: 'clamp',
    }) ?? slide;
  const gestureFade =
    gestureProgress?.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }) ?? fade;
  const drawerTranslateX = gestureActive ? gestureSlide : slide;
  const closeTranslateX = closeGestureX.interpolate({
    inputRange: [-drawerWidth, 0],
    outputRange: [-drawerWidth, 0],
    extrapolate: 'clamp',
  });
  const scrimOpacity = gestureActive ? gestureFade : fade;

  const closePanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) => {
          if (!sidebarOpen) {
            return false;
          }

          const horizontalIntent = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.35;
          return gestureState.dx < -14 && horizontalIntent;
        },
        onPanResponderGrant: () => {
          closeGestureActive.current = true;
          closeGestureX.stopAnimation();
          closeGestureX.setValue(0);
        },
        onPanResponderMove: (_event, gestureState) => {
          closeGestureX.setValue(Math.min(0, gestureState.dx));
        },
        onPanResponderRelease: (_event, gestureState) => {
          const shouldClose =
            gestureState.dx <= -CLOSE_SWIPE_DISTANCE ||
            gestureState.vx <= CLOSE_SWIPE_VELOCITY;

          Animated.timing(closeGestureX, {
            toValue: shouldClose ? -drawerWidth : 0,
            duration: shouldClose ? 120 : 160,
            useNativeDriver: false,
          }).start(() => {
            closeGestureActive.current = false;
            closeGestureX.setValue(0);
            if (shouldClose) {
              closeSidebar();
            }
          });
        },
        onPanResponderTerminate: () => {
          Animated.timing(closeGestureX, {
            toValue: 0,
            duration: 160,
            useNativeDriver: false,
          }).start(() => {
            closeGestureActive.current = false;
            closeGestureX.setValue(0);
          });
        },
      }),
    [closeGestureX, closeSidebar, drawerWidth, sidebarOpen],
  );

  if (!isMounted) {
    return null;
  }

  const visibleItems = drawerItems.filter((item) => {
    if (!item.roles?.length) {
      return true;
    }

    const roles = user?.roles || [];
    return item.roles.some((role) => roles.includes(role));
  });
  const sectionedItems = visibleItems.reduce<Array<{ section: string; items: typeof visibleItems }>>(
    (groups, item) => {
      const existing = groups.find((group) => group.section === item.section);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.push({ section: item.section, items: [item] });
      }
      return groups;
    },
    [],
  );
  const displayName = user?.name || user?.email || user?.phone || 'Safety account';
  const initial = displayName.trim().slice(0, 1).toUpperCase() || 'S';

  const handleNavigate = (screen: Screen) => {
    closeSidebar();
    pushScreen(screen);
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.scrim, { opacity: scrimOpacity }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeSidebar}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />
      </Animated.View>

      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.drawerWrap,
          {
            transform: [
              { translateX: drawerTranslateX },
              { translateX: closeTranslateX },
            ],
          },
        ]}
      >
        <View style={[styles.drawer, theme.shadow.card]} {...closePanResponder.panHandlers}>
          <View style={{ width: drawerWidth, flex: 1 }}>
            <View style={styles.header}>
              <View style={styles.headerTop}>
                <Text style={styles.eyebrow}>MENU</Text>
                <Pressable
                  onPress={closeSidebar}
                  style={styles.closeButton}
                  accessibilityRole="button"
                  accessibilityLabel="Close menu"
                >
                  <ProfileGlyph name="chevron-left" size={18} color={theme.colors.text} />
                </Pressable>
              </View>
              <Text style={styles.title}>Watchtower</Text>
              <View style={styles.accountPill}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
                <Text style={styles.userText}>
                  {displayName}
                </Text>
              </View>
            </View>

            {sectionedItems.map((group) => (
              <View key={group.section} style={styles.section}>
                <Text style={styles.sectionLabel}>{group.section}</Text>
                <View style={styles.menuList}>
                  {group.items.map((item, index) => {
                    const Icon = item.icon;
                    const active = currentScreen === item.screen;

                    return (
                      <Pressable
                        key={item.label}
                        onPress={() => handleNavigate(item.screen)}
                        style={({ pressed }) => [
                          styles.menuItem,
                          active && styles.menuItemActive,
                          index < group.items.length - 1 && styles.menuItemBorder,
                          pressed && styles.menuItemPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={item.label}
                        accessibilityState={{ selected: active }}
                      >
                        <View style={styles.menuCopy}>
                          <View style={[styles.menuIcon, active && styles.menuIconActive]}>
                            <Icon
                              color={active ? theme.colors.blue : theme.colors.muted}
                              size={18}
                              strokeWidth={2.2}
                            />
                          </View>
                          <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>
                            {item.label}
                          </Text>
                        </View>
                        <ChevronRight size={17} color={theme.colors.muted} strokeWidth={2.2} />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
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
      height: '100%',
      paddingTop: 24,
      paddingHorizontal: 16,
      paddingBottom: 24,
      backgroundColor: theme.isDark ? 'rgba(11,20,35,0.96)' : 'rgba(255,255,255,0.96)',
      borderRightWidth: 1,
      borderRightColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,21,38,0.06)',
      borderTopRightRadius: 32,
      borderBottomRightRadius: 32,
    },
    header: {
      paddingBottom: 18,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(12,21,38,0.08)',
      backgroundColor: theme.colors.backgroundElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eyebrow: {
      color: theme.colors.blue,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.4,
    },
    title: {
      color: theme.colors.text,
      fontSize: 24,
      fontWeight: '800',
      lineHeight: 30,
      marginBottom: 12,
    },
    accountPill: {
      minHeight: 46,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(12,21,38,0.08)',
      backgroundColor: theme.colors.backgroundElevated,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 10,
    },
    avatar: {
      width: 30,
      height: 30,
      borderRadius: 12,
      backgroundColor: theme.colors.blueSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    userText: {
      color: theme.colors.muted,
      flex: 1,
      fontWeight: '700',
      lineHeight: 20,
      flexShrink: 1,
    },
    section: {
      marginBottom: 16,
    },
    sectionLabel: {
      color: theme.colors.muted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    menuList: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(12,21,38,0.08)',
      overflow: 'hidden',
      backgroundColor: theme.colors.backgroundElevated,
    },
    menuItem: {
      minHeight: 58,
      paddingHorizontal: 12,
      paddingVertical: 11,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.8)',
      gap: 10,
    },
    menuItemBorder: {
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    menuItemPressed: {
      backgroundColor: theme.isDark ? 'rgba(42,115,255,0.18)' : 'rgba(42,115,255,0.08)',
    },
    menuItemActive: {
      backgroundColor: theme.isDark ? 'rgba(42,115,255,0.18)' : 'rgba(42,115,255,0.1)',
    },
    menuCopy: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 10,
      minWidth: 0,
    },
    menuIcon: {
      width: 32,
      height: 32,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.backgroundElevated,
    },
    menuIconActive: {
      backgroundColor: theme.colors.surface,
    },
    menuLabel: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '800',
      flex: 1,
      lineHeight: 20,
      flexShrink: 1,
    },
    menuLabelActive: {
      color: theme.colors.blue,
    },
  });
