"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { RiskZonesService } = require("../src/risk-zones/risk-zones.service");

test("risk zones list returns active zones with stable mapped fields", async () => {
    const queries = [];
    const service = new RiskZonesService({
        async query(sql) {
            queries.push(sql);
            return {
                rows: [{
                    id: "zone-1",
                    name: "Market corridor",
                    center_lat: "6.5244",
                    center_lng: "3.3792",
                    radius_m: 250,
                    risk_level: "high",
                    status: "active",
                    created_at: "2026-06-09T10:00:00.000Z",
                    updated_at: "2026-06-09T11:00:00.000Z",
                    resolved_at: null,
                }],
            };
        },
    });

    const zones = await service.list();

    assert.equal(queries[0].includes("where coalesce(status, 'active') = 'active'"), true);
    assert.deepEqual(zones, [{
        id: "zone-1",
        name: "Market corridor",
        lat: 6.5244,
        lng: 3.3792,
        radiusM: 250,
        riskLevel: "high",
        status: "active",
        createdAt: "2026-06-09T10:00:00.000Z",
        updatedAt: "2026-06-09T11:00:00.000Z",
        resolvedAt: null,
    }]);
});

test("risk zones geography returns nested operating hierarchy", async () => {
    const service = new RiskZonesService({
        async query(sql) {
            assert.equal(sql.includes("from geopolitical_zones gz"), true);
            return {
                rows: [
                    {
                        zone_id: "geo-1",
                        zone_code: "south_south",
                        zone_name: "South South",
                        state_id: "state-1",
                        state_code: "rivers",
                        state_name: "Rivers",
                        state_type: "state",
                        operational_zone_id: "op-1",
                        operational_zone_code: "rivers_port_harcourt_metro",
                        operational_zone_name: "Port Harcourt Metro",
                        operational_zone_lgas: ["Port Harcourt", "Obio-Akpor"],
                        response_grid_id: "grid-1",
                        response_grid_code: "ph_metro_gra",
                        response_grid_name: "GRA",
                        response_grid_type: "neighborhood",
                    },
                    {
                        zone_id: "geo-1",
                        zone_code: "south_south",
                        zone_name: "South South",
                        state_id: "state-1",
                        state_code: "rivers",
                        state_name: "Rivers",
                        state_type: "state",
                        operational_zone_id: "op-1",
                        operational_zone_code: "rivers_port_harcourt_metro",
                        operational_zone_name: "Port Harcourt Metro",
                        operational_zone_lgas: ["Port Harcourt", "Obio-Akpor"],
                        response_grid_id: "grid-2",
                        response_grid_code: "ph_metro_d_line",
                        response_grid_name: "D-Line",
                        response_grid_type: "neighborhood",
                    },
                ],
            };
        },
    });

    const geography = await service.geography();

    assert.deepEqual(geography, [{
        id: "geo-1",
        code: "south_south",
        name: "South South",
        states: [{
            id: "state-1",
            code: "rivers",
            name: "Rivers",
            type: "state",
            operationalZones: [{
                id: "op-1",
                code: "rivers_port_harcourt_metro",
                name: "Port Harcourt Metro",
                lgas: ["Port Harcourt", "Obio-Akpor"],
                responseGrids: [
                    {
                        id: "grid-1",
                        code: "ph_metro_gra",
                        name: "GRA",
                        type: "neighborhood",
                    },
                    {
                        id: "grid-2",
                        code: "ph_metro_d_line",
                        name: "D-Line",
                        type: "neighborhood",
                    },
                ],
            }],
        }],
    }]);
});
