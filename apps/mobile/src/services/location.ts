import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { ingestSessionLocations } from './sessions';
import { useAppStore, type EmergencyLocation } from '../store/useAppStore';

export const LOCATION_TASK_NAME = 'sentinel-location-task';

type CoordinateLike = Pick<EmergencyLocation, 'lat' | 'lng'>;
type PreciseCoordinateLike = Pick<EmergencyLocation, 'lat' | 'lng' | 'accuracyM'>;

type LocationTaskData = {
  locations: Location.LocationObject[];
};

const FOREGROUND_TRACKING_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 10000,
  distanceInterval: 10,
};

const BACKGROUND_TRACKING_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.High,
  timeInterval: 20000,
  distanceInterval: 25,
  deferredUpdatesInterval: 45000,
  deferredUpdatesDistance: 50,
  pausesUpdatesAutomatically: true,
};

const MIN_DISTANCE_METERS = 15;
const MIN_TIME_BETWEEN_UPLOADS_MS = 15000;
const MAX_TIME_BETWEEN_UPLOADS_MS = 45000;
const BUFFER_FLUSH_MS = 20000;
const MAX_BUFFER_SIZE = 3;
const STRICT_LOCATION_ACCURACY_METERS = 50;
const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

type PendingLocationUpload = {
  sessionId: string;
  locations: EmergencyLocation[];
};

let foregroundSubscription: Location.LocationSubscription | null = null;
let bufferedLocations: EmergencyLocation[] = [];
let pendingUploadBatches: PendingLocationUpload[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
let lastUploadedLocation: EmergencyLocation | null = null;
let lastUploadedAtMs = 0;
let flushInFlight = false;

TaskManager.defineTask<LocationTaskData>(
  LOCATION_TASK_NAME,
  async ({ data, error }: TaskManager.TaskManagerTaskBody<LocationTaskData>) => {
    if (error || !data?.locations?.length) {
      return;
    }

    const payload = data.locations
      .map(mapLocationObject)
      .filter((location) => shouldCaptureLocation(location, true));

    if (payload.length === 0) {
      return;
    }

    const state = useAppStore.getState();
    state.appendEmergencyLocations(payload);
    queueLocationUpload(payload, true);
  },
);

function mapLocationObject(location: Location.LocationObject): EmergencyLocation {
  return {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    accuracyM: location.coords.accuracy ?? null,
    source: 'mobile',
    recordedAt: new Date(location.timestamp).toISOString(),
  };
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceMeters(left: EmergencyLocation, right: EmergencyLocation) {
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

export function getCoordinateDistanceMeters(left: CoordinateLike, right: CoordinateLike) {
  return getDistanceMeters(left as EmergencyLocation, right as EmergencyLocation);
}

function formatAddressLine(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .filter((part, index, values) => values.indexOf(part) === index)
    .join(', ');
}

export function formatLocationCoordinates(location: CoordinateLike) {
  return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
}

function isPreciseEnoughLocation(location: PreciseCoordinateLike) {
  return Number.isFinite(location.lat) && Number.isFinite(location.lng);
}

function getGoogleMapsApiKey() {
  return String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim();
}

function buildGoogleReverseGeocodeUrl(location: CoordinateLike) {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return null;
  }

  const params = new URLSearchParams({ latlng: `${location.lat},${location.lng}`, key: apiKey });

  return `${GOOGLE_GEOCODE_URL}?${params.toString()}`;
}

function buildGoogleAddressLabel(result: {
  formatted_address?: string;
  address_components?: Array<{
    long_name?: string;
    short_name?: string;
    types?: string[];
  }>;
}) {
  if (typeof result.formatted_address === 'string' && result.formatted_address.trim()) {
    return result.formatted_address.trim();
  }

  const components = result.address_components || [];
  const findComponent = (...types: string[]) => {
    const component = components.find((entry) => entry.types?.some((type) => types.includes(type)));
    return component?.short_name || component?.long_name || null;
  };

  const primaryLine = formatAddressLine([
    findComponent('street_number'),
    findComponent('route'),
    findComponent('premise'),
    findComponent('subpremise'),
  ]);
  const secondaryLine = formatAddressLine([
    findComponent('locality'),
    findComponent('administrative_area_level_1'),
    findComponent('country'),
  ]);

  return formatAddressLine([primaryLine, secondaryLine]) || null;
}

export async function getReadableLocationLabel(location: PreciseCoordinateLike) {
  if (!isPreciseEnoughLocation(location)) {
    return null;
  }

  const url = buildGoogleReverseGeocodeUrl(location);
  if (!url) {
    return null;
  }

  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    status?: string;
    results?: Array<{
      formatted_address?: string;
      address_components?: Array<{
        long_name?: string;
        short_name?: string;
        types?: string[];
      }>;
      geometry?: {
        location_type?: string;
      };
      types?: string[];
    }>;
  };

  if (payload.status !== 'OK' || !Array.isArray(payload.results)) {
    return null;
  }

  // Nigerian addresses frequently resolve to route, neighbourhood, or plus-code
  // results rather than a ROOFTOP record. Coordinates are already validated; use
  // the best returned address instead of treating those valid results as failures.
  return buildGoogleAddressLabel(payload.results[0]) || null;
}

function getRecordedAtMs(location: EmergencyLocation) {
  return new Date(location.recordedAt || location.createdAt || Date.now()).getTime();
}

function shouldCaptureLocation(location: EmergencyLocation, forceAfterDelay = false) {
  if (!isPreciseEnoughLocation(location)) {
    return false;
  }

  if (!lastUploadedLocation) {
    return true;
  }

  const distance = getDistanceMeters(lastUploadedLocation, location);
  const elapsed = getRecordedAtMs(location) - lastUploadedAtMs;

  if (distance >= MIN_DISTANCE_METERS) {
    return true;
  }

  if (forceAfterDelay && elapsed >= MAX_TIME_BETWEEN_UPLOADS_MS) {
    return true;
  }

  return elapsed >= MAX_TIME_BETWEEN_UPLOADS_MS;
}

async function ensureForegroundPermission() {
  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.granted) {
    return true;
  }

  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.granted;
}

async function ensureBackgroundPermission() {
  const permission = await Location.getBackgroundPermissionsAsync();
  if (permission.granted) {
    return true;
  }

  const requested = await Location.requestBackgroundPermissionsAsync();
  return requested.granted;
}

function markUploaded(locations: EmergencyLocation[]) {
  const latest = locations[locations.length - 1];
  if (!latest) {
    return;
  }

  lastUploadedLocation = latest;
  lastUploadedAtMs = getRecordedAtMs(latest);
}

function locationUploadKey(location: EmergencyLocation) {
  return `${location.recordedAt || ''}:${location.lat.toFixed(6)}:${location.lng.toFixed(6)}:${location.source || ''}`;
}

function compactLocationUploads(locations: EmergencyLocation[]) {
  const deduped = new Map<string, EmergencyLocation>();
  locations.forEach((location) => {
    deduped.set(locationUploadKey(location), location);
  });
  return Array.from(deduped.values());
}

async function readPendingLocationUploads() {
  return pendingUploadBatches;
}

async function writePendingLocationUploads(queue: PendingLocationUpload[]) {
  pendingUploadBatches = queue.slice(-12);
}

function persistLocationUploadFailure(sessionId: string, locations: EmergencyLocation[]) {
  if (locations.length === 0) {
    return;
  }

  pendingUploadBatches = [...pendingUploadBatches, { sessionId, locations }].slice(-12);
}

async function takePendingLocationsForSession(sessionId: string) {
  const queue = await readPendingLocationUploads();
  const matching = queue.filter((item) => item.sessionId === sessionId);
  const remaining = queue.filter((item) => item.sessionId !== sessionId);

  if (matching.length !== queue.length) {
    await writePendingLocationUploads(remaining);
  }

  return matching.flatMap((item) => item.locations);
}

function scheduleFlush() {
  if (flushTimeout) {
    return;
  }

  flushTimeout = setTimeout(() => {
    flushTimeout = null;
    void flushLocationBuffer();
  }, BUFFER_FLUSH_MS);
}

async function flushLocationBuffer() {
  if (flushInFlight || bufferedLocations.length === 0) {
    if (bufferedLocations.length === 0) {
      const sessionId = useAppStore.getState().activeSession?.sessionId;
      if (!sessionId || flushInFlight) {
        return;
      }
    } else {
      return;
    }
  }

  const sessionId = useAppStore.getState().activeSession?.sessionId;
  if (!sessionId) {
    bufferedLocations = [];
    return;
  }

  flushInFlight = true;
  const persistedLocations = await takePendingLocationsForSession(sessionId);
  const payload = compactLocationUploads([...persistedLocations, ...bufferedLocations]).slice(
    -MAX_BUFFER_SIZE * 4,
  );
  bufferedLocations = [];

  if (payload.length === 0) {
    flushInFlight = false;
    return;
  }

  try {
    const response = await ingestSessionLocations(sessionId, payload);
    useAppStore.getState().appendEmergencyLocations(response.locations);
    markUploaded(payload);
  } catch {
    bufferedLocations = [...payload, ...bufferedLocations].slice(-MAX_BUFFER_SIZE * 2);
    persistLocationUploadFailure(sessionId, payload);
    if (!flushTimeout) {
      scheduleFlush();
    }
  } finally {
    flushInFlight = false;
  }
}

function queueLocationUpload(locations: EmergencyLocation[], forceFlush = false) {
  if (locations.length === 0) {
    return;
  }

  bufferedLocations = [...bufferedLocations, ...locations].slice(-MAX_BUFFER_SIZE * 2);

  if (forceFlush || bufferedLocations.length >= MAX_BUFFER_SIZE) {
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    void flushLocationBuffer();
    return;
  }

  scheduleFlush();
}

export async function getCurrentLocation() {
  const granted = await ensureForegroundPermission();

  if (!granted) {
    throw new Error('Location permission is required.');
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.BestForNavigation,
  });

  const mapped = mapLocationObject(location);
  if (!isPreciseEnoughLocation(mapped)) {
    throw new Error('A valid GPS fix is required before Sentinel can resolve this location.');
  }

  return mapped;
}

export async function startForegroundTracking() {
  const granted = await ensureForegroundPermission();
  if (!granted) {
    throw new Error('Location permission is required.');
  }

  foregroundSubscription?.remove();
  foregroundSubscription = await Location.watchPositionAsync(
    FOREGROUND_TRACKING_OPTIONS,
    (location) => {
      const state = useAppStore.getState();
      const payload = mapLocationObject(location);

      if (!isPreciseEnoughLocation(payload)) {
        return;
      }

      state.setLastKnownLocation(payload);

      if (!state.activeSession?.sessionId) {
        return;
      }

      const elapsed = getRecordedAtMs(payload) - lastUploadedAtMs;
      const significant = shouldCaptureLocation(payload, true);

      if (!significant && elapsed < MIN_TIME_BETWEEN_UPLOADS_MS) {
        return;
      }

      queueLocationUpload([payload]);
    },
  );

  return foregroundSubscription;
}

export async function startBackgroundTracking() {
  const granted = await ensureBackgroundPermission();
  if (!granted) {
    return;
  }

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (alreadyStarted) {
    return;
  }

  return Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, BACKGROUND_TRACKING_OPTIONS);
}

export async function stopBackgroundTracking() {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  await flushLocationBuffer();
  foregroundSubscription?.remove();
  foregroundSubscription = null;

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (alreadyStarted) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}
