export type Category = {
  id: string;
  name: string;
  color: string;
  icon: CategoryIcon;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
  lastModifiedDeviceAt?: string;
  syncState?: 'synced' | 'pending' | 'retry' | 'terminal_local_only';
};

export type CategoryIcon =
  | 'briefcase'
  | 'heart'
  | 'user'
  | 'book-open'
  | 'dumbbell'
  | 'droplets'
  | 'utensils'
  | 'bed'
  | 'brain'
  | 'music'
  | 'sun'
  | 'moon'
  | 'coffee'
  | 'shopping-cart';

export const CATEGORY_COLOR_OPTIONS = [
  '#E5484D',
  '#EC4899',
  '#F97316',
  '#F59E0B',
  '#EAB308',
  '#84CC16',
  '#10B981',
  '#14B8A6',
  '#06B6D4',
  '#0EA5E9',
  '#3B82F6',
  '#64748B',
] as const;

const LEGACY_CATEGORY_COLOR_MAP: Record<
  string,
  (typeof CATEGORY_COLOR_OPTIONS)[number]
> = {
  '#A855F7': '#F97316',
  '#8B5CF6': '#0EA5E9',
  '#6366F1': '#3B82F6',
  '#E8651A': '#14B8A6',
  '#D85A12': '#14B8A6',
  '#30A46C': '#10B981',
  '#F5A623': '#F59E0B',
};

export const CATEGORY_ICON_OPTIONS: CategoryIcon[] = [
  'briefcase',
  'heart',
  'user',
  'book-open',
  'dumbbell',
  'droplets',
  'utensils',
  'bed',
  'brain',
  'music',
  'coffee',
  'shopping-cart',
];

export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLOR_OPTIONS[0];
export const DEFAULT_CATEGORY_ICON: CategoryIcon = 'user';

export function normalizeCategoryColor(
  color: string | null | undefined,
): string {
  if (!color) {
    return DEFAULT_CATEGORY_COLOR;
  }

  if ((CATEGORY_COLOR_OPTIONS as readonly string[]).includes(color)) {
    return color;
  }

  return LEGACY_CATEGORY_COLOR_MAP[color] ?? DEFAULT_CATEGORY_COLOR;
}

export type CreateCategoryInput = {
  name: string;
  color: string;
  icon: CategoryIcon;
};
