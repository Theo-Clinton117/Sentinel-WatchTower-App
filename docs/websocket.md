# WebSocket

Namespace: `/sessions`

Events:
- `join` `{ sessionId }` -> joins room
- `leave` `{ sessionId }` -> leaves room
- `location:update` `{ sessionId, locations[] }`
- `session:status` `{ sessionId, status }`
