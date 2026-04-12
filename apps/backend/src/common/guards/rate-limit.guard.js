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
        if (!config || !this.redis) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const key = request.user?.sub || request.ip;
        const limiter = this.getLimiter(config);
        try {
            await limiter.consume(key);
            return true;
        }
        catch {
            throw new common_1.HttpException('Rate limit exceeded', common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
    }
    getLimiter(config) {
        if (!this.redis) {
            return null;
        }
        const cacheKey = `${config.points}:${config.duration}`;
        const cached = this.limiterCache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const limiter = new rate_limiter_flexible_1.RateLimiterRedis({
            storeClient: this.redis,
            keyPrefix: 'rl',
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
