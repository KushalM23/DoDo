import React from "react";
import Lucide from "@react-native-vector-icons/lucide";

export type AppIconName =
  | "alert-circle"
  | "arrow-down"
  | "arrow-down-circle"
  | "arrow-up"
  | "arrow-up-circle"
  | "arrow-up-down"
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
  | "inbox"
  | "log-out"
  | "minus-circle"
  | "package"
  | "play"
  | "plus"
  | "repeat"
  | "save"
  | "sliders"
  | "sun"
  | "sunrise"
  | "sunset"
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
  inbox: "inbox",
  "log-out": "log-out",
  "minus-circle": "circle-minus",
  package: "package",
  play: "play",
  plus: "plus",
  repeat: "repeat",
  save: "save",
  sliders: "sliders-horizontal",
  sun: "sun",
  sunrise: "sunrise",
  sunset: "sunset",
  "trash-2": "trash-2",
  user: "user",
  x: "x",
  zap: "zap",
};

export function AppIcon({ name, size = 16, color = "#000", strokeWidth = 2, ...rest }: Props) {
  const resolvedName = ICON_NAME_MAP[name] as React.ComponentProps<typeof Lucide>["name"];
  return <Lucide name={resolvedName} size={size} color={color} {...rest} />;
}
