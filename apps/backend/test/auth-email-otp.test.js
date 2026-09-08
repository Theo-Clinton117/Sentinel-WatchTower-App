const test = require('node:test');
const assert = require('node:assert/strict');
const { AuthService } = require('../src/auth/auth.service');

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

test('Resend email OTPs are random six-digit codes and are not exposed as devCode', async () => {
  await withEnv(
    {
      NODE_ENV: 'production',
      EMAIL_OTP_PROVIDER: 'resend',
      RESEND_API_KEY: 'resend-test',
      OTP_EMAIL_FROM: 'security@example.com',
      SUPABASE_URL: undefined,
      SUPABASE_SECRET_KEY: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    },
    async () => {
      const stored = [];
      const messages = [];
      const originalFetch = global.fetch;
      global.fetch = async (_url, options) => {
        messages.push(JSON.parse(options.body));
        return { ok: true };
      };

      try {
        const service = new AuthService({
          async query(sql, params) {
            if (sql.includes('insert into email_otp_challenges')) {
              stored.push({ sql, params });
              return { rows: [] };
            }
            throw new Error(`Unexpected query: ${sql}`);
          },
        }, { sign: () => 'token' }, { isEnabled: () => false });

        const first = await service.requestOtp({
          email: 'test@example.com',
          name: 'Test User',
          mode: 'signup',
          deviceId: 'device-1',
        });
        const second = await service.requestOtp({
          email: 'test@example.com',
          name: 'Test User',
          mode: 'signup',
          deviceId: 'device-1',
        });

        const firstCode = messages[0].text.match(/code is (\d{6})/)?.[1];
        const secondCode = messages[1].text.match(/code is (\d{6})/)?.[1];
        assert.match(firstCode, /^\d{6}$/);
        assert.match(secondCode, /^\d{6}$/);
        assert.notEqual(firstCode, secondCode);
        assert.equal(first.devCode, undefined);
        assert.equal(second.devCode, undefined);
        assert.equal(stored.length, 2);
        assert.equal(stored[0].params.length, 4);
        assert.notEqual(stored[0].params[2], firstCode);
      } finally {
        global.fetch = originalFetch;
      }
    },
  );
});

test('email OTP verification succeeds with the generated code and rejects an invalid code with 400', async () => {
  await withEnv(
    {
      NODE_ENV: 'production',
      EMAIL_OTP_PROVIDER: 'resend',
      OTP_CODE_SECRET: 'test-secret',
    },
    async () => {
      let storedHash;
      const client = {
        async query(sql) {
          if (sql.includes('from email_otp_challenges')) {
            return { rows: [{ id: 'challenge-1', name: 'Test User', code_hash: storedHash, attempts: 0 }] };
          }
          return { rows: [] };
        },
      };
      const db = {
        async transaction(work) {
          return work(client);
        },
      };
      const service = new AuthService(db, { sign: () => 'token' }, { isEnabled: () => false });
      const originalFetch = global.fetch;
      let sentCode;
      global.fetch = async (_url, options) => {
        sentCode = JSON.parse(options.body).text.match(/code is (\d{6})/)?.[1];
        return { ok: true };
      };

      try {
        const captureDb = {
          async query(_sql, params) {
            storedHash = params[2];
            return { rows: [] };
          },
        };
        const captureService = new AuthService(captureDb, { sign: () => 'token' }, { isEnabled: () => false });
        await captureService.requestOtp({
          email: 'test@example.com',
          name: 'Test User',
          mode: 'signup',
          deviceId: 'device-1',
        });
        const verifiedName = await service.verifyEmailCode('test@example.com', sentCode);
        assert.equal(verifiedName, 'Test User');
        await assert.rejects(
          () => service.verifyEmailCode('test@example.com', '000000'),
          (error) => error?.status === 400,
        );
      } finally {
        global.fetch = originalFetch;
      }
    },
  );
});
