import React from "react";
import Lucide from "@react-native-vector-icons/lucide";

export type AppIconName =
  | "alert-circle"
  | "arrow-down"
  | "arrow-down-circle"
  | "arrow-up"
  | "arrow-up-circle"
  | "arrow-up-down"
  | "briefcase"
  | "calendar"
  | "check"
  | "check-square"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "chevron-up"
  | "clock"
  | "edit"
  | "file-text"
  | "flame"
  | "flame-kindling"
  | "heart"
  | "inbox"
  | "log-out"
  | "lock"
  | "lock-open"
  | "key-round"
  | "minus-circle"
  | "package"
  | "play"
  | "plus"
  | "percent"
  | "rotate-ccw"
  | "repeat"
  | "save"
  | "settings"
  | "sliders"
  | "sun"
  | "moon"
  | "sunrise"
  | "sunset"
  | "square"
  | "trash-2"
  | "user"
  | "x"
  | "zap";

type Props = {
  name: AppIconName;
  strokeWidth?: number;
} & Omit<React.ComponentProps<typeof Lucide>, "name">;

const ICON_NAME_MAP: Record<AppIconName, string> = {
  "alert-circle": "circle-alert",
  "arrow-down": "arrow-down",
  "arrow-down-circle": "circle-arrow-down",
  "arrow-up-circle": "circle-arrow-up",
  "arrow-up": "arrow-up",
  "arrow-up-down": "arrow-up-down",
  briefcase: "briefcase",
  calendar: "calendar",
  check: "check",
  "check-square": "square-check",
  "chevron-down": "chevron-down",
  "chevron-left": "chevron-left",
  "chevron-right": "chevron-right",
  "chevron-up": "chevron-up",
  clock: "clock",
  edit: "pencil",
  "file-text": "file-text",
  flame: "flame",
  "flame-kindling": "flame-kindling",
  heart: "heart",
  inbox: "inbox",
  "log-out": "log-out",
  lock: "lock",
  "lock-open": "lock-open",
  "key-round": "key-round",
  "minus-circle": "circle-minus",
  package: "package",
  play: "play",
  plus: "plus",
  percent: "percent",
  "rotate-ccw": "rotate-ccw",
  repeat: "repeat",
  save: "save",
  settings: "settings",
  sliders: "sliders-horizontal",
  sun: "sun",
  moon: "moon",
  sunrise: "sunrise",
  sunset: "sunset",
  square: "square",
  "trash-2": "trash-2",
  user: "user",
  x: "x",
  zap: "zap",
};

export function AppIcon({ name, size = 16, color = "#000", strokeWidth = 2, ...rest }: Props) {
  const resolvedName = ICON_NAME_MAP[name] as React.ComponentProps<typeof Lucide>["name"];
  return <Lucide name={resolvedName} size={size} color={color} {...rest} />;
}
