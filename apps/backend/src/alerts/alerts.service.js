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
exports.AlertsService = void 0;
const common_1 = require("@nestjs/common");
const db_service_1 = require("../db/db.service");
const queues_service_1 = require("../queues/queues.service");
let AlertsService = class AlertsService {
    constructor(db, queues) {
        this.db = db;
        this.queues = queues;
    }
    async create(userId, body) {
        const activeResult = await this.db.query(`
      select s.id as session_id, a.id as alert_id, a.status, a.trigger_source
      from watch_sessions s
      join alerts a on a.id = s.alert_id
      where s.user_id = $1 and s.status = 'active'
      order by s.started_at desc
      limit 1
    `, [userId]);
        const active = activeResult.rows[0];
        if (active) {
            return {
                alertId: active.alert_id,
                sessionId: active.session_id,
                status: active.status,
                triggerSource: active.trigger_source,
            };
        }
        const created = await this.db.transaction(async (client) => {
            const alertResult = await client.query(`
        insert into alerts (user_id, status, trigger_source, escalation_level)
        values ($1, 'active', $2, 0)
        returning *
      `, [userId, body?.triggerSource || 'panic']);
            const alert = alertResult.rows[0];
            const sessionResult = await client.query(`
        insert into watch_sessions (alert_id, user_id, status, escalation_level)
        values ($1, $2, 'active', 0)
        returning *
      `, [alert.id, userId]);
            return { alert, session: sessionResult.rows[0] };
        });
        const alertId = created.alert.id;
        const sessionId = created.session.id;
        await this.queues.scheduleEscalation({ alertId, sessionId });
        return {
            alertId,
            sessionId,
            status: 'active',
            triggerSource: created.alert.trigger_source,
        };
    }
    async cancel(userId, id) {
        const result = await this.db.transaction(async (client) => {
            const alertResult = await client.query(`
        update alerts
        set status = 'cancelled', resolved_at = now()
        where id = $1 and user_id = $2 and status = 'active'
        returning *
      `, [id, userId]);
            const alert = alertResult.rows[0];
            if (!alert) {
                throw new common_1.NotFoundException('Active alert not found');
            }
            const sessionResult = await client.query(`
        update watch_sessions
        set status = 'cancelled', ended_at = now()
        where alert_id = $1 and user_id = $2 and status = 'active'
        returning id
      `, [id, userId]);
            return { alert, session: sessionResult.rows[0] || null };
        });
        await this.queues.cancelEscalation(id);
        return { id, status: result.alert.status, sessionId: result.session?.id ?? null };
    }
};
exports.AlertsService = AlertsService;
exports.AlertsService = AlertsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService, queues_service_1.QueuesService])
], AlertsService);
//# sourceMappingURL=alerts.service.js.map
