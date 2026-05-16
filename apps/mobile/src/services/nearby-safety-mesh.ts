import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EmergencyLocation } from '../store/useAppStore';
import { apiGet, apiPost } from './api';

export type NearbyMotionState = 'stationary' | 'walking' | 'running' | 'driving' | 'unknown';
export type NearbyProximityBand = 'near' | 'medium' | 'far';

export type NearbyDeviceSignal = {
  ephemeralDeviceId: string;
  timestamp: number;
  proximityBand: NearbyProximityBand;
  motionState: NearbyMotionState;
  confidence: number;
};

export type NearbySafetyMeshContext = {
  enabled: true;
  userMotionState: NearbyMotionState;
  userSpeedMps: number | null;
  nearbyDeviceCount: number;
  nearbyStationaryCount: number;
  nearbyMovingCount: number;
  groupMotionAgreement: number;
  suddenDivergence: boolean;
  collectiveStillness: boolean;
  freshSignalCount: number;
  meshScore: number;
  summary: string[];
  computedAt: string;
};

type BuildContextOptions = {
  enabled: boolean;
  currentLocation: EmergencyLocation;
  recentLocations: EmergencyLocation[];
  signals?: NearbyDeviceSignal[];
  nowMs?: number;
};

type NearbySafetyMeshSyncResponse = {
  areaCell: string;
  signals: NearbyDeviceSignal[];
};

const SIGNAL_FRESHNESS_MS = 45_000;
const MAX_SIGNAL_CACHE_SIZE = 36;
const EPHEMERAL_ID_STORAGE_KEY = 'sentinel-nearby-safety-mesh-ephemeral-id';

const cachedSignals = new Map<string, NearbyDeviceSignal>();

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function isMoving(state: NearbyMotionState) {
  return state === 'walking' || state === 'running' || state === 'driving';
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

function estimateUserMotionState(recentLocations: EmergencyLocation[], currentLocation: EmergencyLocation) {
  const orderedLocations = [...recentLocations, currentLocation]
    .filter((location) => Number.isFinite(location.lat) && Number.isFinite(location.lng))
    .sort((left, right) => getRecordedAtMs(left) - getRecordedAtMs(right));
  const latest = orderedLocations[orderedLocations.length - 1];
  const previous = orderedLocations[orderedLocations.length - 2];

  if (!latest || !previous) {
    return { motionState: 'unknown' as NearbyMotionState, speedMps: null };
  }

  const elapsedSeconds = Math.max(1, (getRecordedAtMs(latest) - getRecordedAtMs(previous)) / 1000);
  const speedMps = getDistanceMeters(previous, latest) / elapsedSeconds;

  if (speedMps < 0.35) {
    return { motionState: 'stationary' as NearbyMotionState, speedMps };
  }

  if (speedMps < 2.4) {
    return { motionState: 'walking' as NearbyMotionState, speedMps };
  }

  if (speedMps < 7) {
    return { motionState: 'running' as NearbyMotionState, speedMps };
  }

  return { motionState: 'driving' as NearbyMotionState, speedMps };
}

function getAreaCell(location: EmergencyLocation) {
  return `${location.lat.toFixed(3)}:${location.lng.toFixed(3)}`;
}

function getUtcDayBucket(nowMs = Date.now()) {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function createRandomToken() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

async function getEphemeralDeviceId(nowMs = Date.now()) {
  const dayBucket = getUtcDayBucket(nowMs);
  const rawValue = await AsyncStorage.getItem(EPHEMERAL_ID_STORAGE_KEY);

  if (rawValue) {
    try {
      const parsed = JSON.parse(rawValue) as { dayBucket?: string; id?: string };
      if (parsed.dayBucket === dayBucket && parsed.id) {
        return parsed.id;
      }
    } catch {
      await AsyncStorage.removeItem(EPHEMERAL_ID_STORAGE_KEY);
    }
  }

  const id = `mesh-${dayBucket}-${createRandomToken()}`;
  await AsyncStorage.setItem(EPHEMERAL_ID_STORAGE_KEY, JSON.stringify({ dayBucket, id }));
  return id;
}

function sanitizeSignal(signal: NearbyDeviceSignal): NearbyDeviceSignal | null {
  if (!signal.ephemeralDeviceId || !Number.isFinite(signal.timestamp)) {
    return null;
  }

  return {
    ...signal,
    confidence: clampConfidence(signal.confidence),
  };
}

export function rememberNearbyDeviceSignals(signals: NearbyDeviceSignal[], nowMs = Date.now()) {
  signals.forEach((signal) => {
    const sanitized = sanitizeSignal(signal);
    if (!sanitized || nowMs - sanitized.timestamp > SIGNAL_FRESHNESS_MS) {
      return;
    }

    cachedSignals.set(sanitized.ephemeralDeviceId, sanitized);
  });

  Array.from(cachedSignals.entries())
    .filter(([, signal]) => nowMs - signal.timestamp > SIGNAL_FRESHNESS_MS)
    .forEach(([id]) => cachedSignals.delete(id));

  if (cachedSignals.size <= MAX_SIGNAL_CACHE_SIZE) {
    return;
  }

  Array.from(cachedSignals.values())
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(MAX_SIGNAL_CACHE_SIZE)
    .forEach((signal) => cachedSignals.delete(signal.ephemeralDeviceId));
}

export function buildNearbySafetyMeshContext({
  enabled,
  currentLocation,
  recentLocations,
  signals,
  nowMs = Date.now(),
}: BuildContextOptions): NearbySafetyMeshContext | null {
  if (!enabled) {
    return null;
  }

  if (signals) {
    rememberNearbyDeviceSignals(signals, nowMs);
  }

  const freshSignals = Array.from(cachedSignals.values()).filter(
    (signal) => nowMs - signal.timestamp <= SIGNAL_FRESHNESS_MS,
  );
  const strongSignals = freshSignals.filter((signal) => signal.confidence >= 0.45);
  const { motionState: userMotionState, speedMps: userSpeedMps } = estimateUserMotionState(
    recentLocations,
    currentLocation,
  );

  const nearbyStationaryCount = strongSignals.filter(
    (signal) => signal.motionState === 'stationary',
  ).length;
  const nearbyMovingCount = strongSignals.filter((signal) => isMoving(signal.motionState)).length;
  const nearbyDeviceCount = strongSignals.length;
  const matchingMotionCount = strongSignals.filter(
    (signal) => signal.motionState === userMotionState,
  ).length;
  const groupMotionAgreement =
    nearbyDeviceCount > 0 ? Number((matchingMotionCount / nearbyDeviceCount).toFixed(2)) : 0;
  const closeStationaryCount = strongSignals.filter(
    (signal) => signal.proximityBand === 'near' && signal.motionState === 'stationary',
  ).length;
  const suddenDivergence =
    userMotionState === 'running' &&
    nearbyDeviceCount >= 2 &&
    nearbyStationaryCount >= Math.ceil(nearbyDeviceCount * 0.6);
  const collectiveStillness =
    userMotionState === 'stationary' &&
    nearbyDeviceCount >= 3 &&
    nearbyStationaryCount >= Math.ceil(nearbyDeviceCount * 0.75);

  let meshScore = 0;
  const summary: string[] = [];

  if (suddenDivergence) {
    meshScore += 18;
    summary.push('Nearby opted-in devices were mostly still while your movement changed sharply.');
  }

  if (collectiveStillness) {
    meshScore += 12;
    summary.push('Several nearby opted-in devices appear stationary at the same time.');
  }

  if (closeStationaryCount >= 2 && userMotionState === 'running') {
    meshScore += 8;
    summary.push('Close-range mesh signals show a mismatch between your movement and nearby devices.');
  }

  if (nearbyDeviceCount > 0 && summary.length === 0) {
    summary.push('Nearby opted-in mesh signals did not raise the passive risk score.');
  }

  return {
    enabled: true,
    userMotionState,
    userSpeedMps,
    nearbyDeviceCount,
    nearbyStationaryCount,
    nearbyMovingCount,
    groupMotionAgreement,
    suddenDivergence,
    collectiveStillness,
    freshSignalCount: freshSignals.length,
    meshScore: Math.min(24, meshScore),
    summary,
    computedAt: new Date(nowMs).toISOString(),
  };
}

export async function syncNearbySafetyMeshSignals({
  enabled,
  currentLocation,
  recentLocations,
  nowMs = Date.now(),
}: Omit<BuildContextOptions, 'signals'>) {
  if (!enabled) {
    return [];
  }

  const areaCell = getAreaCell(currentLocation);
  const { motionState } = estimateUserMotionState(recentLocations, currentLocation);
  const ephemeralDeviceId = await getEphemeralDeviceId(nowMs);
  const signal: NearbyDeviceSignal = {
    ephemeralDeviceId,
    timestamp: nowMs,
    proximityBand: 'medium',
    motionState,
    confidence: motionState === 'unknown' ? 0.5 : 0.82,
  };

  try {
    const response = await apiPost<NearbySafetyMeshSyncResponse>(
      '/nearby-safety-mesh/signals',
      {
        areaCell,
        signal,
      },
      { auth: true },
    );
    rememberNearbyDeviceSignals(response.signals || [], nowMs);
    return response.signals || [];
  } catch {
    try {
      const response = await apiGet<NearbySafetyMeshSyncResponse>(
        `/nearby-safety-mesh/signals/${encodeURIComponent(areaCell)}`,
        { auth: true },
      );
      rememberNearbyDeviceSignals(response.signals || [], nowMs);
      return response.signals || [];
    } catch {
      return [];
    }
  }
}
