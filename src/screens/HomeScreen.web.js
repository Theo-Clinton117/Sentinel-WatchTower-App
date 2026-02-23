import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { sendAlert } from "../api/watchtowerApi";
import {
  colors,
  getDeviceCategory,
  getResponsiveMetrics,
} from "../theme/responsive";

export function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const category = getDeviceCategory(width, height);
  const metrics = getResponsiveMetrics(category);
  const [isSendingAlert, setIsSendingAlert] = useState(false);
  const [alertStatus, setAlertStatus] = useState("");

  const onAlertPress = async () => {
    if (isSendingAlert) return;

    try {
      setIsSendingAlert(true);
      setAlertStatus("");

      await sendAlert({
        latitude: 0,
        longitude: 0,
        source: "web-preview",
      });

      setAlertStatus("Alert sent successfully.");
      Alert.alert("Alert Sent", "Alert dispatched from web preview mode.");
    } catch (error) {
      const message = error?.message || "Unable to send alert.";
      setAlertStatus(`Failed: ${message}`);
      Alert.alert("Alert Failed", message);
    } finally {
      setIsSendingAlert(false);
    }
  };

  return (
    <View style={[styles.container, { padding: metrics.padding }]}>
      <Text style={[styles.title, { fontSize: metrics.titleSize }]}>WatchTower</Text>
      <Text style={[styles.subtitle, { fontSize: metrics.bodySize }]}>
        Web preview mode. Native map is available on Android/iOS builds.
      </Text>

      <View
        style={[
          styles.mapPlaceholder,
          {
            borderRadius: metrics.radius,
            minHeight: metrics.mapMinHeight,
          },
        ]}
      >
        <Text style={[styles.mapPlaceholderText, { fontSize: metrics.bodySize }]}>
          Map disabled in web preview
        </Text>
      </View>

      <View style={styles.controls}>
        {Boolean(alertStatus) && (
          <Text style={[styles.statusText, { fontSize: metrics.bodySize - 2 }]}>
            {alertStatus}
          </Text>
        )}

        <Pressable
          style={[
            styles.alertButton,
            {
              height: metrics.alertHeight,
              borderRadius: metrics.radius,
              opacity: isSendingAlert ? 0.7 : 1,
            },
          ]}
          disabled={isSendingAlert}
          onPress={onAlertPress}
        >
          {isSendingAlert ? (
            <View style={styles.alertLoadingWrap}>
              <ActivityIndicator color="#ffffff" />
              <Text style={[styles.alertLabel, { fontSize: metrics.bodySize }]}>
                Sending...
              </Text>
            </View>
          ) : (
            <Text style={[styles.alertLabel, { fontSize: metrics.bodySize }]}>
              Send Alert
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    gap: 12,
  },
  title: {
    color: colors.text,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  subtitle: {
    color: colors.muted,
    marginBottom: 4,
  },
  mapPlaceholder: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#0b1a31",
    justifyContent: "center",
    alignItems: "center",
  },
  mapPlaceholderText: {
    color: colors.muted,
    fontWeight: "600",
  },
  controls: {
    gap: 10,
    paddingBottom: 4,
  },
  alertButton: {
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  alertLabel: {
    color: "#ffffff",
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  alertLoadingWrap: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  statusText: {
    color: "#d7e6ff",
  },
});
