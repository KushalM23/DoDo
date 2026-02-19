import React from "react";
import Lucide from "@react-native-vector-icons/lucide";

export type AppIconName =
  | "alert-circle"
  | "arrow-down"
  | "arrow-down-circle"
  | "arrow-up"
  | "calendar"
  | "check"
  | "check-square"
  | "chevron-down"
  | "clock"
  | "inbox"
  | "log-out"
  | "minus-circle"
  | "play"
  | "plus"
  | "repeat"
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
  "arrow-up": "arrow-up",
  calendar: "calendar",
  check: "check",
  "check-square": "square-check",
  "chevron-down": "chevron-down",
  clock: "clock",
  inbox: "inbox",
  "log-out": "log-out",
  "minus-circle": "circle-minus",
  play: "play",
  plus: "plus",
  repeat: "repeat",
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
