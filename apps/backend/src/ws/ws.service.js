"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsService = void 0;
const common_1 = require("@nestjs/common");
let WsService = class WsService {
    setServer(server) {
        this.server = server;
    }
    emitSessionLocation(sessionId, locations) {
        this.server?.to(sessionId).emit('location:update', { sessionId, locations });
    }
    emitSessionStatus(sessionId, status) {
        this.server?.to(sessionId).emit('session:status', { sessionId, status });
    }
};
exports.WsService = WsService;
exports.WsService = WsService = __decorate([
    (0, common_1.Injectable)()
], WsService);
//# sourceMappingURL=ws.service.js.map