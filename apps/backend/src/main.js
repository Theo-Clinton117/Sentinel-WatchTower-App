"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
const rate_limit_guard_1 = require("./common/guards/rate-limit.guard");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const origins = process.env.CORS_ORIGINS?.split(',').map((value) => value.trim()).filter(Boolean);
    app.enableCors({
        origin: origins && origins.length > 0 ? origins : true,
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'DELETE'],
        allowedHeaders: ['Authorization', 'Content-Type'],
    });
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    app.useGlobalGuards(app.get(rate_limit_guard_1.RateLimitGuard));
    app.setGlobalPrefix('api');
    const port = process.env.PORT ? Number(process.env.PORT) : 4000;
    await app.listen(port);
}
bootstrap();
//# sourceMappingURL=main.js.map