import { apiGet } from './api';

export type RiskZone = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  riskLevel: string;
  createdAt?: string;
};

export type ResponseGrid = {
  id: string;
  code: string;
  name: string;
  type: string;
};

export type OperationalZone = {
  id: string;
  code: string;
  name: string;
  lgas: string[];
  responseGrids: ResponseGrid[];
};

export type SentinelState = {
  id: string;
  code: string;
  name: string;
  type: string;
  operationalZones: OperationalZone[];
};

export type GeopoliticalZone = {
  id: string;
  code: string;
  name: string;
  states: SentinelState[];
};

export async function listRiskZones() {
  return apiGet<RiskZone[]>('/risk-zones', { auth: true });
}

export async function listOperationalGeography() {
  return apiGet<GeopoliticalZone[]>('/risk-zones/geography', { auth: true });
}
