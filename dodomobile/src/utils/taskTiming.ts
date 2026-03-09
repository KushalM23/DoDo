import type {Task} from '../types/task';

function normalizeSeconds(seconds: number | null | undefined): number {
  if (seconds == null || !Number.isFinite(seconds)) {
    return 0;
  }
  return Math.max(0, Math.floor(seconds));
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getTaskTrackedSeconds(
  task: Pick<
    Task,
    'actualDurationSeconds' | 'actualDurationMinutes' | 'timerStartedAt'
  >,
  now: Date = new Date(),
): number {
  let total = normalizeSeconds(
    task.actualDurationSeconds ?? task.actualDurationMinutes * 60,
  );
  const startedAtMs = parseTimestamp(task.timerStartedAt);
  if (startedAtMs == null) {
    return total;
  }

  const elapsed = Math.max(0, Math.floor((now.getTime() - startedAtMs) / 1000));
  total += elapsed;
  return total;
}

export function getTaskPlannedSeconds(
  task: Pick<Task, 'durationMinutes' | 'scheduledAt' | 'deadline'>,
): number {
  if (
    task.durationMinutes != null &&
    Number.isFinite(task.durationMinutes) &&
    task.durationMinutes > 0
  ) {
    return Math.max(60, Math.round(task.durationMinutes * 60));
  }

  const scheduledAtMs = parseTimestamp(task.scheduledAt);
  const deadlineMs = parseTimestamp(task.deadline);
  if (scheduledAtMs == null || deadlineMs == null) {
    return 60;
  }

  return Math.max(60, Math.floor((deadlineMs - scheduledAtMs) / 1000));
}

export function formatClockDuration(totalSeconds: number): string {
  const safeSeconds = normalizeSeconds(totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
      2,
      '0',
    )}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0',
  )}`;
}

export function formatCompactDuration(totalSeconds: number): string {
  const safeSeconds = normalizeSeconds(totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}