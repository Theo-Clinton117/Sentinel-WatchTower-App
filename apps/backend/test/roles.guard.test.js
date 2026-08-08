"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { RolesGuard } = require("../src/common/guards/roles.guard");

function createContext({ userId = "user-1" } = {}) {
    const request = {
        user: userId ? { sub: userId } : null,
    };
    return {
        request,
        getHandler() {
            return function handler() {};
        },
        getClass() {
            return function Controller() {};
        },
        switchToHttp() {
            return {
                getRequest() {
                    return request;
                },
            };
        },
    };
}

function createDbWithRoles(roles) {
    return {
        async query(sql) {
            if (sql.includes("insert into roles")) {
                return { rows: [] };
            }
            if (sql.includes("select r.name")) {
                return { rows: roles.map((name) => ({ name })) };
            }
            throw new Error(`Unexpected query: ${sql}`);
        },
    };
}

test("roles guard allows routes without role metadata", async () => {
    const guard = new RolesGuard({
        getAllAndOverride() {
            return undefined;
        },
    }, createDbWithRoles([]));

    assert.equal(await guard.canActivate(createContext()), true);
});

test("roles guard rejects protected routes without authenticated user", async () => {
    const guard = new RolesGuard({
        getAllAndOverride() {
            return ["admin"];
        },
    }, createDbWithRoles(["admin"]));

    await assert.rejects(() => guard.canActivate(createContext({ userId: null })), /Missing authenticated user/);
});

test("roles guard rejects users without a required role", async () => {
    const guard = new RolesGuard({
        getAllAndOverride() {
            return ["admin"];
        },
    }, createDbWithRoles(["user"]));

    await assert.rejects(() => guard.canActivate(createContext()), /permission/);
});

test("roles guard allows users with any required role and attaches resolved roles", async () => {
    const guard = new RolesGuard({
        getAllAndOverride() {
            return ["admin", "reviewer"];
        },
    }, createDbWithRoles(["reviewer", "user"]));
    const context = createContext();

    assert.equal(await guard.canActivate(context), true);
    assert.deepEqual(context.request.user.roles, ["reviewer", "user"]);
});
