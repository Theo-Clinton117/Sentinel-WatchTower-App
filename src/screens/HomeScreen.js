import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { sendAlert } from "../api/watchtowerApi";
import {
  colors,
  getDeviceCategory,
  getResponsiveMetrics,
} from "../theme/responsive";

const FALLBACK_COORDINATE = {
  latitude: 37.7749,
  longitude: -122.4194,
};

export function HomeScreen() {
  const mapRef = useRef(null);
  const watcherRef = useRef(null);
  const followUserRef = useRef(false);
  const { width, height } = useWindowDimensions();
  const category = getDeviceCategory(width, height);
  const metrics = getResponsiveMetrics(category);

  const [userCoordinate, setUserCoordinate] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [followUser, setFollowUser] = useState(false);
  const [isSendingAlert, setIsSendingAlert] = useState(false);
  const [alertStatus, setAlertStatus] = useState("");

  const initialRegion = useMemo(() => {
    const coordinate = userCoordinate || FALLBACK_COORDINATE;
    return {
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      latitudeDelta: 0.018,
      longitudeDelta: 0.018,
    };
  }, [userCoordinate]);

  useEffect(() => {
    let mounted = true;

    async function enableUserLocation() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!mounted) return;

      if (status !== "granted") {
        setHasPermission(false);
        setFollowUser(false);
        return;
      }

      setHasPermission(true);
      setFollowUser(true);

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (!mounted) return;

      const coordinate = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };

      setUserCoordinate(coordinate);

      mapRef.current?.animateToRegion(
        {
          ...coordinate,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        800
      );

      watcherRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 5,
        },
        (updatedLocation) => {
          const nextCoordinate = {
            latitude: updatedLocation.coords.latitude,
            longitude: updatedLocation.coords.longitude,
          };

          setUserCoordinate(nextCoordinate);

          if (followUserRef.current) {
            mapRef.current?.animateToRegion(
              {
                ...nextCoordinate,
                latitudeDelta: 0.015,
                longitudeDelta: 0.015,
              },
              600
            );
          }
        }
      );
    }

    enableUserLocation();

    return () => {
      mounted = false;
      watcherRef.current?.remove();
    };
  }, []);

  useEffect(() => {
    followUserRef.current = followUser;
  }, [followUser]);

  const onAlertPress = async () => {
    if (isSendingAlert) return;

    const coordinate = userCoordinate || FALLBACK_COORDINATE;

    try {
      setIsSendingAlert(true);
      setAlertStatus("");

      await sendAlert({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      });

      setAlertStatus("Alert sent successfully.");
      Alert.alert("Alert Sent", "Your emergency alert has been dispatched.");
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
        Real-time location and rapid incident trigger
      </Text>

      <View
        style={[
          styles.mapWrap,
          {
            borderRadius: metrics.radius,
            minHeight: metrics.mapMinHeight,
          },
        ]}
      >
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={initialRegion}
          showsUserLocation={hasPermission}
          followsUserLocation={followUser}
          showsMyLocationButton={false}
        >
          {!hasPermission && <Marker coordinate={FALLBACK_COORDINATE} />}
        </MapView>
      </View>

      <View style={styles.controls}>
        {Boolean(alertStatus) && (
          <Text style={[styles.statusText, { fontSize: metrics.bodySize - 2 }]}>
            {alertStatus}
          </Text>
        )}

        <Pressable
          style={[
            styles.secondaryButton,
            {
              borderRadius: metrics.radius,
              paddingVertical: metrics.padding * 0.7,
            },
          ]}
          onPress={() => setFollowUser((current) => !current)}
        >
          <Text style={[styles.secondaryLabel, { fontSize: metrics.bodySize }]}>
            {followUser ? "Stop Auto-Follow" : "Follow My Location"}
          </Text>
        </Pressable>

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
  mapWrap: {
    flex: 1,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#091427",
  },
  controls: {
    gap: 10,
    paddingBottom: 4,
  },
  secondaryButton: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryLabel: {
    color: colors.text,
    fontWeight: "600",
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
