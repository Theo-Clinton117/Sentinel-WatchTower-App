"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionsGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const jsonwebtoken = require("jsonwebtoken");
const db_service_1 = require("../db/db.service");
const runtime_1 = require("../config/runtime");
const ws_service_1 = require("./ws.service");
function getAccessToken(client) {
    const authToken = client.handshake?.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
        return authToken.trim();
    }
    const header = client.handshake?.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
        return header.slice(7).trim();
    }
    return null;
}
let SessionsGateway = class SessionsGateway {
    constructor(wsService, db) {
        this.wsService = wsService;
        this.db = db;
    }
    async handleConnection(client) {
        this.wsService.setServer(this.server);
        const token = getAccessToken(client);
        if (!token) {
            client.emit('connection:error', { message: 'Missing access token' });
            client.disconnect(true);
            return;
        }
        try {
            const payload = jsonwebtoken.verify(token, (0, runtime_1.getJwtAccessSecret)());
            if (!payload || typeof payload !== 'object' || !payload.sub) {
                throw new Error('Invalid token payload');
            }
            client.data.user = payload;
            client.emit('connected', { ok: true });
        }
        catch {
            client.emit('connection:error', { message: 'Invalid access token' });
            client.disconnect(true);
        }
    }
    handleDisconnect() {
        return;
    }
    async handleJoin(client, body) {
        const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';
        const userId = client.data?.user?.sub;
        if (!sessionId || !userId) {
            return { joined: false, sessionId: sessionId || null };
        }
        const sessionResult = await this.db.query('select id from watch_sessions where id = $1 and user_id = $2 limit 1', [sessionId, userId]);
        if (!sessionResult.rows[0]) {
            client.emit('session:error', { sessionId, message: 'Not authorized for this session' });
            return { joined: false, sessionId, reason: 'forbidden' };
        }
        if (body?.sessionId) {
            client.join(body.sessionId);
        }
        return { joined: true, sessionId: body?.sessionId };
    }
    async handleLeave(client, body) {
        const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';
        const userId = client.data?.user?.sub;
        if (sessionId && userId) {
            const sessionResult = await this.db.query('select id from watch_sessions where id = $1 and user_id = $2 limit 1', [sessionId, userId]);
            if (sessionResult.rows[0]) {
                client.leave(sessionId);
            }
        }
        return { left: true, sessionId: sessionId || null };
    }
};
exports.SessionsGateway = SessionsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], SessionsGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('join'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], SessionsGateway.prototype, "handleJoin", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leave'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], SessionsGateway.prototype, "handleLeave", null);
exports.SessionsGateway = SessionsGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        namespace: '/sessions',
        cors: {
            origin: (0, runtime_1.getCorsOrigins)(),
            credentials: true,
        },
    }),
    __metadata("design:paramtypes", [ws_service_1.WsService, db_service_1.DbService])
], SessionsGateway);
//# sourceMappingURL=sessions.gateway.js.map
