import React from 'react';
import {
  CircleUserRound,
  Clock3,
  House,
  Layers3,
  Logs,
  LucideIcon,
  MapPin,
  Settings2,
  Users,
} from 'lucide-react-native';

type IconName =
  | 'home'
  | 'risk-log'
  | 'contacts'
  | 'profile'
  | 'watch'
  | 'layers'
  | 'settings'
  | 'location';

type Props = {
  name: IconName;
  color: string;
  active?: boolean;
};

const iconMap: Record<IconName, LucideIcon> = {
  home: House,
  'risk-log': Logs,
  contacts: Users,
  profile: CircleUserRound,
  watch: Clock3,
  layers: Layers3,
  settings: Settings2,
  location: MapPin,
};

export const AppIcon = ({ name, color, active = false }: Props) => {
  const Icon = iconMap[name];

  return (
    <Icon
      color={color}
      size={active ? 20 : 19}
      strokeWidth={active ? 2.35 : 2.1}
    />
  );
};
