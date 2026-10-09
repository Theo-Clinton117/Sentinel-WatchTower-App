"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const { LocationsService } = require('../src/locations/locations.service');

test('Circle membership cannot bypass a missing explicit location grant', async () => {
  const calls = [];
  const service = new LocationsService({
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('from location_access_grants')) return { rows: [] };
      if (sql.includes('location_access_audit_events')) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    },
  }, { emitSessionLocation() {} });
  await assert.rejects(() => service.latestSharedLocation('circle-member', 'subject'), /has not shared/);
  assert.equal(calls.some((call) => call.sql.includes("'denied'")), true);
});

test('an authorized stale coordinate is labelled last confirmed, never current', async () => {
  const service = new LocationsService({
    async query(sql) {
      if (sql.includes('from location_access_grants')) return { rows: [{ id: 'grant-1', purpose: 'emergency', expires_at: '2030-01-01T00:00:00.000Z' }] };
      if (sql.includes('from location_logs')) {
        assert.equal(sql.includes('latitude, longitude, accuracy'), true);
        return { rows: [{ id: 'location-1', session_id: 'session-1', user_id: 'subject', latitude: 6.5, longitude: 3.3, accuracy: 12, recorded_at: '2020-01-01T00:00:00.000Z' }] };
      }
      if (sql.includes('location_access_audit_events')) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    },
  }, { emitSessionLocation() {} });
  const result = await service.latestSharedLocation('recipient', 'subject');
  assert.equal(result.status, 'last_confirmed');
  assert.equal(result.location.accuracyM, 12);
});
