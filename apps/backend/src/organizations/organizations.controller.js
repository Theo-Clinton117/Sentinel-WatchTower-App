"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? decorators : desc === null ? Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, r);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) d(r);
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const rate_limit_decorator_1 = require("../common/guards/rate-limit.decorator");
const organizations_service_1 = require("./organizations.service");
let OrganizationsController = class OrganizationsController {
    constructor(organizationsService) {
        this.organizationsService = organizationsService;
    }
    register(req, body) {
        return this.organizationsService.register(req.user.sub, body);
    }
    listMine(req) {
        return this.organizationsService.listMine(req.user.sub);
    }
    getById(req, id) {
        return this.organizationsService.getById(req.user.sub, id);
    }
    members(req, id) {
        return this.organizationsService.listMembers(req.user.sub, id);
    }
    invite(req, id, body) {
        return this.organizationsService.createInvitation(req.user.sub, id, body);
    }
    acceptInvitation(req, token) {
        return this.organizationsService.acceptInvitation(req.user.sub, token);
    }
    createLocation(req, id, body) {
        return this.organizationsService.upsertLocation(req.user.sub, id, body);
    }
    updateLocation(req, id, locationId, body) {
        return this.organizationsService.upsertLocation(req.user.sub, id, body, locationId);
    }
    createBroadcast(req, id, body) {
        return this.organizationsService.createBroadcast(req.user.sub, id, body);
    }
    previewRouting(req, body) {
        return this.organizationsService.previewRouting(req.user.sub, body);
    }
};
exports.OrganizationsController = OrganizationsController;
__decorate([
    (0, common_1.Post)('register'),
    (0, rate_limit_decorator_1.RateLimit)({ points: 6, duration: 3600 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], OrganizationsController.prototype, "register", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OrganizationsController.prototype, "listMine", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OrganizationsController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)(':id/members'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OrganizationsController.prototype, "members", null);
__decorate([
    (0, common_1.Post)(':id/invitations'),
    (0, rate_limit_decorator_1.RateLimit)({ points: 30, duration: 3600 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], OrganizationsController.prototype, "invite", null);
__decorate([
    (0, common_1.Post)('invitations/:token/accept'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OrganizationsController.prototype, "acceptInvitation", null);
__decorate([
    (0, common_1.Post)(':id/locations'),
    (0, rate_limit_decorator_1.RateLimit)({ points: 60, duration: 3600 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], OrganizationsController.prototype, "createLocation", null);
__decorate([
    (0, common_1.Patch)(':id/locations/:locationId'),
    (0, rate_limit_decorator_1.RateLimit)({ points: 60, duration: 3600 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('locationId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", void 0)
], OrganizationsController.prototype, "updateLocation", null);
__decorate([
    (0, common_1.Post)(':id/broadcasts'),
    (0, rate_limit_decorator_1.RateLimit)({ points: 30, duration: 3600 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], OrganizationsController.prototype, "createBroadcast", null);
__decorate([
    (0, common_1.Post)('routing/preview'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], OrganizationsController.prototype, "previewRouting", null);
exports.OrganizationsController = OrganizationsController = __decorate([
    (0, common_1.Controller)('organizations'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [organizations_service_1.OrganizationsService])
], OrganizationsController);
