"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionsService = void 0;
const common_1 = require("@nestjs/common");
const db_service_1 = require("../db/db.service");
const queues_service_1 = require("../queues/queues.service");
function mapSessionRow(row) {
    return {
        id: row.id,
        alertId: row.alert_id,
        userId: row.user_id,
        status: row.status,
        escalationLevel: row.escalation_level,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        lastLocationAt: row.last_location_at,
        alertStatus: row.alert_status,
        triggerSource: row.trigger_source,
    };
}
let SessionsService = class SessionsService {
    constructor(db, queues) {
        this.db = db;
        this.queues = queues;
    }
    async getActive(userId) {
        const result = await this.db.query(`
      select s.*, a.status as alert_status, a.trigger_source
      from watch_sessions s
      left join alerts a on a.id = s.alert_id
      where s.user_id = $1 and s.status = 'active'
      order by s.started_at desc
      limit 1
    `, [userId]);
        const row = result.rows[0];
        return row ? mapSessionRow(row) : null;
    }
    async getById(userId, id) {
        const result = await this.db.query(`
      select s.*, a.status as alert_status, a.trigger_source
      from watch_sessions s
      left join alerts a on a.id = s.alert_id
      where s.user_id = $1 and s.id = $2
      limit 1
    `, [userId, id]);
        const row = result.rows[0];
        if (!row) {
            throw new common_1.NotFoundException('Session not found');
        }
        return mapSessionRow(row);
    }
    async close(userId, id) {
        const result = await this.db.transaction(async (client) => {
            const sessionResult = await client.query(`
        update watch_sessions
        set status = 'completed', ended_at = now()
        where user_id = $1 and id = $2 and status = 'active'
        returning *
      `, [userId, id]);
            const session = sessionResult.rows[0];
            if (!session) {
                throw new common_1.NotFoundException('Active session not found');
            }
            await client.query(`
        update alerts
        set status = 'resolved', resolved_at = now()
        where id = $1 and user_id = $2
      `, [session.alert_id, userId]);
            const hydrated = await client.query(`
        select s.*, a.status as alert_status, a.trigger_source
        from watch_sessions s
        left join alerts a on a.id = s.alert_id
        where s.id = $1
        limit 1
      `, [session.id]);
            return hydrated.rows[0];
        });
        await this.queues.cancelEscalation(result.alert_id);
        return mapSessionRow(result);
    }
};
exports.SessionsService = SessionsService;
exports.SessionsService = SessionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService, queues_service_1.QueuesService])
], SessionsService);
//# sourceMappingURL=sessions.service.js.map
