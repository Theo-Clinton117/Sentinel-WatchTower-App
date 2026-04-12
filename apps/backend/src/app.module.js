"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const request_id_middleware_1 = require("./common/middleware/request-id.middleware");
const rate_limit_guard_1 = require("./common/guards/rate-limit.guard");
const config_1 = require("@nestjs/config");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const contacts_module_1 = require("./contacts/contacts.module");
const alerts_module_1 = require("./alerts/alerts.module");
const sessions_module_1 = require("./sessions/sessions.module");
const locations_module_1 = require("./locations/locations.module");
const reports_module_1 = require("./reports/reports.module");
const notifications_module_1 = require("./notifications/notifications.module");
const roles_module_1 = require("./roles/roles.module");
const latency_module_1 = require("./latency/latency.module");
const subscriptions_module_1 = require("./subscriptions/subscriptions.module");
const telemetry_module_1 = require("./telemetry/telemetry.module");
const admin_module_1 = require("./admin/admin.module");
const risk_zones_module_1 = require("./risk-zones/risk-zones.module");
const supabase_module_1 = require("./supabase/supabase.module");
const waitlist_module_1 = require("./waitlist/waitlist.module");
const ws_module_1 = require("./ws/ws.module");
const queues_module_1 = require("./queues/queues.module");
const db_module_1 = require("./db/db.module");
let AppModule = class AppModule {
    configure(consumer) {
        consumer.apply(request_id_middleware_1.RequestIdMiddleware).forRoutes('*');
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            db_module_1.DbModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            contacts_module_1.ContactsModule,
            alerts_module_1.AlertsModule,
            sessions_module_1.SessionsModule,
            locations_module_1.LocationsModule,
            reports_module_1.ReportsModule,
            notifications_module_1.NotificationsModule,
            roles_module_1.RolesModule,
            latency_module_1.LatencyModule,
            subscriptions_module_1.SubscriptionsModule,
            telemetry_module_1.TelemetryModule,
            admin_module_1.AdminModule,
            risk_zones_module_1.RiskZonesModule,
            supabase_module_1.SupabaseModule,
            waitlist_module_1.WaitlistModule,
            ws_module_1.WsModule,
            queues_module_1.QueuesModule,
        ],
        providers: [rate_limit_guard_1.RateLimitGuard],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map
