"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function")
        return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolesService = void 0;
const common_1 = require("@nestjs/common");
const db_service_1 = require("../db/db.service");
const roles_logic_1 = require("./roles.logic");
let RolesService = class RolesService {
    constructor(db) {
        this.db = db;
    }
    async list() {
        await (0, roles_logic_1.ensureSystemRoles)(this.db);
        const result = await this.db.query(`
      select
        r.*,
        (select count(*)::int from user_roles ur where ur.role_id = r.id) as user_count
      from roles r
      order by
        case r.name
          when 'admin' then 1
          when 'reviewer' then 2
          when 'user' then 3
          else 99
        end,
        r.name asc
    `);
        return result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            userCount: row.user_count,
            createdAt: row.created_at,
        }));
    }
    async mine(userId) {
        const roles = await (0, roles_logic_1.getUserRoleNames)(this.db, userId);
        return roles.map((name) => ({ name }));
    }
    async getMyReviewerRequest(userId) {
        return (0, roles_logic_1.getLatestReviewerRequest)(this.db, userId);
    }
    async requestReviewerRole(userId, body) {
        return this.db.transaction(async (client) => {
            await (0, roles_logic_1.ensureDefaultUserRole)(client, userId);
            const roles = await (0, roles_logic_1.getUserRoleNames)(client, userId);
            if (roles.includes('admin')) {
                throw new common_1.BadRequestException('Admins do not need a reviewer request');
            }
            if (roles.includes('reviewer')) {
                throw new common_1.BadRequestException('You already have reviewer access');
            }
            const pending = await client.query(`
        select *
        from reviewer_role_requests
        where user_id = $1 and status = 'pending'
        order by created_at desc
        limit 1
      `, [userId]);
            if (pending.rows[0]) {
                return (0, roles_logic_1.mapReviewerRequestRow)(pending.rows[0]);
            }
            const created = await client.query(`
        insert into reviewer_role_requests (user_id, motivation, status)
        values ($1, $2, 'pending')
        returning *
      `, [userId, body?.motivation ? String(body.motivation).trim() : null]);
            return (0, roles_logic_1.mapReviewerRequestRow)(created.rows[0]);
        });
    }
    async listReviewerRequests(status = 'pending') {
        const result = await this.db.query(`
      select
        rrr.*,
        u.phone_e164,
        u.name
      from reviewer_role_requests rrr
      join users u on u.id = rrr.user_id
      where ($1::text is null or rrr.status = $1)
      order by
        case rrr.status
          when 'pending' then 1
          when 'approved' then 2
          when 'rejected' then 3
          when 'withdrawn' then 4
          else 99
        end,
        rrr.created_at desc
    `, [status ?? null]);
        return result.rows.map(roles_logic_1.mapReviewerRequestRow);
    }
    async resolveReviewerRequest(adminUserId, requestId, body) {
        const nextStatus = String(body?.status || '').trim().toLowerCase();
        if (!['approved', 'rejected'].includes(nextStatus)) {
            throw new common_1.BadRequestException('status must be approved or rejected');
        }
        return this.db.transaction(async (client) => {
            const requestResult = await client.query(`
        select *
        from reviewer_role_requests
        where id = $1
        limit 1
      `, [requestId]);
            const request = requestResult.rows[0];
            if (!request) {
                throw new common_1.NotFoundException('Reviewer request not found');
            }
            if (request.status !== 'pending') {
                throw new common_1.BadRequestException('Only pending reviewer requests can be resolved');
            }
            if (nextStatus === 'approved') {
                await (0, roles_logic_1.ensureSystemRoles)(client);
                await client.query(`
          insert into user_roles (user_id, role_id)
          select $1, r.id
          from roles r
          where r.name = 'reviewer'
          on conflict (user_id, role_id) do nothing
        `, [request.user_id]);
            }
            const updated = await client.query(`
        update reviewer_role_requests
        set status = $2,
            admin_note = $3,
            reviewed_by = $4,
            reviewed_at = now(),
            updated_at = now()
        where id = $1
        returning *
      `, [
                requestId,
                nextStatus,
                body?.adminNote ? String(body.adminNote).trim() : null,
                adminUserId,
            ]);
            await client.query(`
        insert into admin_audit_logs (admin_user_id, action, target_type, target_id, metadata)
        values ($1, $2, $3, $4, $5)
      `, [
                adminUserId,
                nextStatus === 'approved' ? 'approve_reviewer_request' : 'reject_reviewer_request',
                'reviewer_role_request',
                requestId,
                {
                    requestedUserId: request.user_id,
                    requestedRole: 'reviewer',
                    adminNote: body?.adminNote ?? null,
                },
            ]);
            return (0, roles_logic_1.mapReviewerRequestRow)(updated.rows[0]);
        });
    }
};
exports.RolesService = RolesService;
exports.RolesService = RolesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService])
], RolesService);
//# sourceMappingURL=roles.service.js.map
