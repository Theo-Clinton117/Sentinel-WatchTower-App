const test = require('node:test');
const assert = require('node:assert/strict');
const { AuthService } = require('../src/auth/auth.service');

function createDb(responseMap = {}) {
  const calls = [];
  return {
    calls,
    async transaction(callback) {
      const client = {
        async query(sql, params) {
          calls.push({ sql, params });
          for (const [needle, rows] of responseMap) {
            if (sql.includes(needle)) {
              return { rows: typeof rows === 'function' ? rows(sql, params) : rows };
            }
          }
          throw new Error(`Unexpected query: ${sql}`);
        },
      };
      return callback(client);
    },
  };
}

test('refresh token rotation revokes the old session and issues a replacement', async () => {
  const db = createDb([
    ['insert into auth_refresh_sessions', [{ id: 'session-new' }]],
    ['update auth_refresh_sessions', []],
    [
      'from auth_refresh_sessions',
      [
        {
          id: 'session-old',
          user_id: 'user-1',
          token_id: 'old-jti',
          revoked_at: null,
          expires_at: '2126-01-01T00:00:00.000Z',
          device_id: 'device-1',
        },
      ],
    ],
    [
      'from users',
      [
        {
          id: 'user-1',
          email: 'pilot@example.com',
          phone_e164: null,
          name: 'Pilot',
          status: 'active',
          created_at: '2026-08-01T00:00:00.000Z',
          updated_at: '2026-08-01T00:00:00.000Z',
        },
      ],
    ],
  ]);
  const jwt = {
    verify: () => ({ sub: 'user-1', jti: 'old-jti' }),
    sign: (payload, options) => (options?.secret ? 'new-refresh-token' : 'new-access-token'),
    decode: () => ({ exp: Math.floor(Date.now() / 1000) + 60 * 60 }),
  };
  const service = new AuthService(db, jwt, { isEnabled: () => false });

  const result = await service.rotateRefreshToken('old-refresh-token');

  assert.equal(result.refreshToken, 'new-refresh-token');
  assert.equal(result.user.id, 'user-1');
  assert.equal(db.calls.some((call) => call.sql.includes('insert into auth_refresh_sessions')), true);
  assert.equal(db.calls.some((call) => call.sql.includes('update auth_refresh_sessions')), true);
});

test('logout revokes the refresh session', async () => {
  const db = createDb([
    [
      'from auth_refresh_sessions',
      [
        {
          id: 'session-old',
          user_id: 'user-1',
          token_id: 'old-jti',
          revoked_at: null,
          expires_at: '2126-01-01T00:00:00.000Z',
          device_id: 'device-1',
        },
      ],
    ],
    ['update auth_refresh_sessions', []],
  ]);
  const jwt = {
    verify: () => ({ sub: 'user-1', jti: 'old-jti' }),
  };
  const service = new AuthService(db, jwt, { isEnabled: () => false });

  const result = await service.logout('old-refresh-token');

  assert.deepEqual(result, { success: true });
  assert.equal(db.calls.some((call) => call.sql.includes('update auth_refresh_sessions')), true);
});
