"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c > 3 ? d(target, key, r) : c > 2 ? d(target, key) : d(r)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaystackWebhookController = void 0;
const common_1 = require("@nestjs/common");
const subscriptions_service_1 = require("./subscriptions.service");
let PaystackWebhookController = class PaystackWebhookController {
    constructor(subscriptionsService) {
        this.subscriptionsService = subscriptionsService;
    }
    webhook(req) {
        return this.subscriptionsService.handlePaystackWebhook(req.rawBody || req.body, req.headers['x-paystack-signature']);
    }
};
exports.PaystackWebhookController = PaystackWebhookController;
__decorate([
    (0, common_1.Post)('paystack/webhook'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PaystackWebhookController.prototype, "webhook", null);
exports.PaystackWebhookController = PaystackWebhookController = __decorate([
    (0, common_1.Controller)('payments'),
    __metadata("design:paramtypes", [subscriptions_service_1.SubscriptionsService])
], PaystackWebhookController);
