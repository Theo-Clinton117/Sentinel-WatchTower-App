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
exports.DbService = void 0;
const common_1 = require("@nestjs/common");
const pg_1 = require("pg");
function getConnectionString() {
    return String(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '').trim();
}
function shouldUseSsl(connectionString) {
    const mode = String(process.env.DB_SSL_MODE || 'auto').trim().toLowerCase();
    if (['disable', 'false', 'off', '0'].includes(mode)) {
        return false;
    }
    if (['require', 'true', 'on', '1'].includes(mode)) {
        return true;
    }
    return /supabase\.co|pooler\.supabase\.com/i.test(connectionString);
}
let DbService = class DbService {
    constructor() {
        this.logger = new common_1.Logger(DbService.name);
        const connectionString = getConnectionString();
        this.pool = new pg_1.Pool({
            connectionString: connectionString || undefined,
            ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
        });
        if (!connectionString && process.env.SUPABASE_URL) {
            this.logger.warn('SUPABASE_URL is configured, but no DATABASE_URL or SUPABASE_DB_URL is set. SQL-backed endpoints still need a Postgres connection string.');
        }
    }
    query(text, params) {
        return this.pool.query(text, params);
    }
    async transaction(work) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await work(client);
            await client.query('COMMIT');
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async onModuleDestroy() {
        await this.pool.end();
    }
};
exports.DbService = DbService;
exports.DbService = DbService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], DbService);
//# sourceMappingURL=db.service.js.map
