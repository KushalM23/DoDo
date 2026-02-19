export type Category = {
  id: string;
  name: string;
  color: string;
  icon: CategoryIcon;
  createdAt: string;
};

export type CategoryIcon =
  | "inbox"
  | "briefcase"
  | "check-square"
  | "calendar"
  | "flame"
  | "heart"
  | "user"
  | "settings"
  | "repeat"
  | "zap";

export const CATEGORY_COLOR_OPTIONS = [
  "#E8651A",
  "#30A46C",
  "#3B82F6",
  "#E5484D",
  "#F5A623",
  "#8B5CF6",
  "#14B8A6",
  "#EC4899",
] as const;

export const CATEGORY_ICON_OPTIONS: CategoryIcon[] = [
  "inbox",
  "briefcase",
  "check-square",
  "calendar",
  "flame",
  "heart",
  "user",
  "settings",
  "repeat",
  "zap",
];

export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLOR_OPTIONS[0];
export const DEFAULT_CATEGORY_ICON: CategoryIcon = "inbox";

export type CreateCategoryInput = {
  name: string;
  color: string;
  icon: CategoryIcon;
};
