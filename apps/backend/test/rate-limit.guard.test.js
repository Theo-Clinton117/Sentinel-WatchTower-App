"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { RateLimitGuard } = require("../src/common/guards/rate-limit.guard");

function createContext({ userId = "user-1", ip = "127.0.0.1" } = {}) {
    return {
        getHandler() {
            return function handler() {};
        },
        switchToHttp() {
            return {
                getRequest() {
                    return {
                        user: userId ? { sub: userId } : null,
                        ip,
                    };
                },
            };
        },
    };
}

test("rate limit guard allows requests within configured budget", async () => {
    const guard = new RateLimitGuard({
        get() {
            return { points: 2, duration: 60 };
        },
    });
    const context = createContext();

    assert.equal(await guard.canActivate(context), true);
    assert.equal(await guard.canActivate(context), true);
});

test("rate limit guard rejects requests beyond configured budget", async () => {
    const guard = new RateLimitGuard({
        get() {
            return { points: 1, duration: 60 };
        },
    });
    const context = createContext({ userId: "user-rate-limited" });

    assert.equal(await guard.canActivate(context), true);
    await assert.rejects(() => guard.canActivate(context), /Rate limit exceeded/);
});
