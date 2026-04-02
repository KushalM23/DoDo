import React from "react";
import { cx, tw } from "@/lib/tw";
import { darkColors } from "@/theme/ThemeProvider";
import { AppIcon, type AppIconName } from "./AppIcon";
import { HoldToConfirmButton } from "./HoldToConfirmButton";

type FocusModeViewProps = {
  now: Date;
  timeFormat: "12h" | "24h";
  title: string;
  metaLines: string[];
  onExitFocus: () => void;
  actionLabel: string;
  actionIconName: AppIconName;
  onActionPress: () => void;
  actionDisabled?: boolean;
  actionDone?: boolean;
  infoIconName?: AppIconName;
  infoIconColor?: string;
  elapsedSeconds?: number;
};

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

function buildClock(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds].map((value) =>
    String(value).padStart(2, "0"),
  );
}

export function FocusModeView({
  now,
  timeFormat,
  title,
  metaLines,
  onExitFocus,
  actionLabel,
  actionIconName,
  onActionPress,
  actionDisabled = false,
  actionDone = false,
  infoIconName,
  infoIconColor,
  elapsedSeconds,
}: FocusModeViewProps) {
  const hour24 = now.getHours();
  const hour = timeFormat === "24h" ? hour24 : ((hour24 + 11) % 12) + 1;
  const clockSections =
    typeof elapsedSeconds === "number" ? buildClock(elapsedSeconds) : null;

  return (
    <div
      className="grid min-h-screen bg-background p-6 text-text md:p-10"
      style={
        {
          background: darkColors.background,
          color: darkColors.text,
        } as React.CSSProperties
      }
    >
      <div className="mx-auto grid h-[min(84vh,780px)] w-full max-w-[1320px] gap-12 xl:grid-cols-[minmax(0,1fr)_460px] items-center">
        <div className="flex items-center justify-center xl:justify-start xl:pl-4">
          <div className="flex items-end gap-3 leading-none">
            <div className="font-display text-[clamp(128px,21vw,240px)] leading-[0.8] tracking-[-0.04em]">
              {twoDigits(hour)}
            </div>
            <em className="pb-8 text-[clamp(102px,16vw,180px)] not-italic text-accent">
              :
            </em>
            <div className="font-display text-[clamp(128px,21vw,240px)] leading-[0.8] tracking-[-0.04em]">
              {twoDigits(now.getMinutes())}
            </div>
          </div>
        </div>

        <div className="flex w-full max-w-[460px] flex-col gap-4">
          <div className="grid gap-3 text-center">
            {infoIconName ? (
              <AppIcon
                name={infoIconName}
                size={24}
                color={infoIconColor ?? darkColors.text}
              />
            ) : null}
            <h1 className="m-0 font-display-semibold text-[40px] leading-[0.95] tracking-[-0.8px]">
              {title}
            </h1>
            {metaLines.map((line, index) => (
              <p
                key={`${line}-${index}`}
                className="m-0 text-base"
                style={{ color: darkColors.mutedText }}
              >
                {line}
              </p>
            ))}
          </div>

          <div className="flex justify-center">
            {clockSections ? (
              <div
                className="flex justify-center items-center gap-1.5"
                aria-label="Focus timer"
              >
                {clockSections.map((section, index) => (
                  <React.Fragment key={`${section}-${index}`}>
                    <span className="m-0 font-display-semibold text-[clamp(38px,4.8vw,56px)] leading-none">
                      {section}
                    </span>
                    {index < clockSections.length - 1 ? (
                      <em className="text-[34px] not-italic text-accent">:</em>
                    ) : null}
                  </React.Fragment>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-auto grid gap-4 pb-2">
            <div className="grid place-items-center">
              <HoldToConfirmButton
                iconName="lock-open"
                onHoldComplete={onExitFocus}
                holdDurationMs={3000}
                size={84}
                backgroundColor={darkColors.surface}
                progressColor={darkColors.accent}
                iconColor={darkColors.text}
                disabledIconColor={darkColors.mutedText}
              />
            </div>

            <button
              type="button"
              className={cx(
                tw.action,
                "w-full justify-center",
                actionDone ? tw.actionMuted : tw.actionAccent,
              )}
              onClick={onActionPress}
              disabled={actionDisabled}
            >
              <AppIcon
                name={actionIconName}
                size={18}
                color={actionDone ? darkColors.accent : "#fff"}
              />
              <span>{actionLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
