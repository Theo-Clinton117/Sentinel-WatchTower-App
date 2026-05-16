"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPagination = void 0;
function getPagination(options, defaults = {}) {
    const defaultLimit = Number(defaults.limit) || 100;
    const maxLimit = Number(defaults.maxLimit) || 100;
    const limit = Math.max(1, Math.min(maxLimit, Number(options?.limit) || defaultLimit));
    const offset = Math.max(0, Number(options?.offset) || 0);
    return { limit, offset };
}
exports.getPagination = getPagination;
