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
const ws_service_1 = require("./ws.service");
let SessionsGateway = class SessionsGateway {
    constructor(wsService) {
        this.wsService = wsService;
    }
    handleConnection(client) {
        this.wsService.setServer(this.server);
        client.emit('connected', { ok: true });
    }
    handleDisconnect() {
        return;
    }
    handleJoin(client, body) {
        if (body?.sessionId) {
            client.join(body.sessionId);
        }
        return { joined: true, sessionId: body?.sessionId };
    }
    handleLeave(client, body) {
        if (body?.sessionId) {
            client.leave(body.sessionId);
        }
        return { left: true, sessionId: body?.sessionId };
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
            origin: '*',
            credentials: true,
        },
    }),
    __metadata("design:paramtypes", [ws_service_1.WsService])
], SessionsGateway);
//# sourceMappingURL=sessions.gateway.js.map