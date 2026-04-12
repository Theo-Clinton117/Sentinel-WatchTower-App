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
exports.LatencyService = void 0;
const common_1 = require("@nestjs/common");
const db_service_1 = require("../db/db.service");
let LatencyService = class LatencyService {
    constructor(db) {
        this.db = db;
    }
    async record(userId, body) {
        const metricType = body?.metricType ?? body?.type;
        const latencyMs = Number(body?.latencyMs ?? body?.latency);
        if (!metricType || Number.isNaN(latencyMs)) {
            throw new common_1.BadRequestException('metricType and latencyMs are required');
        }
        const row = await this.db.transaction(async (client) => {
            const metricResult = await client.query(`
        insert into latency_metrics (user_id, metric_type, latency_ms)
        values ($1, $2, $3)
        returning *
      `, [userId, metricType, latencyMs]);
            const dateResult = await client.query(`
        select
          current_date as date,
          round(avg(latency_ms))::int as avg_latency_ms,
          percentile_cont(0.95) within group (order by latency_ms)::int as p95_latency_ms
        from latency_metrics
        where recorded_at::date = current_date
      `);
            const summary = dateResult.rows[0];
            const existingSummary = await client.query('select id from latency_summary where date = $1 limit 1', [summary.date]);
            if (existingSummary.rows[0]) {
                await client.query(`
          update latency_summary
          set avg_latency_ms = $2, p95_latency_ms = $3
          where id = $1
        `, [existingSummary.rows[0].id, summary.avg_latency_ms, summary.p95_latency_ms]);
            }
            else {
                await client.query(`
          insert into latency_summary (date, avg_latency_ms, p95_latency_ms)
          values ($1, $2, $3)
        `, [summary.date, summary.avg_latency_ms, summary.p95_latency_ms]);
            }
            return metricResult.rows[0];
        });
        return {
            id: row.id,
            userId: row.user_id,
            metricType: row.metric_type,
            latencyMs: row.latency_ms,
            recordedAt: row.recorded_at,
        };
    }
    async list(userId) {
        const result = await this.db.query(`
      select *
      from latency_metrics
      where user_id = $1
      order by recorded_at desc
      limit 100
    `, [userId]);
        return result.rows.map((row) => ({
            id: row.id,
            userId: row.user_id,
            metricType: row.metric_type,
            latencyMs: row.latency_ms,
            recordedAt: row.recorded_at,
        }));
    }
    async summary() {
        const result = await this.db.query(`
      select *
      from latency_summary
      order by date desc
      limit 30
    `);
        return result.rows.map((row) => ({
            id: row.id,
            date: row.date,
            avgLatencyMs: row.avg_latency_ms,
            p95LatencyMs: row.p95_latency_ms,
            createdAt: row.created_at,
        }));
    }
};
exports.LatencyService = LatencyService;
exports.LatencyService = LatencyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService])
], LatencyService);
//# sourceMappingURL=latency.service.js.map
