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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const db_service_1 = require("../db/db.service");
const credibility_logic_1 = require("../credibility/credibility.logic");
const roles_logic_1 = require("../roles/roles.logic");
function normalizePhone(phone) {
    return String(phone || '').trim().replace(/\s+/g, '');
}
function mapUserRow(user, extras) {
    return {
        id: user.id,
        phone: user.phone_e164,
        name: user.name,
        email: user.email,
        status: user.status,
        credibility: extras?.credibility || null,
        roles: Array.isArray(extras?.roles) ? extras.roles : ['user'],
        reviewerRequest: extras?.reviewerRequest || null,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
    };
}
let AuthService = class AuthService {
    constructor(db, jwt) {
        this.db = db;
        this.jwt = jwt;
    }
    async requestOtp(dto) {
        const response = {
            success: true,
            phone: normalizePhone(dto.phone),
        };
        if (process.env.NODE_ENV !== 'production') {
            response.devCode = process.env.DEV_OTP_CODE || '123456';
        }
        return response;
    }
    async verifyOtp(dto) {
        if (!this.isOtpValid(dto.code)) {
            throw new common_1.UnauthorizedException('Invalid OTP code');
        }
        const phone = normalizePhone(dto.phone);
        const user = await this.db.transaction(async (client) => {
            const existingUser = await client.query('select * from users where phone_e164 = $1 limit 1', [phone]);
            let row = existingUser.rows[0];
            if (!row) {
                const createdUser = await client.query("insert into users (phone_e164, status) values ($1, 'active') returning *", [phone]);
                row = createdUser.rows[0];
            }
            if (dto.deviceId) {
                const existingDevice = await client.query('select id from user_devices where user_id = $1 and device_id = $2 order by created_at desc limit 1', [row.id, dto.deviceId]);
                if (existingDevice.rows[0]) {
                    await client.query('update user_devices set last_seen_at = now() where id = $1', [existingDevice.rows[0].id]);
                }
                else {
                    await client.query('insert into user_devices (user_id, device_id, last_seen_at) values ($1, $2, now())', [row.id, dto.deviceId]);
                }
            }
            await (0, roles_logic_1.ensureDefaultUserRole)(client, row.id);
            return row;
        });
        const credibility = await (0, credibility_logic_1.ensureCredibilityProfile)(this.db, user.id);
        const roles = await (0, roles_logic_1.getUserRoleNames)(this.db, user.id);
        const reviewerRequest = await (0, roles_logic_1.getLatestReviewerRequest)(this.db, user.id);
        const payload = { sub: user.id, phone: user.phone_e164 };
        const accessToken = this.jwt.sign(payload);
        const refreshToken = this.jwt.sign(payload, {
            secret: process.env.JWT_REFRESH_SECRET || 'change-me',
            expiresIn: process.env.JWT_REFRESH_TTL || '30d',
        });
        return {
            accessToken,
            refreshToken,
            userId: payload.sub,
            user: mapUserRow(user, { credibility, roles, reviewerRequest }),
        };
    }
    async refresh(refreshToken) {
        try {
            const payload = this.jwt.verify(refreshToken, {
                secret: process.env.JWT_REFRESH_SECRET || 'change-me',
            });
            const result = await this.db.query('select * from users where id = $1 limit 1', [payload.sub]);
            const user = result.rows[0];
            if (!user) {
                throw new common_1.UnauthorizedException('User not found');
            }
            const credibility = await (0, credibility_logic_1.ensureCredibilityProfile)(this.db, user.id);
            const roles = await (0, roles_logic_1.getUserRoleNames)(this.db, user.id);
            const reviewerRequest = await (0, roles_logic_1.getLatestReviewerRequest)(this.db, user.id);
            return {
                accessToken: this.jwt.sign({ sub: user.id, phone: user.phone_e164 }),
                refreshToken,
                userId: user.id,
                user: mapUserRow(user, { credibility, roles, reviewerRequest }),
            };
        }
        catch (error) {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
    }
    isOtpValid(code) {
        if (process.env.NODE_ENV === 'production') {
            const bypassCode = process.env.OTP_BYPASS_CODE || '';
            return Boolean(bypassCode) && code === bypassCode;
        }
        return /^[0-9]{4,8}$/.test(String(code || ''));
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService, jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map
