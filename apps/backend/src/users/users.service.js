"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const db_service_1 = require("../db/db.service");
const credibility_logic_1 = require("../credibility/credibility.logic");
const roles_logic_1 = require("../roles/roles.logic");
function mapUserRow(row, extras) {
    return {
        id: row.id,
        phone: row.phone_e164,
        name: row.name,
        email: row.email,
        status: row.status,
        credibility: extras?.credibility || null,
        roles: Array.isArray(extras?.roles) ? extras.roles : ['user'],
        reviewerRequest: extras?.reviewerRequest || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
let UsersService = class UsersService {
    constructor(db) {
        this.db = db;
    }
    async getMe(userId) {
        const result = await this.db.query('select * from users where id = $1 limit 1', [userId]);
        const row = result.rows[0];
        if (!row) {
            throw new common_1.NotFoundException('User not found');
        }
        const credibility = await (0, credibility_logic_1.getCredibilityProfile)(this.db, userId);
        const roles = await (0, roles_logic_1.getUserRoleNames)(this.db, userId);
        const reviewerRequest = await (0, roles_logic_1.getLatestReviewerRequest)(this.db, userId);
        return mapUserRow(row, { credibility, roles, reviewerRequest });
    }
    async updateMe(userId, body) {
        const result = await this.db.query('update users set name = coalesce($2, name), email = coalesce($3, email), updated_at = now() where id = $1 returning *', [userId, body?.name ?? null, body?.email ?? null]);
        const row = result.rows[0];
        if (!row) {
            throw new common_1.NotFoundException('User not found');
        }
        const credibility = await (0, credibility_logic_1.getCredibilityProfile)(this.db, userId);
        const roles = await (0, roles_logic_1.getUserRoleNames)(this.db, userId);
        const reviewerRequest = await (0, roles_logic_1.getLatestReviewerRequest)(this.db, userId);
        return mapUserRow(row, { credibility, roles, reviewerRequest });
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService])
], UsersService);
//# sourceMappingURL=users.service.js.map
