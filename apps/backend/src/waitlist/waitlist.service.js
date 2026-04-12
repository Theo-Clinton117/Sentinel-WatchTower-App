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
exports.WaitlistService = void 0;
const common_1 = require("@nestjs/common");
const db_service_1 = require("../db/db.service");
let WaitlistService = class WaitlistService {
    constructor(db) {
        this.db = db;
    }
    async signup(body) {
        if (!body?.phone && !body?.email) {
            throw new common_1.BadRequestException('phone or email is required');
        }
        const result = await this.db.query(`
      insert into waitlist_signups (phone, email, source)
      values ($1, $2, $3)
      returning *
    `, [body?.phone ?? null, body?.email ?? null, body?.source ?? 'api']);
        const row = result.rows[0];
        return {
            id: row.id,
            phone: row.phone,
            email: row.email,
            source: row.source,
            createdAt: row.created_at,
        };
    }
};
exports.WaitlistService = WaitlistService;
exports.WaitlistService = WaitlistService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService])
], WaitlistService);
//# sourceMappingURL=waitlist.service.js.map
