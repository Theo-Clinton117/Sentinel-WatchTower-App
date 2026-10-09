const assert = require('node:assert/strict');
const test = require('node:test');
const { CirclesService } = require('../src/circles/circles.service');

test('accepting a valid email invitation persists an active membership and consumes the invitation', async () => {
  const calls = [];
  const invitation = { id: 'invite-1', circle_id: 'circle-1', invited_user_id: null, invited_email: 'member@example.com' };
  const db = {
    transaction: async (work) => work({
      query: async (sql, params) => {
        calls.push({ sql, params });
        if (sql.includes('from safety_circle_invitations')) return { rows: [invitation] };
        if (sql.includes('select email from users')) return { rows: [{ email: 'MEMBER@example.com' }] };
        if (sql.includes('insert into safety_circle_members')) return { rows: [] };
        if (sql.includes('update safety_circle_invitations')) return { rows: [] };
        throw new Error(`Unexpected query: ${sql}`);
      },
    }),
  };

  const result = await new CirclesService(db).accept('member-1', invitation.id);

  assert.deepEqual(result, { accepted: true, circleId: 'circle-1' });
  assert.equal(calls.some(({ sql }) => sql.includes("status = 'active'")), true);
  assert.equal(calls.some(({ sql }) => sql.includes("status = 'accepted'")), true);
});

test('Circle invitation acceptance denies another account and never creates membership', async () => {
  let membershipWrite = false;
  const db = {
    transaction: async (work) => work({
      query: async (sql) => {
        if (sql.includes('from safety_circle_invitations')) {
          return { rows: [{ id: 'invite-1', circle_id: 'circle-1', invited_user_id: null, invited_email: 'member@example.com' }] };
        }
        if (sql.includes('select email from users')) return { rows: [{ email: 'other@example.com' }] };
        if (sql.includes('insert into safety_circle_members')) { membershipWrite = true; return { rows: [] }; }
        throw new Error(`Unexpected query: ${sql}`);
      },
    }),
  };

  await assert.rejects(() => new CirclesService(db).accept('other-user', 'invite-1'), (error) => error?.status === 403);
  assert.equal(membershipWrite, false);
});

test('expired or reused invitations cannot create a membership', async () => {
  let membershipWrite = false;
  const db = {
    transaction: async (work) => work({
      query: async (sql) => {
        if (sql.includes('from safety_circle_invitations')) return { rows: [] };
        if (sql.includes('insert into safety_circle_members')) membershipWrite = true;
        return { rows: [] };
      },
    }),
  };
  const service = new CirclesService(db);

  await assert.rejects(() => service.accept('member-1', 'expired-invite'), (error) => error?.status === 404);
  await assert.rejects(() => service.accept('member-1', 'used-invite'), (error) => error?.status === 404);
  assert.equal(membershipWrite, false);
});

test('only Circle owners can invite and duplicate pending invitations are reused', async () => {
  let inserted = false;
  const db = {
    query: async (sql) => {
      if (sql.includes('from safety_circle_members where')) return { rows: [{ role: 'owner' }] };
      if (sql.includes('from safety_circle_invitations')) {
        return { rows: [{ id: 'invite-1', status: 'pending', expires_at: '2030-01-01T00:00:00.000Z', created_at: '2026-01-01T00:00:00.000Z' }] };
      }
      if (sql.includes('insert into safety_circle_invitations')) { inserted = true; return { rows: [] }; }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const service = new CirclesService(db);
  const repeated = await service.invite('owner-1', 'circle-1', { email: 'member@example.com' });
  assert.equal(repeated.id, 'invite-1');
  assert.equal(inserted, false);

  db.query = async (sql) => sql.includes('from safety_circle_members where') ? { rows: [{ role: 'member' }] } : { rows: [] };
  await assert.rejects(() => service.invite('member-1', 'circle-1', { email: 'new@example.com' }), (error) => error?.status === 403);
});

test('pending or removed users are denied Circle member access', async () => {
  const service = new CirclesService({ query: async () => ({ rows: [] }) });
  await assert.rejects(() => service.requireMember('pending-user', 'circle-1'), (error) => error?.status === 404);
});
