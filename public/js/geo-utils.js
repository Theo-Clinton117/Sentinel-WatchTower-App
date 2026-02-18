const REVERSE_CACHE = new Map();
const FORWARD_CACHE = new Map();

const TILE_URLS = [
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'
];

export const NIGERIA_BOUNDS = [
  [4.0, 2.5],
  [14.8, 15.0]
];

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const r = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return r * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function createStableTileLayer(options = {}) {
  const maxZoom = options.maxZoom || 19;
  const attribution = options.attribution || '&copy; OpenStreetMap contributors';
  let providerIdx = 0;
  let recentErrors = 0;
  const layer = L.tileLayer(TILE_URLS[providerIdx], {
    maxZoom,
    attribution
  });

  layer.on('tileerror', () => {
    recentErrors += 1;
    if (recentErrors < 8 || providerIdx >= TILE_URLS.length - 1) return;
    providerIdx += 1;
    recentErrors = 0;
    layer.setUrl(TILE_URLS[providerIdx]);
  });

  layer.on('tileload', () => {
    if (recentErrors > 0) recentErrors -= 1;
  });

  return layer;
}

export function applyNigeriaMapBounds(map) {
  if (!map) return;
  map.setMaxBounds(NIGERIA_BOUNDS);
  map.fitBounds(NIGERIA_BOUNDS, { padding: [12, 12] });
  map.options.maxBoundsViscosity = 0.95;
}

export async function reverseGeocode(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (REVERSE_CACHE.has(key)) return REVERSE_CACHE.get(key);

  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'en');

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(`Reverse geocoding failed (${res.status})`);
  const data = await res.json();
  REVERSE_CACHE.set(key, data);
  return data;
}

export async function geocodePlace(query, countryCode = 'ng') {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) throw new Error('Destination is empty');
  if (FORWARD_CACHE.has(normalized)) return FORWARD_CACHE.get(normalized);

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', normalized);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('countrycodes', countryCode);

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Destination not found');
  }
  const hit = rows[0];
  const value = {
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    label: hit.display_name || normalized
  };
  FORWARD_CACHE.set(normalized, value);
  return value;
}

export async function getRoute(start, end, profile = 'driving') {
  if (!start || !end) throw new Error('Route coordinates missing');
  const coords = `${start.lng},${start.lat};${end.lng},${end.lat}`;
  const url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);
  const json = await res.json();
  if (!json.routes?.length) throw new Error('No route found');
  const best = json.routes[0];
  return {
    distanceMeters: Number(best.distance || 0),
    durationSeconds: Number(best.duration || 0),
    coordinates: (best.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng])
  };
}

export function watchLocation(options = {}) {
  const minMoveMeters = options.minMoveMeters ?? 10;
  const minIntervalMs = options.minIntervalMs ?? 4000;
  const onPosition = options.onPosition || (() => {});
  const onError = options.onError || (() => {});
  const geolocation = navigator.geolocation;
  if (!geolocation) throw new Error('Geolocation not supported');

  let lastEmit = null;
  const watchId = geolocation.watchPosition(
    position => {
      const now = Date.now();
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy;

      if (lastEmit) {
        const moved = haversineMeters(lastEmit.lat, lastEmit.lng, lat, lng);
        const elapsed = now - lastEmit.ts;
        if (moved < minMoveMeters && elapsed < minIntervalMs) return;
      }

      lastEmit = { lat, lng, ts: now };
      onPosition({ lat, lng, accuracy, timestamp: position.timestamp });
    },
    err => onError(err),
    {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      maximumAge: options.maximumAge ?? 15000,
      timeout: options.timeout ?? 15000
    }
  );

  return () => geolocation.clearWatch(watchId);
}

export function formatDuration(durationSeconds) {
  const mins = Math.round(durationSeconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
