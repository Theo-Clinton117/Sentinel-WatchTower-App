# WebSocket

Namespace: `/sessions`

Authentication:
- Send the access token in the Socket.IO handshake as `auth.token` or an `Authorization: Bearer ...` header.
- Only the authenticated owner of a session can join its room.

Events:
- `join` `{ sessionId }` -> joins room
- `leave` `{ sessionId }` -> leaves room
- `location:update` `{ sessionId, locations[] }`
- `session:status` `{ sessionId, status }`
