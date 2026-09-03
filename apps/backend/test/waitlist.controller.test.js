require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { RATE_LIMIT_KEY } = require('../src/common/guards/rate-limit.decorator');
const { WaitlistController } = require('../src/waitlist/waitlist.controller');

test('waitlist signup is rate limited', () => {
  const metadata = Reflect.getMetadata(RATE_LIMIT_KEY, WaitlistController.prototype.signup);
  assert.deepEqual(metadata, { points: 10, duration: 3600 });
});
