"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskZonesService = void 0;
const common_1 = require("@nestjs/common");
const db_service_1 = require("../db/db.service");
let RiskZonesService = class RiskZonesService {
    constructor(db) {
        this.db = db;
    }
    async list() {
        const result = await this.db.query(`
      select *
      from risk_zones
      order by created_at desc
    `);
        return result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            lat: Number(row.lat),
            lng: Number(row.lng),
            radiusM: row.radius_m,
            riskLevel: row.risk_level,
            createdAt: row.created_at,
        }));
    }
};
exports.RiskZonesService = RiskZonesService;
exports.RiskZonesService = RiskZonesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService])
], RiskZonesService);
//# sourceMappingURL=risk-zones.service.js.map
