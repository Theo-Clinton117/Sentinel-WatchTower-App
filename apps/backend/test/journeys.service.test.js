"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const { JourneysService } = require('../src/journeys/journeys.service');

test('an expired Safe Arrival check-in resolves the request without restarting the journey', async () => {
  const calls = [];
  const db = {
    async transaction(callback) {
      return callback({
        async query(sql, params) {
          calls.push({ sql, params });
          if (sql.startsWith('update safety_journeys')) {
            return { rows: [{ id: 'journey-1', user_id: 'user-1', status: 'expired', check_in_requested_at: null, last_check_in_at: '2030-01-01T00:00:00.000Z' }] };
          }
          if (sql.startsWith('select recipient_user_id')) return { rows: [{ recipient_user_id: 'recipient-1' }] };
          if (sql.startsWith('insert into notifications')) return { rows: [] };
          throw new Error(`Unexpected query: ${sql}`);
        },
      });
    },
  };
  const service = new JourneysService(db);
  try {
    const journey = await service.checkIn('user-1', 'journey-1');
    assert.equal(journey.status, 'expired');
    assert.equal(calls[0].sql.includes("status='expired'"), true);
    assert.equal(calls[0].sql.includes("status='active'"), false);
    assert.equal(calls.some((call) => call.sql.startsWith('insert into notifications')), true);
  } finally {
    service.onModuleDestroy();
  }
});
