"use strict";
const { BadRequestException, ForbiddenException, Injectable, NotFoundException } = require("@nestjs/common");
const { DbService } = require("../db/db.service");

const mapCircle = (row) => ({ id: row.id, name: row.name, kind: row.kind, ownerUserId: row.owner_user_id, role: row.role, memberCount: Number(row.member_count || 0), createdAt: row.created_at });

let CirclesService = class CirclesService {
  constructor(db) { this.db = db; }
  async list(userId) {
    const result = await this.db.query(`select c.*, m.role, (select count(*) from safety_circle_members scm where scm.circle_id = c.id and scm.status = 'active') member_count from safety_circles c join safety_circle_members m on m.circle_id = c.id where m.user_id = $1 and m.status = 'active' order by c.created_at desc`, [userId]);
    return result.rows.map(mapCircle);
  }
  async create(userId, body) {
    const name = String(body?.name || '').trim();
    const kind = String(body?.kind || 'custom').trim();
    if (name.length < 2 || name.length > 80) throw new BadRequestException('Circle name must be between 2 and 80 characters.');
    if (!['family','partner','friends','work','children','custom'].includes(kind)) throw new BadRequestException('Unsupported circle type.');
    return this.db.transaction(async (client) => {
      const circle = (await client.query('insert into safety_circles (owner_user_id, name, kind) values ($1, $2, $3) returning *', [userId, name, kind])).rows[0];
      await client.query("insert into safety_circle_members (circle_id, user_id, role, status) values ($1, $2, 'owner', 'active')", [circle.id, userId]);
      return mapCircle({ ...circle, role: 'owner', member_count: 1 });
    });
  }
  async members(userId, circleId) {
    await this.requireMember(userId, circleId);
    const result = await this.db.query(`select m.id, m.user_id, m.role, m.status, m.emergency_recipient, m.created_at, u.name, u.email from safety_circle_members m join users u on u.id = m.user_id where m.circle_id = $1 and m.status = 'active' order by m.role desc, m.created_at`, [circleId]);
    return result.rows.map(r => ({ id: r.id, userId: r.user_id, name: r.name, email: r.email, role: r.role, status: r.status, emergencyRecipient: r.emergency_recipient, createdAt: r.created_at }));
  }
  async invite(userId, circleId, body) {
    const member = await this.requireMember(userId, circleId);
    if (member.role !== 'owner') throw new ForbiddenException('Only the Circle owner can invite people.');
    const invitedUserId = String(body?.userId || '').trim() || null;
    const email = String(body?.email || '').trim().toLowerCase() || null;
    if (!invitedUserId && !email) throw new BadRequestException('Choose a Sentinel user or provide an email address.');
    if (invitedUserId === userId) throw new BadRequestException('You are already in this Circle.');
    const result = await this.db.query(`insert into safety_circle_invitations (circle_id, invited_by_user_id, invited_user_id, invited_email) values ($1, $2, $3, $4) returning id, status, expires_at, created_at`, [circleId, userId, invitedUserId, email]);
    return { id: result.rows[0].id, status: result.rows[0].status, expiresAt: result.rows[0].expires_at, createdAt: result.rows[0].created_at };
  }
  async accept(userId, invitationId) {
    return this.db.transaction(async (client) => {
      const invitation = (await client.query("select * from safety_circle_invitations where id = $1 and status = 'pending' and expires_at > now() for update", [invitationId])).rows[0];
      if (!invitation) throw new NotFoundException('Invitation not found or expired.');
      if (invitation.invited_user_id && invitation.invited_user_id !== userId) throw new ForbiddenException('This invitation is for another user.');
      await client.query("insert into safety_circle_members (circle_id, user_id, status) values ($1, $2, 'active') on conflict (circle_id, user_id) do update set status = 'active', updated_at = now()", [invitation.circle_id, userId]);
      await client.query("update safety_circle_invitations set status = 'accepted', accepted_at = now(), invited_user_id = $2 where id = $1", [invitationId, userId]);
      return { accepted: true, circleId: invitation.circle_id };
    });
  }
  async invitations(userId) {
    const result = await this.db.query(`select i.id, i.circle_id, i.status, i.expires_at, i.created_at, c.name as circle_name, u.name as invited_by_name
      from safety_circle_invitations i
      join safety_circles c on c.id = i.circle_id
      join users u on u.id = i.invited_by_user_id
      left join users recipient on recipient.id = $1
      where i.status = 'pending' and i.expires_at > now()
        and (i.invited_user_id = $1 or lower(coalesce(i.invited_email, '')) = lower(coalesce(recipient.email, '')))
      order by i.created_at desc`, [userId]);
    return result.rows.map(row => ({ id: row.id, circleId: row.circle_id, circleName: row.circle_name, invitedByName: row.invited_by_name, status: row.status, expiresAt: row.expires_at, createdAt: row.created_at }));
  }
  async decline(userId, invitationId) {
    const result = await this.db.query(`update safety_circle_invitations i set status = 'declined'
      from users recipient
      where i.id = $1 and i.status = 'pending' and recipient.id = $2
        and (i.invited_user_id = $2 or lower(coalesce(i.invited_email, '')) = lower(coalesce(recipient.email, '')))
      returning i.id`, [invitationId, userId]);
    if (!result.rows[0]) throw new NotFoundException('Invitation not found.');
    return { declined: true, id: invitationId };
  }
  async leave(userId, circleId) {
    const member = await this.requireMember(userId, circleId);
    if (member.role === 'owner') throw new BadRequestException('Transfer or delete an owner Circle before leaving it.');
    await this.db.query("update safety_circle_members set status = 'left', updated_at = now() where circle_id = $1 and user_id = $2", [circleId, userId]);
    return { left: true };
  }
  async requireMember(userId, circleId) {
    const result = await this.db.query("select role from safety_circle_members where circle_id = $1 and user_id = $2 and status = 'active' limit 1", [circleId, userId]);
    if (!result.rows[0]) throw new NotFoundException('Circle not found.');
    return result.rows[0];
  }
};
CirclesService = Injectable()(CirclesService) || CirclesService;
Reflect.metadata("design:paramtypes", [DbService])(CirclesService);
exports.CirclesService = CirclesService;
