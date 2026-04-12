"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskZonesModule = void 0;
const common_1 = require("@nestjs/common");
const risk_zones_controller_1 = require("./risk-zones.controller");
const risk_zones_service_1 = require("./risk-zones.service");
let RiskZonesModule = class RiskZonesModule {
};
exports.RiskZonesModule = RiskZonesModule;
exports.RiskZonesModule = RiskZonesModule = __decorate([
    (0, common_1.Module)({
        controllers: [risk_zones_controller_1.RiskZonesController],
        providers: [risk_zones_service_1.RiskZonesService],
    })
], RiskZonesModule);
//# sourceMappingURL=risk-zones.module.js.map