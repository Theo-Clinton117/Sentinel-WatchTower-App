import React from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import {
  colors,
  getDeviceCategory,
  getResponsiveMetrics,
} from "../theme/responsive";

export function PlaceholderScreen({ title, subtitle }) {
  const { width, height } = useWindowDimensions();
  const category = getDeviceCategory(width, height);
  const metrics = getResponsiveMetrics(category);

  return (
    <View style={[styles.container, { padding: metrics.padding * 1.25 }]}>
      <View style={[styles.card, { borderRadius: metrics.radius * 1.3 }]}>
        <Text style={[styles.title, { fontSize: metrics.titleSize }]}>{title}</Text>
        <Text style={[styles.subtitle, { fontSize: metrics.bodySize }]}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    padding: 24,
    gap: 10,
  },
  title: {
    color: colors.text,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.muted,
    lineHeight: 24,
  },
});
