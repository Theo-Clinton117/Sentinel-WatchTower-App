"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LatencyModule = void 0;
const common_1 = require("@nestjs/common");
const latency_controller_1 = require("./latency.controller");
const latency_service_1 = require("./latency.service");
let LatencyModule = class LatencyModule {
};
exports.LatencyModule = LatencyModule;
exports.LatencyModule = LatencyModule = __decorate([
    (0, common_1.Module)({
        controllers: [latency_controller_1.LatencyController],
        providers: [latency_service_1.LatencyService],
    })
], LatencyModule);
//# sourceMappingURL=latency.module.js.map
