import type { EmergencyLocation, WatchSession } from '../store/useAppStore';

type RiskZone = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  riskLevel: string;
};

type MatchedZone = {
  id: string;
  name: string;
  riskLevel: string;
  radiusM: number;
  distanceM: number;
};

type GuardianAssessment = {
  riskScore: number;
  stage: 'monitoring' | 'suspicious' | 'soft_alert';
  summary: string[];
  snapshot: {
    locationScore: number;
    timeScore: number;
    watchScore: number;
    matchedZone: MatchedZone | null;
    computedAt: string;
  };
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceMeters(left: EmergencyLocation, right: RiskZone) {
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

function getZoneWeight(riskLevel: string) {
  switch (riskLevel) {
    case 'critical':
      return 44;
    case 'high':
      return 34;
    case 'medium':
      return 22;
    case 'low':
      return 12;
    default:
      return 18;
  }
}

function getTimeScore(now = new Date()) {
  const hour = now.getHours();

  if (hour >= 22 || hour < 4) {
    return 18;
  }

  if (hour >= 20 || hour < 6) {
    return 10;
  }

  return 0;
}

export function evaluateGuardianRisk(
  location: EmergencyLocation,
  riskZones: RiskZone[],
  activeWatchSession?: WatchSession | null,
): GuardianAssessment {
  let locationScore = 0;
  let matchedZone: MatchedZone | null = null;

  riskZones.forEach((zone) => {
    const distanceM = getDistanceMeters(location, zone);
    if (distanceM > Math.max(zone.radiusM || 0, 60)) {
      return;
    }

    const weight = getZoneWeight(zone.riskLevel);
    if (weight > locationScore) {
      locationScore = weight;
      matchedZone = {
        id: zone.id,
        name: zone.name,
        riskLevel: zone.riskLevel,
        radiusM: zone.radiusM,
        distanceM: Math.round(distanceM),
      };
    }
  });

  const timeScore = getTimeScore();
  const watchScore = activeWatchSession ? 0 : 8;
  const riskScore = Math.min(100, locationScore + timeScore + watchScore);
  const summary: string[] = [];

  if (matchedZone !== null) {
    const zone = matchedZone as MatchedZone;
    summary.push(`Near ${zone.name} (${zone.riskLevel.replace('_', ' ')}) risk zone.`);
  }

  if (timeScore > 0) {
    summary.push('Late-hour multiplier increased passive risk sensitivity.');
  }

  if (!activeWatchSession) {
    summary.push('No active trusted watcher is covering this route right now.');
  }

  if (summary.length === 0) {
    summary.push('No elevated environmental risk detected in this check.');
  }

  return {
    riskScore,
    stage: riskScore >= 56 ? 'soft_alert' : riskScore >= 31 ? 'suspicious' : 'monitoring',
    summary,
    snapshot: {
      locationScore,
      timeScore,
      watchScore,
      matchedZone,
      computedAt: new Date().toISOString(),
    },
  };
}
