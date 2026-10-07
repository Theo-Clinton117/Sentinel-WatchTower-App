import AsyncStorage from '@react-native-async-storage/async-storage';
import { getEncryptedItem, setEncryptedItem } from './encrypted-storage';
import { recordJourneyLocation, type Journey } from './journeys';
import type { EmergencyLocation } from '../store/useAppStore';

const STORAGE_KEY = 'pending-journey-location-updates';
const STORAGE_NAMESPACE = 'journey-location-sync';
const MAX_PENDING = 6;

type PendingUpdate = { journeyId: string; location: EmergencyLocation };

async function readPending(): Promise<PendingUpdate[]> {
  const raw = await getEncryptedItem(AsyncStorage, STORAGE_NAMESPACE, STORAGE_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as PendingUpdate[]; } catch { return []; }
}

async function writePending(items: PendingUpdate[]) {
  await setEncryptedItem(AsyncStorage, STORAGE_NAMESPACE, STORAGE_KEY, JSON.stringify(items.slice(-MAX_PENDING)));
}

function sameLocation(left: PendingUpdate, right: PendingUpdate) {
  return left.journeyId === right.journeyId && left.location.recordedAt === right.location.recordedAt;
}

export async function syncJourneyLocation(journeyId: string, location: EmergencyLocation): Promise<Journey & { automaticallyArrived?: boolean } | null> {
  const queued = await readPending();
  const work = [...queued.filter((item) => item.journeyId === journeyId), { journeyId, location }]
    .filter((item, index, items) => items.findIndex((candidate) => sameLocation(candidate, item)) === index)
    .slice(-MAX_PENDING);
  const other = queued.filter((item) => item.journeyId !== journeyId);
  try {
    let latest: Journey & { automaticallyArrived?: boolean } | null = null;
    for (let index = 0; index < work.length; index += 1) {
      const item = work[index];
      latest = await recordJourneyLocation(item.journeyId, item.location);
      if (latest.status !== 'active') break;
    }
    await writePending(other);
    return latest;
  } catch {
    await writePending([...other, ...work]);
    return null;
  }
}

export async function discardJourneyUpdates(journeyId: string) {
  const queued = await readPending();
  await writePending(queued.filter((item) => item.journeyId !== journeyId));
}
