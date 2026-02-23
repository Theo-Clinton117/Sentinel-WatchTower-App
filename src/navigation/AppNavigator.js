import React from "react";
import { useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createDrawerNavigator } from "@react-navigation/drawer";
import {
  colors,
  getDeviceCategory,
  getResponsiveMetrics,
} from "../theme/responsive";
import { HomeScreen } from "../screens/HomeScreen";
import { RiskLogScreen } from "../screens/RiskLogScreen";
import { AccountScreen } from "../screens/AccountScreen";
import { DrawerPageScreen } from "../screens/DrawerPageScreen";

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

function HomeDrawerNavigator() {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        sceneContainerStyle: { backgroundColor: colors.bg },
        drawerStyle: { backgroundColor: colors.panel },
        drawerActiveTintColor: colors.accent,
        drawerInactiveTintColor: colors.text,
      }}
    >
      <Drawer.Screen
        name="HomeMain"
        component={HomeScreen}
        options={{ title: "Home" }}
      />
      <Drawer.Screen
        name="SafetyFeed"
        component={DrawerPageScreen}
        initialParams={{
          title: "Safety Feed",
          subtitle: "See active safety advisories and location-based broadcasts.",
        }}
        options={{ title: "Safety Feed" }}
      />
      <Drawer.Screen
        name="WatchHistory"
        component={DrawerPageScreen}
        initialParams={{
          title: "Watch History",
          subtitle: "Review prior events, acknowledgements, and response outcomes.",
        }}
        options={{ title: "Watch History" }}
      />
      <Drawer.Screen
        name="Settings"
        component={DrawerPageScreen}
        initialParams={{
          title: "Settings",
          subtitle: "Adjust thresholds, channels, and alert routing preferences.",
        }}
        options={{ title: "Settings" }}
      />
    </Drawer.Navigator>
  );
}

function getTabIcon(routeName, focused, size) {
  if (routeName === "Home") {
    return <Ionicons name={focused ? "home" : "home-outline"} size={size} color={focused ? colors.accent : colors.muted} />;
  }
  if (routeName === "Risk Log") {
    return (
      <Ionicons
        name={focused ? "list-circle" : "list-circle-outline"}
        size={size}
        color={focused ? colors.accent : colors.muted}
      />
    );
  }
  return (
    <Ionicons
      name={focused ? "person" : "person-outline"}
      size={size}
      color={focused ? colors.accent : colors.muted}
    />
  );
}

export function AppNavigator() {
  const { width, height } = useWindowDimensions();
  const category = getDeviceCategory(width, height);
  const metrics = getResponsiveMetrics(category);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          height: category === "tablet" ? 84 : 68,
          paddingTop: 6,
          paddingBottom: category === "tablet" ? 10 : 8,
        },
        tabBarLabelStyle: {
          fontSize: Math.max(12, metrics.bodySize - 3),
          fontWeight: "600",
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarIcon: ({ focused, size }) => getTabIcon(route.name, focused, size),
      })}
    >
      <Tab.Screen name="Home" component={HomeDrawerNavigator} />
      <Tab.Screen name="Risk Log" component={RiskLogScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}
