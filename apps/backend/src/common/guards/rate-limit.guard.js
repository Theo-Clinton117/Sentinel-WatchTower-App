"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const ioredis_1 = require("ioredis");
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
const { RateLimiterMemory } = rate_limiter_flexible_1;
const rate_limit_decorator_1 = require("./rate-limit.decorator");
let RateLimitGuard = class RateLimitGuard {
    constructor(reflector) {
        this.reflector = reflector;
        this.limiterCache = new Map();
        this.redis = process.env.REDIS_URL ? new ioredis_1.default(process.env.REDIS_URL) : null;
        if (this.redis) {
            this.redis.on('error', () => undefined);
        }
    }
    async canActivate(context) {
        const config = this.reflector.get(rate_limit_decorator_1.RATE_LIMIT_KEY, context.getHandler());
        if (!config) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        // Scope buckets by route as well as caller. Previously every endpoint
        // sharing the same points/duration also shared a bucket, so an OTP
        // request could consume verification/login capacity for the same IP.
        // Express derives req.ip from X-Forwarded-For only for trusted proxy
        // hops. On Render, main.js trusts the single Render proxy hop in
        // production (or the explicitly configured TRUST_PROXY_HOPS value).
        // req.ips ordering is proxy-dependent, so it must not be used as the
        // client identity here.
        const identity = request.user?.sub || request.ip || 'unknown';
const route = request.route?.path || request.url?.split('?')[0] || 'unknown';

console.log('[RATE LIMIT DEBUG]', {
    method: request.method,
    route,
    ip: request.ip,
    identityType: request.user?.sub ? 'user' : 'ip',
});
        const key = `${request.method}:${route}:${identity}`;
        const limiter = this.getLimiter(config);
        if (!limiter) {
            return true;
        }
        try {
            await limiter.consume(key);
            return true;
        }
        catch (error) {
            const retryAfterSeconds = Math.max(1, Math.ceil(Number(error?.msBeforeNext || config.duration * 1000) / 1000));
            throw new common_1.HttpException({
                message: `Rate limit exceeded. Try again in ${retryAfterSeconds} seconds.`,
                retryAfterSeconds,
            }, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
    }
    getLimiter(config) {
        const cacheKey = `${config.points}:${config.duration}`;
        const cached = this.limiterCache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const limiter = this.redis
            ? new rate_limiter_flexible_1.RateLimiterRedis({
                storeClient: this.redis,
                keyPrefix: process.env.NODE_ENV === 'production' ? 'rl' : 'rl-dev',
                points: config.points,
                duration: config.duration,
            })
            : new RateLimiterMemory({
                points: config.points,
                duration: config.duration,
            });
        this.limiterCache.set(cacheKey, limiter);
        return limiter;
    }
};
exports.RateLimitGuard = RateLimitGuard;
exports.RateLimitGuard = RateLimitGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], RateLimitGuard);
//# sourceMappingURL=rate-limit.guard.js.map
