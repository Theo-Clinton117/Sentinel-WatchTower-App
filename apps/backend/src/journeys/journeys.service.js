"use strict";
const { BadRequestException, Injectable, NotFoundException } = require('@nestjs/common');
const { DbService } = require('../db/db.service');

const ACTIVE = ['active', 'paused', 'location_unavailable'];
const mapJourney = (r) => ({ id:r.id, userId:r.user_id, destinationLabel:r.destination_label, destinationLat:r.destination_lat == null ? null : Number(r.destination_lat), destinationLng:r.destination_lng == null ? null : Number(r.destination_lng), status:r.status, startedAt:r.started_at, endedAt:r.ended_at, expiresAt:r.expires_at, lastLocationAt:r.last_location_at, checkInRequestedAt:r.check_in_requested_at || null, lastCheckInAt:r.last_check_in_at || null, createdAt:r.created_at });
const distanceMeters = (a,b,c,d) => { const R=6371000, x=(c-a)*Math.PI/180, y=(d-b)*Math.PI/180, q=Math.sin(x/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(y/2)**2; return 2*R*Math.atan2(Math.sqrt(q),Math.sqrt(1-q)); };
const MAX_AUTO_ARRIVAL_ACCURACY_M = 100;
const ARRIVAL_CONFIRMATION_WINDOW_MS = 3 * 60 * 1000;

let JourneysService = class JourneysService {
  constructor(db) { this.db = db; this.expiryTimer = setInterval(() => this.expireDueJourneys().catch(() => undefined), 60 * 1000); this.expiryTimer.unref?.(); }
  async list(userId) { const r=await this.db.query('select * from safety_journeys where user_id = $1 order by created_at desc limit 50',[userId]); return r.rows.map(mapJourney); }
  async create(userId, body) {
    const destinationLabel=String(body?.destinationLabel||'').trim(); const lat=Number(body?.destinationLat); const lng=Number(body?.destinationLng);
    const recipientIds=Array.from(new Set(Array.isArray(body?.recipientUserIds)?body.recipientUserIds.filter(x=>typeof x==='string'&&x):[]));
    if (destinationLabel.length<2 || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new BadRequestException('A destination name and valid destination are required.');
    if (!recipientIds.length) throw new BadRequestException('Choose at least one trusted recipient.');
    const allowed=await this.db.query("select distinct user_id from safety_circle_members where user_id = any($2::uuid[]) and status = 'active' and circle_id in (select circle_id from safety_circle_members where user_id = $1 and status = 'active')",[userId,recipientIds]);
    if (allowed.rows.length !== recipientIds.length) throw new BadRequestException('Recipients must be active members of one of your Circles.');
    return this.db.transaction(async client=>{
      const expiresAt = new Date(Date.now() + Math.max(15, Math.min(Number(body?.durationMinutes)||120, 12*60))*60000).toISOString();
      const row=(await client.query("insert into safety_journeys (user_id,destination_label,destination_lat,destination_lng,status,started_at,expires_at) values ($1,$2,$3,$4,'active',now(),$5) returning *",[userId,destinationLabel,lat,lng,expiresAt])).rows[0];
      for(const recipientId of recipientIds) await client.query('insert into safety_journey_recipients (journey_id,recipient_user_id) values ($1,$2)',[row.id,recipientId]);
      return {...mapJourney(row), recipients:recipientIds, privacyNotice:'Your Circle can be told that your journey is active. They cannot see your live location unless you explicitly share it.'};
    });
  }
  async confirmArrival(userId,id,body) {
    const lat=Number(body?.lat), lng=Number(body?.lng), accuracy=Number(body?.accuracyM ?? 9999);
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||!Number.isFinite(accuracy)||accuracy<0) throw new BadRequestException('A valid current location is required to confirm arrival.');
    return this.db.transaction(async client=>{
      const journey=(await client.query("select * from safety_journeys where id=$1 and user_id=$2 and status = any($3::text[]) and expires_at > now() for update",[id,userId,ACTIVE])).rows[0];
      if(!journey) throw new NotFoundException('Active journey not found.');
      const radius=Math.max(100, Math.min(500, accuracy*2));
      if(distanceMeters(lat,lng,Number(journey.destination_lat),Number(journey.destination_lng))>radius) throw new BadRequestException('You do not appear to be at the selected destination yet.');
      const updated=(await client.query("update safety_journeys set status='arrived', ended_at=now(), last_location_at=now(), updated_at=now() where id=$1 returning *",[id])).rows[0];
      await this.notifyArrival(client, id);
      return mapJourney(updated);
    });
  }
  async recordLocation(userId, id, body) {
    const lat=Number(body?.lat), lng=Number(body?.lng), accuracy=Number(body?.accuracyM);
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -90||lat > 90||lng < -180||lng > 180||!Number.isFinite(accuracy)||accuracy<0||accuracy>MAX_AUTO_ARRIVAL_ACCURACY_M) throw new BadRequestException('A recent, accurate location is required to check Safe Arrival.');
    return this.db.transaction(async client=>{
      const journey=(await client.query("select * from safety_journeys where id=$1 and user_id=$2 and status = 'active' and expires_at > now() for update",[id,userId])).rows[0];
      if(!journey) throw new NotFoundException('Active journey not found.');
      const radius=Math.max(100, Math.min(500, accuracy*2));
      const inDestination=distanceMeters(lat,lng,Number(journey.destination_lat),Number(journey.destination_lng))<=radius;
      if(!inDestination) {
        const updated=(await client.query("update safety_journeys set last_location_at=now(), arrival_confirmation_count=0, arrival_confirmation_started_at=null, updated_at=now() where id=$1 returning *",[id])).rows[0];
        return {...mapJourney(updated), arrivalConfirmationCount:0, automaticallyArrived:false};
      }
      const startedAt=journey.arrival_confirmation_started_at ? new Date(journey.arrival_confirmation_started_at).getTime() : 0;
      const count=startedAt && Date.now()-startedAt<=ARRIVAL_CONFIRMATION_WINDOW_MS ? Number(journey.arrival_confirmation_count||0)+1 : 1;
      if(count < 2) {
        const updated=(await client.query("update safety_journeys set last_location_at=now(), arrival_confirmation_count=$2, arrival_confirmation_started_at=coalesce(arrival_confirmation_started_at, now()), updated_at=now() where id=$1 returning *",[id,count])).rows[0];
        return {...mapJourney(updated), arrivalConfirmationCount:count, automaticallyArrived:false};
      }
      const updated=(await client.query("update safety_journeys set status='arrived', ended_at=now(), last_location_at=now(), arrival_confirmation_count=$2, updated_at=now() where id=$1 returning *",[id,count])).rows[0];
      await this.notifyArrival(client, id);
      return {...mapJourney(updated), arrivalConfirmationCount:count, automaticallyArrived:true};
    });
  }
  async notifyArrival(client, journeyId) {
    const recipients=await client.query('select recipient_user_id from safety_journey_recipients where journey_id=$1',[journeyId]);
    for(const r of recipients.rows) await client.query("insert into notifications (user_id,type,channel,status,payload,related_session_id,sent_at) values ($1,'safe_arrival','in_app','queued',$2::jsonb,null,null)",[r.recipient_user_id,JSON.stringify({journeyId,title:'Safe Arrival',message:'A person in your Circle arrived safely.'})]);
  }
  async checkIn(userId, id) {
    return this.db.transaction(async client=>{
      // A check-in resolves an expired journey; it does not restart tracking.
      const result=await client.query("update safety_journeys set last_check_in_at=now(), check_in_requested_at=null, updated_at=now() where id=$1 and user_id=$2 and status='expired' returning *",[id,userId]);
      if(!result.rows[0]) throw new NotFoundException('An expired journey was not found for check-in.');
      await this.notifyCheckIn(client, id);
      return mapJourney(result.rows[0]);
    });
  }
  async notifyCheckIn(client, journeyId) {
    const recipients=await client.query('select recipient_user_id from safety_journey_recipients where journey_id=$1',[journeyId]);
    for(const recipient of recipients.rows) await client.query("insert into notifications (user_id,type,channel,status,payload,related_session_id) values ($1,'journey_check_in','in_app','queued',$2::jsonb,null)",[recipient.recipient_user_id,JSON.stringify({journeyId,title:'Journey check-in',message:'A Circle member checked in and said they are safe.'})]);
  }
  async expireDueJourneys() {
    const expired=await this.db.query("update safety_journeys set status='expired', ended_at=now(), check_in_requested_at=now(), updated_at=now() where status in ('active','paused','location_unavailable') and expires_at <= now() returning id, user_id, destination_label");
    for(const journey of expired.rows) {
      await this.db.query("insert into notifications (user_id,type,channel,status,payload,related_session_id) values ($1,'journey_check_in','in_app','queued',$2::jsonb,null)",[journey.user_id,JSON.stringify({journeyId:journey.id,title:'Safe Arrival check-in',message:'Sentinel could not confirm your arrival. If you are safe, please check in.'})]);
      const recipients=await this.db.query('select recipient_user_id from safety_journey_recipients where journey_id=$1',[journey.id]);
      for(const recipient of recipients.rows) await this.db.query("insert into notifications (user_id,type,channel,status,payload,related_session_id) values ($1,'journey_check_in','in_app','queued',$2::jsonb,null)",[recipient.recipient_user_id,JSON.stringify({journeyId:journey.id,title:'Journey update',message:'Sentinel could not confirm a Circle member’s arrival. Please check in with them when you can.'})]);
    }
    return { expired: expired.rows.length };
  }
  async cancel(userId,id) { const r=await this.db.query("update safety_journeys set status='cancelled', ended_at=now(), updated_at=now() where id=$1 and user_id=$2 and status = any($3::text[]) returning *",[id,userId,ACTIVE]); if(!r.rows[0]) throw new NotFoundException('Active journey not found.'); return mapJourney(r.rows[0]); }
  onModuleDestroy() { clearInterval(this.expiryTimer); }
};
JourneysService=Injectable()(JourneysService)||JourneysService; Reflect.metadata('design:paramtypes',[DbService])(JourneysService); exports.JourneysService=JourneysService;
