import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, Polyline, UrlTile } from 'react-native-maps';
import type { EmergencyLocation } from '../store/useAppStore';
import { useAppTheme } from '../theme';

type Props = {
  lat?: number;
  lng?: number;
  locations?: EmergencyLocation[];
  statusLabel?: string;
  detailLabel?: string;
  variant?: 'default' | 'minimal';
  markerLabel?: string;
  markerColor?: string;
};

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceMeters(
  left: { lat: number; lng: number },
  right: { lat: number; lng: number },
) {
  const earthRadius = 6371000;
  const dLat = toRadians(right.lat - left.lat);
  const dLng = toRadians(right.lng - left.lng);
  const lat1 = toRadians(left.lat);
  const lat2 = toRadians(right.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const LiveMapBase = ({
  lat = 6.5244,
  lng = 3.3792,
  locations = [],
  statusLabel = 'Live session',
  detailLabel = 'Tracking active',
  variant = 'default',
  markerLabel,
  markerColor,
}: Props) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const mapRef = useRef<MapView | null>(null);
  const latestCameraPosition = useRef<{ lat: number; lng: number } | null>(null);
  const isMinimal = variant === 'minimal';
  const activeMarkerColor = markerColor || (isMinimal ? '#F19A3E' : theme.colors.blue);
  const latestLocation = locations.length > 0 ? locations[locations.length - 1] : null;
  const latitude = latestLocation?.lat ?? lat;
  const longitude = latestLocation?.lng ?? lng;

  const coordinates = useMemo(
    () =>
      locations.map((location) => ({
        latitude: location.lat,
        longitude: location.lng,
      })),
    [locations],
  );

  useEffect(() => {
    const nextPosition = { lat: latitude, lng: longitude };
    if (!mapRef.current) {
      latestCameraPosition.current = nextPosition;
      return;
    }

    if (!latestCameraPosition.current) {
      latestCameraPosition.current = nextPosition;
      return;
    }

    const distance = getDistanceMeters(latestCameraPosition.current, nextPosition);
    if (distance < 25) {
      return;
    }

    latestCameraPosition.current = nextPosition;
    mapRef.current.animateCamera(
      {
        center: { latitude, longitude },
        zoom: 16,
      },
      { duration: 900 },
    );
  }, [latitude, longitude]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
        moveOnMarkerPress={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        cacheEnabled
      >
        <UrlTile
          urlTemplate={OSM_TILE_URL}
          maximumZ={19}
          flipY={false}
          shouldReplaceMapContent={Platform.OS === 'ios'}
          zIndex={-1}
        />
        {coordinates.length > 1 ? (
          <Polyline
            coordinates={coordinates}
            strokeColor={isMinimal ? 'rgba(124, 92, 250, 0.52)' : '#1B7CFF'}
            strokeWidth={isMinimal ? 6 : 4}
          />
        ) : null}
        <Circle
          center={{ latitude, longitude }}
          radius={isMinimal ? 120 : 90}
          fillColor={
            isMinimal
              ? theme.isDark
                ? 'rgba(124, 92, 250, 0.12)'
                : 'rgba(124, 92, 250, 0.1)'
              : theme.isDark
                ? 'rgba(134, 185, 255, 0.16)'
                : 'rgba(30, 99, 255, 0.14)'
          }
          strokeColor={isMinimal ? 'rgba(124, 92, 250, 0.4)' : theme.colors.blueGlow}
          strokeWidth={1}
        />
        <Marker
          coordinate={{ latitude, longitude }}
          anchor={isMinimal ? { x: 0.5, y: 0.86 } : undefined}
        >
          {isMinimal ? (
            <View style={styles.markerWrapMinimal}>
              <View
                style={[
                  styles.markerBadgeMinimal,
                  { backgroundColor: activeMarkerColor },
                ]}
              >
                <Text style={styles.markerLabelMinimal}>
                  {markerLabel || detailLabel.charAt(0) || 'T'}
                </Text>
              </View>
              <View
                style={[
                  styles.markerTailMinimal,
                  { borderTopColor: activeMarkerColor },
                ]}
              />
            </View>
          ) : (
            <View style={styles.markerWrap}>
              <View style={styles.markerPulse} />
              <View style={[styles.markerCore, { backgroundColor: activeMarkerColor }]} />
            </View>
          )}
        </Marker>
      </MapView>
      {isMinimal ? (
        <Text style={styles.attributionMinimal}>Map data (c) OpenStreetMap contributors</Text>
      ) : (
        <>
          <View style={styles.topBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.badgeText}>{statusLabel}</Text>
          </View>
          <View style={styles.bottomCard}>
            <Text style={styles.bottomTitle}>{detailLabel}</Text>
            <Text style={styles.bottomMeta}>
              {locations.length > 0
                ? `${locations.length} checkpoints captured`
                : 'Waiting for the first checkpoint'}
            </Text>
            <Text style={styles.attribution}>Map data (c) OpenStreetMap contributors</Text>
          </View>
        </>
      )}
    </View>
  );
};

export const LiveMap = React.memo(LiveMapBase);

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      borderRadius: 22,
      overflow: 'hidden',
    },
    markerWrap: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
    },
    markerPulse: {
      position: 'absolute',
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.isDark ? 'rgba(134, 185, 255, 0.35)' : 'rgba(30, 99, 255, 0.2)',
    },
    markerCore: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 3,
      borderColor: theme.colors.backgroundElevated,
    },
    markerWrapMinimal: {
      alignItems: 'center',
    },
    markerBadgeMinimal: {
      width: 54,
      height: 54,
      borderRadius: 27,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#A05E1D',
      shadowOpacity: 0.22,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
    markerLabelMinimal: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: '800',
    },
    markerTailMinimal: {
      width: 0,
      height: 0,
      borderLeftWidth: 10,
      borderRightWidth: 10,
      borderTopWidth: 16,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      marginTop: -4,
    },
    topBadge: {
      position: 'absolute',
      top: 14,
      left: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.blueGlow,
    },
    badgeText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '700',
    },
    bottomCard: {
      position: 'absolute',
      left: 14,
      right: 14,
      bottom: 14,
      padding: 14,
      borderRadius: 18,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    bottomTitle: {
      color: theme.colors.text,
      fontWeight: '700',
      marginBottom: 4,
    },
    bottomMeta: {
      color: theme.colors.muted,
      fontSize: 12,
    },
    attribution: {
      color: theme.colors.muted,
      fontSize: 10,
      marginTop: 8,
      opacity: 0.9,
    },
    attributionMinimal: {
      position: 'absolute',
      right: 12,
      bottom: 12,
      color: '#7D7A92',
      fontSize: 9,
      backgroundColor: 'rgba(255,255,255,0.84)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
  });
