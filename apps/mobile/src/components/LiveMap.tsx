import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
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
  mapLayer?: 'street' | 'satellite';
};

const MAX_RENDERED_TRAIL_POINTS = 120;

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
  mapLayer = 'street',
}: Props) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapTimedOut, setMapTimedOut] = useState(false);
  const latestCameraPosition = useRef<{ lat: number; lng: number } | null>(null);
  const isMinimal = variant === 'minimal';
  const activeMarkerColor = markerColor || (isMinimal ? '#F19A3E' : theme.colors.blue);
  const validLocations = useMemo(
    () =>
      locations.filter(
        (location) =>
          Number.isFinite(location.lat) &&
          Number.isFinite(location.lng) &&
          Math.abs(location.lat) <= 90 &&
          Math.abs(location.lng) <= 180,
      ),
    [locations],
  );
  const latestLocation = validLocations.length > 0 ? validLocations[validLocations.length - 1] : null;
  const latitude = latestLocation?.lat ?? (Number.isFinite(lat) && Math.abs(lat) <= 90 ? lat : 6.5244);
  const longitude = latestLocation?.lng ?? (Number.isFinite(lng) && Math.abs(lng) <= 180 ? lng : 3.3792);
  const googleMapsKey = String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim();
  const markerCoordinate = useMemo(() => ({ latitude, longitude }), [latitude, longitude]);

  useEffect(() => {
    setMapReady(false);
    setMapTimedOut(false);
    const timeout = setTimeout(() => setMapTimedOut(true), 10000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (__DEV__) {
      console.info('[Sentinel] map diagnostics', {
        platform: Platform.OS,
        hasGoogleMapsKey: Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY),
        latitudeValid: Number.isFinite(latitude),
        longitudeValid: Number.isFinite(longitude),
      });
    }
  }, [latitude, longitude]);

  const coordinates = useMemo(
    () => {
      const trailLocations =
        validLocations.length > MAX_RENDERED_TRAIL_POINTS
          ? validLocations.slice(-MAX_RENDERED_TRAIL_POINTS)
          : validLocations;

      return trailLocations.map((location) => ({
        latitude: location.lat,
        longitude: location.lng,
      }));
    },
    [validLocations],
  );

  // Calculate optimal zoom level and region based on all locations
  const mapRegion = useMemo(() => {
    if (validLocations.length === 0) {
      return { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    }

    if (validLocations.length === 1) {
      return { latitude, longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 };
    }

    // Calculate bounds of all locations
    let maxLat = validLocations[0].lat;
    let minLat = validLocations[0].lat;
    let maxLng = validLocations[0].lng;
    let minLng = validLocations[0].lng;

    validLocations.forEach((loc) => {
      maxLat = Math.max(maxLat, loc.lat);
      minLat = Math.min(minLat, loc.lat);
      maxLng = Math.max(maxLng, loc.lng);
      minLng = Math.min(minLng, loc.lng);
    });

    const centerLat = (maxLat + minLat) / 2;
    const centerLng = (maxLng + minLng) / 2;
    const latDelta = maxLat - minLat;
    const lngDelta = maxLng - minLng;

    // Add 40% padding to show all points comfortably
    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: Math.max(latDelta * 1.4, 0.02),
      longitudeDelta: Math.max(lngDelta * 1.4, 0.02),
    };
  }, [validLocations, latitude, longitude]);

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
    if (distance < 50) {
      return;
    }

    latestCameraPosition.current = nextPosition;
    // Use adaptive zoom based on location count
    const adaptiveZoom = locations.length > 1 ? 15 : 16;
    mapRef.current.animateCamera(
      {
        center: { latitude, longitude },
        zoom: adaptiveZoom,
      },
      { duration: 900 },
    );
  }, [latitude, longitude, locations.length]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        onMapReady={() => { setMapReady(true); setMapTimedOut(false); }}
        style={StyleSheet.absoluteFill}
        initialRegion={mapRegion}
        provider={Platform.OS === 'android' || googleMapsKey ? PROVIDER_GOOGLE : undefined}
        mapType={
          mapLayer === 'satellite'
            ? Platform.OS === 'android'
              ? 'satellite'
              : 'hybrid'
            : 'standard'
        }
        moveOnMarkerPress={false}
        rotateEnabled={true}
        pitchEnabled={true}
        toolbarEnabled={false}
        scrollEnabled={true}
        zoomEnabled={true}
        minZoomLevel={3}
        maxZoomLevel={19}
        showsMyLocationButton={true}
        showsCompass={true}
      >
        {coordinates.length > 1 ? (
          <Polyline
            coordinates={coordinates}
            strokeColor={isMinimal ? 'rgba(124, 92, 250, 0.52)' : '#1B7CFF'}
            strokeWidth={isMinimal ? 6 : 4}
          />
        ) : null}
        <Circle
          center={markerCoordinate}
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
          key={`${activeMarkerColor}:${markerLabel || detailLabel}`}
          coordinate={markerCoordinate}
          anchor={isMinimal ? { x: 0.5, y: 0.86 } : undefined}
          tracksViewChanges={false}
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
      {mapTimedOut && !mapReady ? (
        <View style={styles.mapFallback}>
          <Text style={styles.mapFallbackTitle}>Map is taking longer than expected</Text>
          <Text style={styles.mapFallbackText}>
            Your location can still be used for alerts. Check your connection and Google Maps setup in a development or production build.
          </Text>
        </View>
      ) : null}
      {isMinimal ? null : (
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
      borderRadius: 8,
      overflow: 'hidden',
    },
    mapFallback: {
      position: 'absolute', left: 14, right: 14, top: 14, padding: 14,
      borderRadius: 12, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    },
    mapFallbackTitle: { color: theme.colors.text, fontWeight: '800', marginBottom: 4 },
    mapFallbackText: { color: theme.colors.muted, fontSize: 12, lineHeight: 17 },
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
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      borderWidth: 1.5,
      borderColor: theme.colors.blue,
      shadowColor: theme.colors.blue,
      shadowOpacity: 0.16,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    markerLabelMinimal: {
      color: theme.colors.blue,
      fontSize: 16,
      fontWeight: '800',
    },
    markerTailMinimal: {
      width: 0,
      height: 0,
      borderLeftWidth: 7,
      borderRightWidth: 7,
      borderTopWidth: 11,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      marginTop: -4,
      borderTopColor: theme.colors.blue,
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
      borderRadius: 8,
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
      flexShrink: 1,
    },
    bottomCard: {
      position: 'absolute',
      left: 14,
      right: 14,
      bottom: 14,
      padding: 14,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    bottomTitle: {
      color: theme.colors.text,
      fontWeight: '700',
      marginBottom: 4,
      lineHeight: 20,
    },
    bottomMeta: {
      color: theme.colors.muted,
      fontSize: 12,
      lineHeight: 17,
    },
  });
