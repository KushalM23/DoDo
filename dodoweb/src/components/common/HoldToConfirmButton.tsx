import React, {useEffect, useRef, useState} from 'react';
import {AppIcon, type AppIconName} from './AppIcon';

type HoldToConfirmButtonProps = {
  iconName: AppIconName;
  onHoldComplete: () => void;
  disabled?: boolean;
  holdDurationMs?: number;
  size?: number;
  backgroundColor?: string;
  progressColor?: string;
  iconColor?: string;
  disabledIconColor?: string;
  className?: string;
};

export function HoldToConfirmButton({
  iconName,
  onHoldComplete,
  disabled = false,
  holdDurationMs = 3000,
  size = 84,
  backgroundColor,
  progressColor,
  iconColor,
  disabledIconColor,
  className,
}: HoldToConfirmButtonProps) {
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  function clearHold(resetProgress = true) {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
    if (resetProgress) {
      setProgress(0);
    }
  }

  function startHold() {
    if (disabled) {
      return;
    }
    clearHold(false);
    doneRef.current = false;
    startRef.current = Date.now();

    timerRef.current = window.setInterval(() => {
      if (startRef.current == null) {
        return;
      }
      const elapsed = Date.now() - startRef.current;
      const nextProgress = Math.max(0, Math.min(1, elapsed / holdDurationMs));
      setProgress(nextProgress);
      if (nextProgress >= 1 && !doneRef.current) {
        doneRef.current = true;
        clearHold(false);
        setProgress(1);
        window.setTimeout(() => {
          setProgress(0);
          onHoldComplete();
        }, 120);
      }
    }, 40);
  }

  useEffect(() => () => clearHold(), []);

  return (
    <button
      type="button"
      className={`hold-button ${className ?? ''}`.trim()}
      disabled={disabled}
      onMouseDown={startHold}
      onMouseUp={() => clearHold()}
      onMouseLeave={() => clearHold()}
      onTouchStart={startHold}
      onTouchEnd={() => clearHold()}
      style={{
        width: size,
        height: size,
        background: backgroundColor,
        '--progress-scale': String(progress),
        '--progress-color': progressColor ?? 'var(--accent)',
      } as React.CSSProperties}>
      <span className="hold-progress" />
      <AppIcon
        name={iconName}
        size={24}
        color={disabled ? disabledIconColor ?? 'var(--muted-text)' : iconColor ?? 'var(--text)'}
      />
    </button>
  );
}
