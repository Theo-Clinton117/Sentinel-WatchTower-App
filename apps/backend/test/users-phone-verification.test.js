const assert = require('node:assert/strict');
const test = require('node:test');
const { UsersService } = require('../src/users/users.service');

test('profile retrieval returns the persisted phone verification state', async () => {
  const user = {
    id: 'user-1',
    phone_e164: '+2348012345678',
    phone_verified: true,
    email: 'member@example.com',
    name: 'Member',
    status: 'active',
    password_hash: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
  const db = {
    async query(sql) {
      if (sql.includes('select * from users where id')) return { rows: [user] };
      if (sql.includes('from user_credibility_profiles')) {
        return { rows: [{ user_id: user.id, score: 50, rating_tier: 'mid', restriction_level: 'none' }] };
      }
      if (sql.includes('insert into roles')) return { rows: [] };
      if (sql.includes('select r.name')) return { rows: [{ name: 'user' }] };
      if (sql.includes('from reviewer_role_requests')) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  const profile = await new UsersService(db).getMe(user.id);

  assert.equal(profile.phone, '+2348012345678');
  assert.equal(profile.phoneVerified, true);
});
