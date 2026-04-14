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

export async function listRiskZones() {
  return apiGet<RiskZone[]>('/risk-zones', { auth: true });
}
