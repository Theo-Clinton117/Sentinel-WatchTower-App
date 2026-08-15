"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { OrganizationsService } = require("../src/organizations/organizations.service");

function createDb(handler) {
    return {
        async query(sql, params) {
            return handler(sql, params);
        },
        async transaction(work) {
            return work(this);
        },
    };
}

test("organization registration creates an owner membership and registered locations", async () => {
    const calls = [];
    const db = createDb(async (sql, params) => {
        calls.push({ sql, params });
        if (sql.includes("insert into organizations")) {
            return {
                rows: [{
                    id: "org-1",
                    name: "University A",
                    organization_type: "UNIVERSITY",
                    status: "PENDING_VERIFICATION",
                    official_email: "security@university.example",
                    official_phone: "+15550000010",
                    physical_address: "1 Campus Way",
                    registration_info: { rc: "123" },
                    representative_name: "Ada Admin",
                    representative_contact: { phone: "+15550000011" },
                    intended_operating_jurisdiction: "Lagos",
                    verified_at: null,
                    created_by_user_id: "user-1",
                    created_at: "2026-06-09T10:00:00.000Z",
                    updated_at: "2026-06-09T10:00:00.000Z",
                }],
            };
        }
        if (sql.includes("insert into organization_members")) {
            return {
                rows: [{
                    id: "membership-1",
                    organization_id: "org-1",
                    user_id: "user-1",
                    role_code: "OWNER",
                    status: "ACTIVE",
                    permissions: {},
                    invited_by_user_id: "user-1",
                    invitation_channel: "registration",
                    joined_at: "2026-06-09T10:00:00.000Z",
                    created_at: "2026-06-09T10:00:00.000Z",
                    updated_at: "2026-06-09T10:00:00.000Z",
                }],
            };
        }
        if (sql.includes("insert into organization_locations")) {
            return {
                rows: [{
                    id: "location-1",
                    organization_id: "org-1",
                    name: "Main Campus",
                    location_type: "campus",
                    center_lat: 6.5244,
                    center_lng: 3.3792,
                    boundary_geojson: null,
                    active: true,
                    created_at: "2026-06-09T10:00:00.000Z",
                    updated_at: "2026-06-09T10:00:00.000Z",
                }],
            };
        }
        if (sql.includes("insert into organization_audit_logs")) {
            return { rows: [] };
        }
        throw new Error(`Unexpected query: ${sql}`);
    });

    const service = new OrganizationsService(db);
    const result = await service.register("user-1", {
        name: "University A",
        organizationType: "university",
        officialEmail: "security@university.example",
        officialPhone: "+15550000010",
        physicalAddress: "1 Campus Way",
        representativeName: "Ada Admin",
        representativeContact: { phone: "+15550000011" },
        intendedOperatingJurisdiction: "Lagos",
        registrationInfo: { rc: "123" },
        registeredLocations: [{
            name: "Main Campus",
            locationType: "campus",
            centerLat: 6.5244,
            centerLng: 3.3792,
            active: true,
        }],
    });

    assert.equal(calls.some((call) => call.sql.includes("insert into organizations")), true);
    assert.equal(result.organization.name, "University A");
    assert.equal(result.membership.roleCode, "OWNER");
    assert.equal(result.locations.length, 1);
});

test("organization broadcasts fan out to active members and record audit data", async () => {
    const calls = [];
    const db = createDb(async (sql, params) => {
        calls.push({ sql, params });
        if (sql.includes("select") && sql.includes("from organizations o")) {
            return {
                rows: [{
                    membership_id: "membership-1",
                    user_id: "user-1",
                    organization_id: "org-1",
                    role_code: "OWNER",
                    membership_status: "ACTIVE",
                    membership_permissions: {},
                    name: "University A",
                    organization_status: "VERIFIED",
                    intended_operating_jurisdiction: "Lagos",
                }],
            };
        }
        if (sql.includes("insert into organization_alerts")) {
            return {
                rows: [{
                    id: "org-alert-1",
                    alert_type: "ORGANIZATION_BROADCAST",
                    delivery_scope: "members",
                    priority_score: "4.8400",
                    dedupe_key: "broadcast-1",
                    payload: { title: "Campus closed tomorrow" },
                    created_at: "2026-06-09T10:00:00.000Z",
                }],
            };
        }
        if (sql.includes("from organization_members") && sql.includes("status = 'ACTIVE'")) {
            return {
                rows: [{ user_id: "user-1" }, { user_id: "user-2" }],
            };
        }
        if (sql.includes("insert into alert_deliveries")) {
            return { rows: [] };
        }
        if (sql.includes("insert into organization_audit_logs")) {
            return { rows: [] };
        }
        throw new Error(`Unexpected query: ${sql}`);
    });

    const service = new OrganizationsService(db);
    const result = await service.createBroadcast("user-1", "org-1", {
        title: "Campus closed tomorrow",
        description: "Operations are paused.",
        severity: "high",
    });

    assert.equal(result.alert.alertType, "ORGANIZATION_BROADCAST");
    assert.equal(result.recipientCount, 2);
    assert.equal(calls.filter((call) => call.sql.includes("insert into alert_deliveries")).length, 2);
});

test("organization routing preview scores nearby organizations higher", async () => {
    const db = createDb(async (sql) => {
        if (sql.includes("from organization_members m") && sql.includes("and m.status = 'ACTIVE'")) {
            return {
                rows: [{
                    organization_id: "org-1",
                    role_code: "ADMIN",
                    membership_status: "ACTIVE",
                    membership_permissions: {},
                    name: "University A",
                    organization_status: "VERIFIED",
                    intended_operating_jurisdiction: "Lagos",
                }],
            };
        }
        if (sql.includes("from organization_locations")) {
            return {
                rows: [{
                    id: "location-1",
                    organization_id: "org-1",
                    name: "Main Campus",
                    location_type: "campus",
                    center_lat: 6.5244,
                    center_lng: 3.3792,
                    boundary_geojson: {
                        type: "Polygon",
                        coordinates: [[
                            [3.3780, 6.5230],
                            [3.3810, 6.5230],
                            [3.3810, 6.5260],
                            [3.3780, 6.5260],
                            [3.3780, 6.5230],
                        ]],
                    },
                    active: true,
                    created_at: "2026-06-09T10:00:00.000Z",
                    updated_at: "2026-06-09T10:00:00.000Z",
                }],
            };
        }
        if (sql.includes("from organization_jurisdictions")) {
            return { rows: [] };
        }
        throw new Error(`Unexpected query: ${sql}`);
    });

    const service = new OrganizationsService(db);
    const result = await service.previewRouting("user-1", {
        severity: "critical",
        lat: 6.5244,
        lng: 3.3792,
    });

    assert.equal(result.organizations.length, 1);
    assert.equal(result.organizations[0].organizationId, "org-1");
    assert.equal(result.organizations[0].geographicMatch.matched, true);
    assert.equal(result.dedupeKey.length > 0, true);
});
