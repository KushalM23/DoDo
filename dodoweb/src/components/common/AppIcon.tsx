import React from 'react';
import * as Icons from 'lucide-react';

export type AppIconName =
  | 'alert-circle'
  | 'align-left'
  | 'align-center'
  | 'align-right'
  | 'arrow-down'
  | 'arrow-down-circle'
  | 'arrow-up'
  | 'arrow-up-circle'
  | 'arrow-up-down'
  | 'bed'
  | 'book-open'
  | 'brain'
  | 'briefcase'
  | 'calendar'
  | 'camera'
  | 'check'
  | 'check-circle'
  | 'check-square'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'clock'
  | 'coffee'
  | 'cup-soda'
  | 'droplets'
  | 'dumbbell'
  | 'edit'
  | 'eye'
  | 'eye-off'
  | 'file-text'
  | 'flame'
  | 'flame-kindling'
  | 'gift'
  | 'globe'
  | 'grip-vertical'
  | 'heart'
  | 'hourglass'
  | 'inbox'
  | 'key'
  | 'key-round'
  | 'leaf'
  | 'list'
  | 'list-ordered'
  | 'lock'
  | 'lock-open'
  | 'log-out'
  | 'map-pin'
  | 'minus-circle'
  | 'moon'
  | 'music'
  | 'package'
  | 'percent'
  | 'pin'
  | 'play'
  | 'plus'
  | 'repeat'
  | 'rotate-ccw'
  | 'save'
  | 'settings'
  | 'shopping-cart'
  | 'sliders'
  | 'square'
  | 'star'
  | 'sun'
  | 'sunrise'
  | 'sunset'
  | 'target'
  | 'trash-2'
  | 'user'
  | 'utensils'
  | 'x'
  | 'zap';

const ICON_NAME_MAP: Record<AppIconName, React.ComponentType<any>> = {
  'alert-circle': Icons.CircleAlert,
  'align-left': Icons.AlignLeft,
  'align-center': Icons.AlignCenter,
  'align-right': Icons.AlignRight,
  'arrow-down': Icons.ArrowDown,
  'arrow-down-circle': Icons.CircleArrowDown,
  'arrow-up': Icons.ArrowUp,
  'arrow-up-circle': Icons.CircleArrowUp,
  'arrow-up-down': Icons.ArrowUpDown,
  bed: Icons.Bed,
  'book-open': Icons.BookOpen,
  brain: Icons.Brain,
  briefcase: Icons.Briefcase,
  calendar: Icons.Calendar,
  camera: Icons.Camera,
  check: Icons.Check,
  'check-circle': Icons.CircleCheck,
  'check-square': Icons.SquareCheck,
  'chevron-down': Icons.ChevronDown,
  'chevron-left': Icons.ChevronLeft,
  'chevron-right': Icons.ChevronRight,
  'chevron-up': Icons.ChevronUp,
  clock: Icons.Clock3,
  coffee: Icons.Coffee,
  'cup-soda': Icons.CupSoda,
  droplets: Icons.Droplets,
  dumbbell: Icons.Dumbbell,
  edit: Icons.Pencil,
  eye: Icons.Eye,
  'eye-off': Icons.EyeOff,
  'file-text': Icons.FileText,
  flame: Icons.Flame,
  'flame-kindling': Icons.FlameKindling,
  gift: Icons.Gift,
  globe: Icons.Globe,
  'grip-vertical': Icons.GripVertical,
  heart: Icons.Heart,
  hourglass: Icons.Hourglass,
  inbox: Icons.Inbox,
  key: Icons.Key,
  'key-round': Icons.KeyRound,
  leaf: Icons.Leaf,
  list: Icons.List,
  'list-ordered': Icons.ListOrdered,
  lock: Icons.Lock,
  'lock-open': Icons.LockOpen,
  'log-out': Icons.LogOut,
  'map-pin': Icons.MapPin,
  'minus-circle': Icons.CircleMinus,
  moon: Icons.Moon,
  music: Icons.Music,
  package: Icons.Package,
  percent: Icons.Percent,
  pin: Icons.Pin,
  play: Icons.Play,
  plus: Icons.Plus,
  repeat: Icons.Repeat,
  'rotate-ccw': Icons.RotateCcw,
  save: Icons.Save,
  settings: Icons.Settings,
  'shopping-cart': Icons.ShoppingCart,
  sliders: Icons.SlidersHorizontal,
  square: Icons.Square,
  star: Icons.Star,
  sun: Icons.Sun,
  sunrise: Icons.Sunrise,
  sunset: Icons.Sunset,
  target: Icons.Target,
  'trash-2': Icons.Trash2,
  user: Icons.User,
  utensils: Icons.Utensils,
  x: Icons.X,
  zap: Icons.Zap,
};

type Props = {
  name: AppIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
};

export function AppIcon({
  name,
  size = 16,
  color = 'currentColor',
  strokeWidth = 2,
  className,
}: Props) {
  const Icon = ICON_NAME_MAP[name];
  return <Icon size={size} color={color} strokeWidth={strokeWidth} className={className} />;
}
