import { apiGet, apiPost } from './api';
export type Journey={id:string;destinationLabel:string;destinationLat:number;destinationLng:number;status:'active'|'paused'|'arrived'|'cancelled'|'expired'|'location_unavailable';startedAt?:string;endedAt?:string;expiresAt?:string;checkInRequestedAt?:string|null;lastCheckInAt?:string|null};
export const listJourneys=()=>apiGet<Journey[]>('/journeys',{auth:true});
export const startJourney=(body:{destinationLabel:string;destinationLat:number;destinationLng:number;recipientUserIds:string[];durationMinutes?:number})=>apiPost<Journey>('/journeys',body,{auth:true});
export const confirmJourneyArrival=(id:string,body:{lat:number;lng:number;accuracyM?:number|null})=>apiPost<Journey>(`/journeys/${id}/arrival`,body,{auth:true});
export const cancelJourney=(id:string)=>apiPost<Journey>(`/journeys/${id}/cancel`,undefined,{auth:true});
export const checkInJourney=(id:string)=>apiPost<Journey>(`/journeys/${id}/check-in`,undefined,{auth:true});
export const recordJourneyLocation=(id:string,body:{lat:number;lng:number;accuracyM?:number|null})=>apiPost<Journey & {automaticallyArrived?:boolean}>(`/journeys/${id}/location`,body,{auth:true,timeoutMs:10000});
