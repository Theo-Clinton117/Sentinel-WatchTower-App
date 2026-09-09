const test = require('node:test');
const assert = require('node:assert/strict');
const { AuthService, isPhoneValid, normalizePhone } = require('../src/auth/auth.service');

function withEnv(patch, work) {
  const previous = {};
  for (const key of Object.keys(patch)) {
    previous[key] = process.env[key];
    if (patch[key] === undefined) delete process.env[key];
    else process.env[key] = patch[key];
  }
  return Promise.resolve().then(work).finally(() => {
    for (const key of Object.keys(patch)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
}

test('normalizes Nigerian phone numbers to canonical E.164 and rejects malformed values', () => {
  assert.equal(normalizePhone('+2348012345678'), '+2348012345678');
  assert.equal(normalizePhone('2348012345678'), '+2348012345678');
  assert.equal(normalizePhone('08012345678'), '+2348012345678');
  assert.equal(normalizePhone('+234 801 234 5678'), '+2348012345678');
  assert.equal(isPhoneValid('+2348012345678'), true);
  assert.equal(isPhoneValid('08012345678'), true);
  assert.equal(isPhoneValid('+234abc8012345678'), false);
  assert.equal(isPhoneValid('+2358012345678'), false);
  assert.equal(isPhoneValid('+2346012345678'), false);
  assert.equal(isPhoneValid('+234801234567'), false);
  assert.equal(isPhoneValid('+234801234567890'), false);
  assert.equal(isPhoneValid('not-a-phone'), false);
});

test('phone signup returns a service unavailable error when phone OTP storage fails', async () => {
  const db = {
    async query(sql) {
      if (sql.includes('select id from users where phone_e164 = $1 limit 1')) {
        return { rows: [] };
      }

      if (sql.includes('insert into phone_otp_challenges')) {
        throw new Error('phone_otp_challenges table is unavailable');
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    transaction() {
      throw new Error('transaction should not be called during requestOtp');
    },
  };

  const service = new AuthService(db, { sign: () => 'token' }, {
    isEnabled: () => true,
    sendOtp: async () => true,
  });

  await assert.rejects(
    () =>
      service.requestOtp({
        phone: '+2348012345678',
        name: 'Test User',
        mode: 'signup',
        deviceId: 'device-1',
      }),
    /phone_otp_challenges table is unavailable/,
  );
});

test('signup OTP request rejects a missing name before sending a code', async () => {
  const db = {
    async query() {
      throw new Error('database should not be queried');
    },
    transaction() {
      throw new Error('transaction should not be called');
    },
  };

  const service = new AuthService(db, { sign: () => 'token' }, {
    isEnabled: () => false,
  });

  await assert.rejects(
    () =>
      service.requestOtp({
        email: 'test@example.com',
        mode: 'signup',
        deviceId: 'device-1',
      }),
    /Name is required for signup/,
  );
});

test('phone OTP signup verifies, consumes the challenge, registers the device, role, credibility, and session', async () => {
  await withEnv(
    {
      NODE_ENV: 'production',
      OTP_CODE_SECRET: 'test-secret',
      JWT_REFRESH_SECRET: 'refresh-secret-12345678901234567890',
      KUDISMS_TOKEN: 'token',
      KUDISMS_SENDER_ID: 'Sentinel',
      KUDISMS_APP_NAME_CODE: 'sentinel-app',
      KUDISMS_TEMPLATE_CODE: 'sentinel-otp',
    },
    async () => {
      let storedHash;
      let sentCode;
      let transactionCount = 0;
      let consumed = false;
      const operations = [];
      const originalFetch = global.fetch;
      global.fetch = async (_url, options) => {
        sentCode = options.body.get('otp');
        assert.equal(options.body.get('recipients'), '+2348012345678');
        return { ok: true, status: 200 };
      };

      const user = {
        id: 'user-1',
        email: null,
        name: 'Test User',
        phone_e164: '+2348012345678',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const db = {
        async query(sql, params) {
          operations.push({ sql, params });
          if (sql.includes('insert into phone_otp_challenges')) {
            storedHash = params[1];
            return { rows: [] };
          }
          if (sql.includes('from user_credibility_profiles')) return { rows: [] };
          if (sql.includes('insert into user_credibility_profiles')) {
            return { rows: [{ user_id: user.id, score: 50, rating_tier: 'mid', restriction_level: 'none' }] };
          }
          if (sql.includes('insert into roles')) return { rows: [] };
          if (sql.includes('select r.name')) return { rows: [{ name: 'user' }] };
          if (sql.includes('from reviewer_role_requests')) return { rows: [] };
          throw new Error(`Unexpected query: ${sql}`);
        },
        async transaction(work) {
          transactionCount += 1;
          if (transactionCount === 1) {
            return work({
              async query(sql, params) {
                operations.push({ sql, params });
                if (sql.includes('from phone_otp_challenges')) {
                  if (consumed) return { rows: [] };
                  return { rows: [{ id: 'challenge-1', code_hash: storedHash, attempts: 0 }] };
                }
                if (sql.includes('set consumed_at')) {
                  consumed = true;
                  return { rows: [] };
                }
                throw new Error(`Unexpected verification query: ${sql}`);
              },
            });
          }
          if (transactionCount === 2) {
            return work({
              async query(sql, params) {
                operations.push({ sql, params });
                if (sql.includes('select * from users')) return { rows: [] };
                if (sql.includes('insert into users')) return { rows: [user] };
                if (sql.includes('from user_devices')) return { rows: [] };
                if (sql.includes('insert into user_devices')) return { rows: [] };
                if (sql.includes('insert into roles')) return { rows: [] };
                if (sql.includes('insert into user_roles')) return { rows: [] };
                throw new Error(`Unexpected user transaction query: ${sql}`);
              },
            });
          }
          if (transactionCount === 3) {
            return work({
              async query(sql, params) {
                operations.push({ sql, params });
                if (sql.includes('insert into auth_refresh_sessions')) return { rows: [] };
                throw new Error(`Unexpected session transaction query: ${sql}`);
              },
            });
          }
          return work({ query: async () => ({ rows: [] }) });
        },
      };

      const jwt = {
        sign: (_payload, options) => (options?.secret ? 'refresh-token' : 'access-token'),
        decode: () => ({ exp: Math.floor(Date.now() / 1000) + 1800 }),
      };
      const service = new AuthService(db, jwt, { isEnabled: () => false });

      try {
        const request = await service.requestOtp({
          phone: '08012345678',
          name: 'Test User',
          mode: 'signup',
          deviceId: 'device-1',
        });
        assert.equal(request.phone, '+2348012345678');
        assert.equal(request.devCode, undefined);
        assert.match(sentCode, /^\d{6}$/);
        assert.equal(storedHash.length, 64);

        const result = await service.verifyOtp({
          phone: '2348012345678',
          name: 'Test User',
          code: sentCode,
          mode: 'signup',
          deviceId: 'device-1',
        });
        assert.equal(result.accessToken, 'access-token');
        assert.equal(result.refreshToken, 'refresh-token');
        assert.equal(result.user.phone, '+2348012345678');
        assert.equal(consumed, true);
        assert.equal(operations.some(({ sql }) => sql.includes('insert into user_devices')), true);
        assert.equal(operations.some(({ sql }) => sql.includes('insert into user_roles')), true);
        assert.equal(operations.some(({ sql }) => sql.includes('insert into auth_refresh_sessions')), true);

        await assert.rejects(
          () => service.verifyPhoneCode('+2348012345678', sentCode),
          (error) => error?.status === 401,
        );
      } finally {
        global.fetch = originalFetch;
      }
    },
  );
});

test('phone verification query enforces expiry, attempt limit, and consumed state', async () => {
  const queries = [];
  const service = new AuthService({
    transaction: async (work) => work({
      query: async (sql) => {
        queries.push(sql);
        return { rows: [] };
      },
    }),
  }, { sign: () => 'token' }, { isEnabled: () => false });

  await assert.rejects(
    () => service.verifyPhoneCode('+2348012345678', '123456'),
    (error) => error?.status === 401,
  );
  assert.match(queries[0], /consumed_at is null/);
  assert.match(queries[0], /expires_at > now\(\)/);
  assert.match(queries[0], /attempts < 5/);
  assert.doesNotMatch(queries[0], /select id, name/);
});
