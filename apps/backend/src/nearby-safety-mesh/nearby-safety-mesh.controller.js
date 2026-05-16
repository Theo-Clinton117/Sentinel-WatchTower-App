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
    return function (target, key) { decorator(target, key, paramIndex); };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NearbySafetyMeshController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const rate_limit_decorator_1 = require("../common/guards/rate-limit.decorator");
const nearby_safety_mesh_service_1 = require("./nearby-safety-mesh.service");
let NearbySafetyMeshController = class NearbySafetyMeshController {
    constructor(nearbySafetyMeshService) {
        this.nearbySafetyMeshService = nearbySafetyMeshService;
    }
    publish(req, body) {
        return this.nearbySafetyMeshService.publish(req.user.sub, body);
    }
    list(req, areaCell) {
        return this.nearbySafetyMeshService.list(req.user.sub, areaCell);
    }
};
exports.NearbySafetyMeshController = NearbySafetyMeshController;
__decorate([
    (0, common_1.Post)('signals'),
    (0, rate_limit_decorator_1.RateLimit)({ points: 120, duration: 60 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], NearbySafetyMeshController.prototype, "publish", null);
__decorate([
    (0, common_1.Get)('signals/:areaCell'),
    (0, rate_limit_decorator_1.RateLimit)({ points: 120, duration: 60 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('areaCell')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], NearbySafetyMeshController.prototype, "list", null);
exports.NearbySafetyMeshController = NearbySafetyMeshController = __decorate([
    (0, common_1.Controller)('nearby-safety-mesh'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [nearby_safety_mesh_service_1.NearbySafetyMeshService])
], NearbySafetyMeshController);
//# sourceMappingURL=nearby-safety-mesh.controller.js.map
