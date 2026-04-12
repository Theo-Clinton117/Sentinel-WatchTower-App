"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const db_service_1 = require("../db/db.service");
const credibility_logic_1 = require("../credibility/credibility.logic");
let AdminService = class AdminService {
    constructor(db) {
        this.db = db;
    }
    async activeAlerts() {
        const result = await this.db.query(`
      select
        a.id,
        a.user_id,
        a.status,
        a.trigger_source,
        a.escalation_level,
        a.created_at,
        s.id as session_id,
        s.started_at,
        s.last_location_at,
        u.phone_e164,
        u.name
      from alerts a
      left join watch_sessions s on s.alert_id = a.id and s.status = 'active'
      left join users u on u.id = a.user_id
      where a.status = 'active'
      order by a.created_at desc
    `);
        return result.rows.map((row) => ({
            id: row.id,
            userId: row.user_id,
            status: row.status,
            triggerSource: row.trigger_source,
            escalationLevel: row.escalation_level,
            createdAt: row.created_at,
            sessionId: row.session_id,
            startedAt: row.started_at,
            lastLocationAt: row.last_location_at,
            user: {
                phone: row.phone_e164,
                name: row.name,
            },
        }));
    }
    async flagAlert(adminUserId, id, body) {
        const alertResult = await this.db.query('select id, status from alerts where id = $1 limit 1', [id]);
        const alert = alertResult.rows[0];
        if (!alert) {
            throw new common_1.NotFoundException('Alert not found');
        }
        const auditResult = await this.db.query(`
      insert into admin_audit_logs (admin_user_id, action, target_type, target_id, metadata)
      values ($1, $2, $3, $4, $5)
      returning *
    `, [
            adminUserId,
            'flag_alert',
            'alert',
            id,
            {
                reason: body?.reason ?? null,
                note: body?.note ?? null,
                alertStatus: alert.status,
            },
        ]);
        return {
            id,
            flagged: true,
            auditLogId: auditResult.rows[0].id,
        };
    }
    async classifyReport(adminUserId, id, body) {
        return this.db.transaction(async (client) => {
            const result = await (0, credibility_logic_1.classifyReportAndRefresh)(client, {
                reportId: id,
                reviewedBy: adminUserId,
                classification: body?.classification,
                responseOutcome: body?.responseOutcome,
                aiConfidence: body?.aiConfidence,
                qualityScore: body?.qualityScore,
                corroborationCount: body?.corroborationCount,
                notes: body?.notes ?? null,
            });
            const auditResult = await client.query(`
        insert into admin_audit_logs (admin_user_id, action, target_type, target_id, metadata)
        values ($1, $2, $3, $4, $5)
        returning id
      `, [
                adminUserId,
                'classify_report',
                'report',
                id,
                {
                    classification: body?.classification,
                    responseOutcome: body?.responseOutcome ?? 'pending',
                    notes: body?.notes ?? null,
                },
            ]);
            return {
                ...result,
                auditLogId: auditResult.rows[0].id,
            };
        });
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService])
], AdminService);
//# sourceMappingURL=admin.service.js.map
