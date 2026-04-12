export type RapidAlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export type RapidAlertTag =
  | 'crime'
  | 'fire'
  | 'medical'
  | 'traffic'
  | 'environment'
  | 'suspicious_activity';

export const RAPID_ALERT_SEVERITIES: Record<
  RapidAlertSeverity,
  {
    label: string;
    shortLabel: string;
    description: string;
    direction: 'up' | 'right' | 'down' | 'left';
    color: string;
    accent: string;
  }
> = {
  critical: {
    label: 'Critical',
    shortLabel: 'Now',
    description: 'Immediate danger',
    direction: 'up',
    color: '#FF5E78',
    accent: '#FFD6DF',
  },
  high: {
    label: 'High',
    shortLabel: 'Serious',
    description: 'Can escalate fast',
    direction: 'right',
    color: '#FF8A3D',
    accent: '#FFE3CF',
  },
  medium: {
    label: 'Medium',
    shortLabel: 'Watch',
    description: 'Situational awareness',
    direction: 'down',
    color: '#F3C94E',
    accent: '#FFF4C6',
  },
  low: {
    label: 'Low',
    shortLabel: 'Info',
    description: 'Feed-only update',
    direction: 'left',
    color: '#6A88B9',
    accent: '#DCE6F6',
  },
};

export const RAPID_ALERT_TAGS: Array<{
  id: RapidAlertTag;
  label: string;
}> = [
  { id: 'crime', label: 'Crime' },
  { id: 'fire', label: 'Fire' },
  { id: 'medical', label: 'Medical' },
  { id: 'traffic', label: 'Traffic' },
  { id: 'environment', label: 'Environment' },
  { id: 'suspicious_activity', label: 'Suspicious' },
];

export const DEFAULT_RAPID_ALERT_TAG: RapidAlertTag = 'suspicious_activity';

export function getRapidAlertTitle(tag: RapidAlertTag, severity: RapidAlertSeverity) {
  const tagEntry = RAPID_ALERT_TAGS.find((entry) => entry.id === tag);
  const severityEntry = RAPID_ALERT_SEVERITIES[severity];
  return `${tagEntry?.label || 'Safety'} ${severityEntry.label} alert`;
}
