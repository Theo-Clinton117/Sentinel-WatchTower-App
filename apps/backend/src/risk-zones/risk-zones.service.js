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
      select
        id,
        name,
        center_lat,
        center_lng,
        radius_m,
        risk_level,
        status,
        created_at,
        updated_at,
        resolved_at
      from risk_zones
      where coalesce(status, 'active') = 'active'
        and center_lat is not null
        and center_lng is not null
      order by coalesce(updated_at, created_at) desc
      limit 500
    `);
        return result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            lat: Number(row.center_lat),
            lng: Number(row.center_lng),
            radiusM: row.radius_m,
            riskLevel: row.risk_level,
            status: row.status || 'active',
            createdAt: row.created_at,
            updatedAt: row.updated_at || null,
            resolvedAt: row.resolved_at || null,
        }));
    }
    async geography() {
        const result = await this.db.query(`
      select
        gz.id as zone_id,
        gz.code as zone_code,
        gz.name as zone_name,
        gz.sort_order as zone_sort_order,
        st.id as state_id,
        st.code as state_code,
        st.name as state_name,
        st.type as state_type,
        st.sort_order as state_sort_order,
        oz.id as operational_zone_id,
        oz.code as operational_zone_code,
        oz.name as operational_zone_name,
        oz.lgas as operational_zone_lgas,
        oz.sort_order as operational_zone_sort_order,
        rg.id as response_grid_id,
        rg.code as response_grid_code,
        rg.name as response_grid_name,
        rg.grid_type as response_grid_type,
        rg.sort_order as response_grid_sort_order
      from geopolitical_zones gz
      left join states st on st.geopolitical_zone_id = gz.id
      left join operational_zones oz on oz.state_id = st.id
      left join response_grids rg on rg.operational_zone_id = oz.id
      order by
        gz.sort_order,
        st.sort_order nulls last,
        oz.sort_order nulls last,
        rg.sort_order nulls last,
        gz.name,
        st.name,
        oz.name,
        rg.name
    `);
        const zones = [];
        const zonesById = new Map();
        const statesById = new Map();
        const operationalZonesById = new Map();
        for (const row of result.rows) {
            let zone = zonesById.get(row.zone_id);
            if (!zone) {
                zone = {
                    id: row.zone_id,
                    code: row.zone_code,
                    name: row.zone_name,
                    states: [],
                };
                zonesById.set(row.zone_id, zone);
                zones.push(zone);
            }
            if (!row.state_id) {
                continue;
            }
            let state = statesById.get(row.state_id);
            if (!state) {
                state = {
                    id: row.state_id,
                    code: row.state_code,
                    name: row.state_name,
                    type: row.state_type,
                    operationalZones: [],
                };
                statesById.set(row.state_id, state);
                zone.states.push(state);
            }
            if (!row.operational_zone_id) {
                continue;
            }
            let operationalZone = operationalZonesById.get(row.operational_zone_id);
            if (!operationalZone) {
                operationalZone = {
                    id: row.operational_zone_id,
                    code: row.operational_zone_code,
                    name: row.operational_zone_name,
                    lgas: row.operational_zone_lgas || [],
                    responseGrids: [],
                };
                operationalZonesById.set(row.operational_zone_id, operationalZone);
                state.operationalZones.push(operationalZone);
            }
            if (row.response_grid_id) {
                operationalZone.responseGrids.push({
                    id: row.response_grid_id,
                    code: row.response_grid_code,
                    name: row.response_grid_name,
                    type: row.response_grid_type,
                });
            }
        }
        return zones;
    }
};
exports.RiskZonesService = RiskZonesService;
exports.RiskZonesService = RiskZonesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService])
], RiskZonesService);
//# sourceMappingURL=risk-zones.service.js.map
