import React from 'react';
import {
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Home,
  Lock,
  LucideIcon,
  Shield,
  Star,
  User,
  Users,
} from 'lucide-react-native';

export type ProfileGlyphName =
  | 'user'
  | 'users'
  | 'shield'
  | 'lock'
  | 'eye-off'
  | 'home'
  | 'briefcase'
  | 'chevron-left'
  | 'chevron-right'
  | 'star';

type Props = {
  name: ProfileGlyphName;
  color: string;
  size?: number;
};

const iconMap: Record<ProfileGlyphName, LucideIcon> = {
  user: User,
  users: Users,
  shield: Shield,
  lock: Lock,
  'eye-off': EyeOff,
  home: Home,
  briefcase: BriefcaseBusiness,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  star: Star,
};

export const ProfileGlyph = ({ name, color, size = 20 }: Props) => {
  const Icon = iconMap[name];

  return <Icon color={color} size={size} strokeWidth={2.15} />;
};
