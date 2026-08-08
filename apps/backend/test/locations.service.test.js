"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { LocationsService } = require("../src/locations/locations.service");

function createDb() {
    const calls = [];
    return {
        calls,
        async query(sql, params) {
            calls.push({ sql, params });
            if (sql.includes("select id from watch_sessions")) {
                return { rows: [{ id: "session-1" }] };
            }
            throw new Error(`Unexpected query: ${sql}`);
        },
        async transaction(callback) {
            const client = {
                async query(sql, params) {
                    calls.push({ sql, params });
                    if (sql.includes("insert into location_logs")) {
                        return {
                            rows: [{
                                id: "location-1",
                                session_id: params[0],
                                user_id: params[1],
                                lat: params[2],
                                lng: params[3],
                                accuracy_m: params[4],
                                source: params[5],
                                recorded_at: params[6],
                                created_at: "2026-06-09T10:00:00.000Z",
                            }],
                        };
                    }
                    if (sql.includes("update watch_sessions")) {
                        return { rows: [] };
                    }
                    throw new Error(`Unexpected query: ${sql}`);
                },
            };
            return callback(client);
        },
    };
}

test("location ingest rejects coordinates outside valid ranges", async () => {
    const service = new LocationsService(createDb(), { emitSessionLocation() {} });

    await assert.rejects(() => service.ingest("user-1", "session-1", {
        locations: [{ lat: 200, lng: 3.3792 }],
    }), /No valid locations/);
});

test("location ingest normalizes numeric strings, timestamps, accuracy, and source", async () => {
    const db = createDb();
    const emitted = [];
    const service = new LocationsService(db, {
        emitSessionLocation(sessionId, payload) {
            emitted.push({ sessionId, payload });
        },
    });

    const result = await service.ingest("user-1", "session-1", {
        locations: [{
            lat: "6.5244",
            lng: "3.3792",
            accuracy: "12.5",
            source: " gps ",
            recordedAt: "2026-06-09T10:01:00.000Z",
        }],
    });

    assert.equal(result.received, 1);
    assert.equal(result.locations[0].lat, 6.5244);
    assert.equal(result.locations[0].lng, 3.3792);
    assert.equal(result.locations[0].accuracyM, 12.5);
    assert.equal(result.locations[0].source, "gps");
    assert.deepEqual(emitted[0].payload, result.locations);
});

test("location ingest limits batch size", async () => {
    const service = new LocationsService(createDb(), { emitSessionLocation() {} });

    await assert.rejects(() => service.ingest("user-1", "session-1", {
        locations: Array.from({ length: 101 }, () => ({ lat: 6.5, lng: 3.3 })),
    }), /maximum of 100/);
});
