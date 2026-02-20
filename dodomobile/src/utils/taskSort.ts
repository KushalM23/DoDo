import type { Task } from "../types/task";

export type SortMode =
  | "smart"
  | "priority_desc"
  | "priority_asc"
  | "time_asc"
  | "time_desc"
  | "deadline_asc"
  | "deadline_desc";

function priorityWeight(priority: number): number {
  if (priority === 3) return 50;
  if (priority === 2) return 25;
  return 10;
}

function deadlineWeight(deadlineIso: string): number {
  const deadline = new Date(deadlineIso).getTime();
  const now = Date.now();
  const diffHours = (deadline - now) / (1000 * 60 * 60);

  if (diffHours <= 0) return 100;
  if (diffHours <= 12) return 60;
  if (diffHours <= 24) return 35;
  if (diffHours <= 72) return 15;
  return 0;
}

function scheduledAtWeight(scheduledAtIso: string): number {
  const scheduled = new Date(scheduledAtIso).getTime();
  const now = Date.now();
  const diffHours = (now - scheduled) / (1000 * 60 * 60);
  return diffHours > 0 ? Math.min(20, diffHours / 3) : 0;
}

function completionFirst(a: Task, b: Task): number | null {
  if (a.completed !== b.completed) return a.completed ? 1 : -1;
  return null;
}

export function sortTasks(tasks: Task[], mode: SortMode = "smart"): Task[] {
  return [...tasks].sort((a, b) => {
    const cf = completionFirst(a, b);
    if (cf !== null) return cf;

    switch (mode) {
      case "priority_desc":
        return b.priority - a.priority || new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      case "priority_asc":
        return a.priority - b.priority || new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      case "time_asc":
        return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      case "time_desc":
        return new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime();
      case "deadline_asc":
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      case "deadline_desc":
        return new Date(b.deadline).getTime() - new Date(a.deadline).getTime();
      default: {
        const scoreA = priorityWeight(a.priority) + deadlineWeight(a.deadline) + scheduledAtWeight(a.scheduledAt);
        const scoreB = priorityWeight(b.priority) + deadlineWeight(b.deadline) + scheduledAtWeight(b.scheduledAt);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
    }
  });
}
