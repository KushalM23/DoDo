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
  | "briefcase"
  | "heart"
  | "user"
  | "book-open"
  | "dumbbell"
  | "droplets"
  | "utensils"
  | "bed"
  | "brain"
  | "music"
  | "sun"
  | "moon"
  | "coffee"
  | "shopping-cart";

export const CATEGORY_COLOR_OPTIONS = [
  "#E5484D",
  "#EC4899",
  "#A855F7",
  "#8B5CF6",
  "#6366F1",
  "#3B82F6",
  "#0EA5E9",
  "#06B6D4",
  "#14B8A6",
  "#10B981",
  "#84CC16",
  "#EAB308",
] as const;

export const CATEGORY_ICON_OPTIONS: CategoryIcon[] = [
  "briefcase",
  "heart",
  "user",
  "book-open",
  "dumbbell",
  "droplets",
  "utensils",
  "bed",
  "brain",
  "music",
  "coffee",
  "shopping-cart",
];

export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLOR_OPTIONS[0];
export const DEFAULT_CATEGORY_ICON: CategoryIcon = "user";

export type CreateCategoryInput = {
  name: string;
  color: string;
  icon: CategoryIcon;
};
