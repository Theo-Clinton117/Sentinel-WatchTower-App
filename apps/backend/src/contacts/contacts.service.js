"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactsService = void 0;
const common_1 = require("@nestjs/common");
const db_service_1 = require("../db/db.service");
function mapContactRow(row) {
    return {
        id: row.id,
        userId: row.user_id,
        contactUserId: row.contact_user_id,
        contactName: row.contact_name,
        contactPhone: row.contact_phone,
        contactEmail: row.contact_email,
        status: row.status,
        priority: row.priority,
        canViewLocation: row.can_view_location ?? true,
        canViewHistory: row.can_view_history ?? false,
        canSms: row.can_sms ?? true,
        canCall: row.can_call ?? true,
        createdAt: row.created_at,
    };
}
let ContactsService = class ContactsService {
    constructor(db) {
        this.db = db;
    }
    async list(userId) {
        const result = await this.db.query(`
      select tc.*, utp.can_view_location, utp.can_view_history, utp.can_sms, utp.can_call
      from trusted_contacts tc
      left join user_trust_profiles utp
        on utp.contact_id = tc.id and utp.user_id = tc.user_id
      where tc.user_id = $1
      order by tc.priority asc, tc.created_at desc
    `, [userId]);
        return result.rows.map(mapContactRow);
    }
    async create(userId, body) {
        return this.db.transaction(async (client) => {
            const contactResult = await client.query(`
        insert into trusted_contacts (
          user_id, contact_user_id, contact_name, contact_phone, contact_email, status, priority
        )
        values ($1, $2, $3, $4, $5, coalesce($6, 'pending'), coalesce($7, 0))
        returning *
      `, [
                userId,
                body?.contactUserId ?? null,
                body?.contactName ?? null,
                body?.contactPhone ?? null,
                body?.contactEmail ?? null,
                body?.status ?? null,
                body?.priority ?? 0,
            ]);
            const contact = contactResult.rows[0];
            const profileResult = await client.query(`
        insert into user_trust_profiles (
          user_id, contact_id, can_view_location, can_view_history, can_sms, can_call
        )
        values ($1, $2, $3, $4, $5, $6)
        returning can_view_location, can_view_history, can_sms, can_call
      `, [
                userId,
                contact.id,
                body?.canViewLocation ?? true,
                body?.canViewHistory ?? false,
                body?.canSms ?? true,
                body?.canCall ?? true,
            ]);
            return mapContactRow({ ...contact, ...profileResult.rows[0] });
        });
    }
    async update(userId, id, body) {
        return this.db.transaction(async (client) => {
            const contactResult = await client.query(`
        update trusted_contacts
        set
          contact_user_id = coalesce($3, contact_user_id),
          contact_name = coalesce($4, contact_name),
          contact_phone = coalesce($5, contact_phone),
          contact_email = coalesce($6, contact_email),
          status = coalesce($7, status),
          priority = coalesce($8, priority)
        where user_id = $1 and id = $2
        returning *
      `, [
                userId,
                id,
                body?.contactUserId ?? null,
                body?.contactName ?? null,
                body?.contactPhone ?? null,
                body?.contactEmail ?? null,
                body?.status ?? null,
                body?.priority ?? null,
            ]);
            const contact = contactResult.rows[0];
            if (!contact) {
                throw new common_1.NotFoundException('Contact not found');
            }
            const hasProfileUpdates = ['canViewLocation', 'canViewHistory', 'canSms', 'canCall'].some((key) => Object.prototype.hasOwnProperty.call(body || {}, key));
            let profile = await client.query('select can_view_location, can_view_history, can_sms, can_call from user_trust_profiles where user_id = $1 and contact_id = $2 limit 1', [userId, id]);
            if (hasProfileUpdates) {
                if (profile.rows[0]) {
                    profile = await client.query(`
            update user_trust_profiles
            set
              can_view_location = coalesce($3, can_view_location),
              can_view_history = coalesce($4, can_view_history),
              can_sms = coalesce($5, can_sms),
              can_call = coalesce($6, can_call)
            where user_id = $1 and contact_id = $2
            returning can_view_location, can_view_history, can_sms, can_call
          `, [
                        userId,
                        id,
                        body?.canViewLocation ?? null,
                        body?.canViewHistory ?? null,
                        body?.canSms ?? null,
                        body?.canCall ?? null,
                    ]);
                }
                else {
                    profile = await client.query(`
            insert into user_trust_profiles (
              user_id, contact_id, can_view_location, can_view_history, can_sms, can_call
            )
            values ($1, $2, $3, $4, $5, $6)
            returning can_view_location, can_view_history, can_sms, can_call
          `, [
                        userId,
                        id,
                        body?.canViewLocation ?? true,
                        body?.canViewHistory ?? false,
                        body?.canSms ?? true,
                        body?.canCall ?? true,
                    ]);
                }
            }
            return mapContactRow({ ...contact, ...(profile.rows[0] || {}) });
        });
    }
    async remove(userId, id) {
        const result = await this.db.query('delete from trusted_contacts where user_id = $1 and id = $2 returning id', [userId, id]);
        if (!result.rows[0]) {
            throw new common_1.NotFoundException('Contact not found');
        }
        return { removed: true, id };
    }
};
exports.ContactsService = ContactsService;
exports.ContactsService = ContactsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService])
], ContactsService);
//# sourceMappingURL=contacts.service.js.map
