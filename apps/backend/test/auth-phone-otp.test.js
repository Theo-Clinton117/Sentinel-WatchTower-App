const test = require('node:test');
const assert = require('node:assert/strict');
const { AuthService } = require('../src/auth/auth.service');

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
        mode: 'signup',
        deviceId: 'device-1',
      }),
    /phone_otp_challenges table is unavailable/,
  );
});
