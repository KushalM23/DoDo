import React from 'react';
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
      className="focus-mode"
      style={
        {
          '--focus-background': darkColors.background,
          '--focus-text': darkColors.text,
          '--focus-muted': darkColors.mutedText,
          '--focus-accent': darkColors.accent,
          '--focus-surface': darkColors.surface,
        } as React.CSSProperties
      }>
      <div className="focus-clock-wrap">
        <div className="focus-clock-line">{twoDigits(hour)}</div>
        <div className="focus-clock-line">{twoDigits(now.getMinutes())}</div>
      </div>

      <div className="focus-info-block">
        {infoIconName ? <AppIcon name={infoIconName} size={24} color={infoIconColor ?? darkColors.text} /> : null}
        <h1>{title}</h1>
        {metaLines.map((line, index) => (
          <p key={`${line}-${index}`}>{line}</p>
        ))}
      </div>

      {clockSections ? (
        <div className="focus-elapsed-clock" aria-label="Focus timer">
          {clockSections.map((section, index) => (
            <React.Fragment key={`${section}-${index}`}>
              <span>{section}</span>
              {index < clockSections.length - 1 ? <em>:</em> : null}
            </React.Fragment>
          ))}
        </div>
      ) : null}

      <div className="focus-actions">
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
          className={`action-pill ${actionDone ? 'muted' : 'accent'}`}
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
