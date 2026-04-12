import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_RAPID_ALERT_TAG,
  getRapidAlertTitle,
  type RapidAlertSeverity,
  type RapidAlertTag,
} from '../constants/rapid-alerts';
import { createRapidReport } from './reports';

const QUEUED_RAPID_REPORTS_KEY = 'sentinel-queued-rapid-reports';

export type QueuedRapidReport = {
  id: string;
  severity: RapidAlertSeverity;
  category: RapidAlertTag;
  title: string;
  lat: number;
  lng: number;
  locationAccuracyM?: number | null;
  queuedAt: string;
};

async function readQueue() {
  const raw = await AsyncStorage.getItem(QUEUED_RAPID_REPORTS_KEY);
  if (!raw) {
    return [] as QueuedRapidReport[];
  }

  try {
    const parsed = JSON.parse(raw) as QueuedRapidReport[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedRapidReport[]) {
  await AsyncStorage.setItem(QUEUED_RAPID_REPORTS_KEY, JSON.stringify(queue));
}

export async function queueRapidReport(
  payload: Omit<QueuedRapidReport, 'id' | 'queuedAt' | 'title'> & { title?: string },
) {
  const queue = await readQueue();
  const nextItem: QueuedRapidReport = {
    id: `queued-rapid-report-${Date.now()}`,
    severity: payload.severity,
    category: payload.category ?? DEFAULT_RAPID_ALERT_TAG,
    title: payload.title || getRapidAlertTitle(payload.category ?? DEFAULT_RAPID_ALERT_TAG, payload.severity),
    lat: payload.lat,
    lng: payload.lng,
    locationAccuracyM: payload.locationAccuracyM ?? null,
    queuedAt: new Date().toISOString(),
  };

  await writeQueue([...queue, nextItem].slice(-20));
  return nextItem;
}

export async function getQueuedRapidReportCount() {
  const queue = await readQueue();
  return queue.length;
}

export async function flushQueuedRapidReports() {
  const queue = await readQueue();

  if (queue.length === 0) {
    return { delivered: 0, remaining: 0 };
  }

  const remaining: QueuedRapidReport[] = [];
  let delivered = 0;

  for (const item of queue) {
    try {
      await createRapidReport({
        title: item.title,
        severity: item.severity,
        category: item.category,
        lat: item.lat,
        lng: item.lng,
        locationAccuracyM: item.locationAccuracyM ?? null,
      });
      delivered += 1;
    } catch {
      remaining.push(item);
    }
  }

  await writeQueue(remaining);

  return {
    delivered,
    remaining: remaining.length,
  };
}
