"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapReviewerRequestRow = exports.getLatestReviewerRequest = exports.getUserRoleNames = exports.ensureDefaultUserRole = exports.ensureSystemRoles = void 0;
const roles_constants_1 = require("./roles.constants");
async function ensureSystemRoles(queryable) {
    for (const roleName of roles_constants_1.SYSTEM_ROLES) {
        await queryable.query(`
      insert into roles (name)
      values ($1)
      on conflict (name) do nothing
    `, [roleName]);
    }
}
exports.ensureSystemRoles = ensureSystemRoles;
async function ensureDefaultUserRole(queryable, userId) {
    await ensureSystemRoles(queryable);
    await queryable.query(`
    insert into user_roles (user_id, role_id)
    select $1, r.id
    from roles r
    where r.name = 'user'
    on conflict (user_id, role_id) do nothing
  `, [userId]);
}
exports.ensureDefaultUserRole = ensureDefaultUserRole;
async function getUserRoleNames(queryable, userId) {
    await ensureSystemRoles(queryable);
    const result = await queryable.query(`
    select r.name
    from roles r
    join user_roles ur on ur.role_id = r.id
    where ur.user_id = $1
    order by
      case r.name
        when 'admin' then 1
        when 'reviewer' then 2
        when 'user' then 3
        else 99
      end,
      r.name asc
  `, [userId]);
    return result.rows.map((row) => row.name);
}
exports.getUserRoleNames = getUserRoleNames;
function mapReviewerRequestRow(row) {
    if (!row) {
        return null;
    }
    return {
        id: row.id,
        userId: row.user_id,
        status: row.status,
        motivation: row.motivation || null,
        adminNote: row.admin_note || null,
        requestedAt: row.requested_at || row.created_at || null,
        reviewedAt: row.reviewed_at || null,
        reviewedBy: row.reviewed_by || null,
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
        user: row.user_id ? {
            id: row.user_id,
            phone: row.phone_e164 || null,
            name: row.name || null,
        } : null,
    };
}
exports.mapReviewerRequestRow = mapReviewerRequestRow;
async function getLatestReviewerRequest(queryable, userId) {
    const result = await queryable.query(`
    select rrr.*
    from reviewer_role_requests rrr
    where rrr.user_id = $1
    order by rrr.created_at desc
    limit 1
  `, [userId]);
    return mapReviewerRequestRow(result.rows[0]);
}
exports.getLatestReviewerRequest = getLatestReviewerRequest;
