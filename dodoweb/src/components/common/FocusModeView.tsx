import React from 'react';
import {cx, tw} from '@/lib/tw';
import {darkColors} from '@/theme/ThemeProvider';
import {AppIcon, type AppIconName} from './AppIcon';
import {HoldToConfirmButton} from './HoldToConfirmButton';

type FocusModeViewProps = {
  now: Date;
  timeFormat: '12h' | '24h';
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
  return String(value).padStart(2, '0');
}

function buildClock(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0'));
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
  const hour = timeFormat === '24h' ? hour24 : ((hour24 + 11) % 12) + 1;
  const clockSections =
    typeof elapsedSeconds === 'number' ? buildClock(elapsedSeconds) : null;

  return (
    <div
      className="grid min-h-screen place-items-center gap-[18px] bg-background p-10 px-6 text-text"
      style={
        {
          background: darkColors.background,
          color: darkColors.text,
        } as React.CSSProperties
      }>
      <div className="grid place-items-center gap-3">
        <div className="font-display text-[clamp(84px,16vw,140px)] leading-[0.95]">{twoDigits(hour)}</div>
        <div className="font-display text-[clamp(84px,16vw,140px)] leading-[0.95]">{twoDigits(now.getMinutes())}</div>
      </div>

      <div className="grid place-items-center gap-2 text-center">
        {infoIconName ? <AppIcon name={infoIconName} size={24} color={infoIconColor ?? darkColors.text} /> : null}
        <h1 className="m-0 font-display-semibold text-[30px] tracking-[-0.7px]">{title}</h1>
        {metaLines.map((line, index) => (
          <p key={`${line}-${index}`} className="m-0" style={{color: darkColors.mutedText}}>{line}</p>
        ))}
      </div>

      {clockSections ? (
        <div className="flex items-center gap-1.5" aria-label="Focus timer">
          {clockSections.map((section, index) => (
            <React.Fragment key={`${section}-${index}`}>
              <span className="m-0 font-display-semibold text-[clamp(34px,5vw,52px)]">{section}</span>
              {index < clockSections.length - 1 ? <em className="text-[34px] not-italic text-accent">:</em> : null}
            </React.Fragment>
          ))}
        </div>
      ) : null}

      <div className="grid place-items-center gap-3">
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

        <button
          type="button"
          className={cx(tw.action, actionDone ? tw.actionMuted : tw.actionAccent)}
          onClick={onActionPress}
          disabled={actionDisabled}>
          <AppIcon
            name={actionIconName}
            size={18}
            color={actionDone ? darkColors.accent : '#fff'}
          />
          <span>{actionLabel}</span>
        </button>
      </div>
    </div>
  );
}

