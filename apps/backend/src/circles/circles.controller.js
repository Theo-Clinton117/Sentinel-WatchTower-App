"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) { var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d; for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r; return c > 3 && r && Object.defineProperty(target, key, r), r; };
var __metadata = (this && this.__metadata) || function (k, v) { if (typeof Reflect === 'object' && typeof Reflect.metadata === 'function') return Reflect.metadata(k, v); };
var __param = (this && this.__param) || function (paramIndex, decorator) { return function (target, key) { decorator(target, key, paramIndex); }; };
const common = require('@nestjs/common');
const { JwtAuthGuard } = require('../common/guards/jwt-auth.guard');
const { CirclesService } = require('./circles.service');
let CirclesController = class CirclesController {
  constructor(service) { this.service = service; }
  list(req) { return this.service.list(req.user.sub); }
  create(req, body) { return this.service.create(req.user.sub, body); }
  members(req, id) { return this.service.members(req.user.sub, id); }
  invite(req, id, body) { return this.service.invite(req.user.sub, id, body); }
  accept(req, id) { return this.service.accept(req.user.sub, id); }
  invitations(req) { return this.service.invitations(req.user.sub); }
  decline(req, id) { return this.service.decline(req.user.sub, id); }
  leave(req, id) { return this.service.leave(req.user.sub, id); }
};
__decorate([common.Get(), __param(0, common.Req()), __metadata('design:paramtypes', [Object])], CirclesController.prototype, 'list', null);
__decorate([common.Post(), __param(0, common.Req()), __param(1, common.Body()), __metadata('design:paramtypes', [Object, Object])], CirclesController.prototype, 'create', null);
__decorate([common.Get(':id/members'), __param(0, common.Req()), __param(1, common.Param('id')), __metadata('design:paramtypes', [Object, String])], CirclesController.prototype, 'members', null);
__decorate([common.Post(':id/invitations'), __param(0, common.Req()), __param(1, common.Param('id')), __param(2, common.Body()), __metadata('design:paramtypes', [Object, String, Object])], CirclesController.prototype, 'invite', null);
__decorate([common.Post('invitations/:id/accept'), __param(0, common.Req()), __param(1, common.Param('id')), __metadata('design:paramtypes', [Object, String])], CirclesController.prototype, 'accept', null);
__decorate([common.Get('invitations/mine'), __param(0, common.Req()), __metadata('design:paramtypes', [Object])], CirclesController.prototype, 'invitations', null);
__decorate([common.Post('invitations/:id/decline'), __param(0, common.Req()), __param(1, common.Param('id')), __metadata('design:paramtypes', [Object, String])], CirclesController.prototype, 'decline', null);
__decorate([common.Post(':id/leave'), __param(0, common.Req()), __param(1, common.Param('id')), __metadata('design:paramtypes', [Object, String])], CirclesController.prototype, 'leave', null);
CirclesController = __decorate([common.Controller('circles'), common.UseGuards(JwtAuthGuard), __metadata('design:paramtypes', [CirclesService])], CirclesController);
exports.CirclesController = CirclesController;
