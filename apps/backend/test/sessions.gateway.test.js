require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { SessionsGateway } = require('../src/ws/sessions.gateway');

function createClient(token) {
  const events = [];
  const joinCalls = [];
  const leaveCalls = [];
  return {
    handshake: {
      auth: token ? { token } : {},
      headers: {},
    },
    data: {},
    events,
    joinCalls,
    leaveCalls,
    emit(event, payload) {
      events.push([event, payload]);
    },
    join(sessionId) {
      joinCalls.push(sessionId);
    },
    leave(sessionId) {
      leaveCalls.push(sessionId);
    },
    disconnect() {
      events.push(['disconnect', true]);
    },
  };
}

test('sessions gateway rejects socket connections without a valid access token', async () => {
  const gateway = new SessionsGateway(
    {
      setServer(server) {
        this.server = server;
      },
    },
    {
      async query() {
        return { rows: [] };
      },
    },
  );
  const client = createClient(null);

  await gateway.handleConnection(client);

  assert.deepEqual(client.events[0], ['connection:error', { message: 'Missing access token' }]);
  assert.deepEqual(client.events[1], ['disconnect', true]);
});

test('sessions gateway only allows joining owned sessions', async () => {
  const secret = process.env.JWT_ACCESS_SECRET || 'change-me';
  const token = jwt.sign({ sub: 'user-1', email: 'pilot@example.com' }, secret);
  const gateway = new SessionsGateway(
    {
      setServer(server) {
        this.server = server;
      },
    },
    {
      async query(sql, params) {
        if (sql.includes('from watch_sessions')) {
          return {
            rows:
              params[0] === 'session-owned' && params[1] === 'user-1'
                ? [{ id: 'session-owned' }]
                : [],
          };
        }
        throw new Error(`Unexpected query: ${sql}`);
      },
    },
  );
  const client = createClient(token);

  await gateway.handleConnection(client);
  const denied = await gateway.handleJoin(client, { sessionId: 'session-other' });
  const allowed = await gateway.handleJoin(client, { sessionId: 'session-owned' });

  assert.equal(client.data.user.sub, 'user-1');
  assert.deepEqual(denied, {
    joined: false,
    sessionId: 'session-other',
    reason: 'forbidden',
  });
  assert.deepEqual(allowed, {
    joined: true,
    sessionId: 'session-owned',
  });
  assert.deepEqual(client.joinCalls, ['session-owned']);
});
