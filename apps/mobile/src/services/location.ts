import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { ingestSessionLocations } from './sessions';
import { useAppStore, type EmergencyLocation } from '../store/useAppStore';

export const LOCATION_TASK_NAME = 'sentinel-location-task';

type LocationTaskData = {
  locations: Location.LocationObject[];
};

const FOREGROUND_TRACKING_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 15000,
  distanceInterval: 20,
};

const BACKGROUND_TRACKING_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 30000,
  distanceInterval: 50,
  deferredUpdatesInterval: 60000,
  deferredUpdatesDistance: 80,
  pausesUpdatesAutomatically: true,
};

const MIN_DISTANCE_METERS = 15;
const MIN_TIME_BETWEEN_UPLOADS_MS = 15000;
const MAX_TIME_BETWEEN_UPLOADS_MS = 45000;
const BUFFER_FLUSH_MS = 20000;
const MAX_BUFFER_SIZE = 3;

let foregroundSubscription: Location.LocationSubscription | null = null;
let bufferedLocations: EmergencyLocation[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
let lastUploadedLocation: EmergencyLocation | null = null;
let lastUploadedAtMs = 0;
let flushInFlight = false;

TaskManager.defineTask<LocationTaskData>(
  LOCATION_TASK_NAME,
  ({ data, error }: TaskManager.TaskManagerTaskBody<LocationTaskData>) => {
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

function getRecordedAtMs(location: EmergencyLocation) {
  return new Date(location.recordedAt || location.createdAt || Date.now()).getTime();
}

function shouldCaptureLocation(location: EmergencyLocation, forceAfterDelay = false) {
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
    return;
  }

  const sessionId = useAppStore.getState().activeSession?.sessionId;
  if (!sessionId) {
    bufferedLocations = [];
    return;
  }

  flushInFlight = true;
  const payload = bufferedLocations;
  bufferedLocations = [];

  try {
    const response = await ingestSessionLocations(sessionId, payload);
    useAppStore.getState().appendEmergencyLocations(response.locations);
    markUploaded(payload);
  } catch {
    bufferedLocations = [...payload, ...bufferedLocations].slice(-MAX_BUFFER_SIZE * 2);
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
    accuracy: Location.Accuracy.Balanced,
  });

  return mapLocationObject(location);
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
