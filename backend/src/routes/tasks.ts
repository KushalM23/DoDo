import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../config/supabase.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { toTaskDto, type TaskRow } from "../types/task.js";

const prioritySchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(1000).optional().default(""),
  categoryId: z.string().uuid().nullable().optional().default(null),
  scheduledAt: z.string().datetime(),
  deadline: z.string().datetime(),
  durationMinutes: z.number().int().min(1).max(1440).nullable().optional().default(null),
  priority: prioritySchema,
});

const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(140).optional(),
    description: z.string().trim().max(1000).optional(),
    categoryId: z.string().uuid().nullable().optional(),
    scheduledAt: z.string().datetime().optional(),
    deadline: z.string().datetime().optional(),
    durationMinutes: z.number().int().min(1).max(1440).nullable().optional(),
    priority: prioritySchema.optional(),
    completed: z.boolean().optional(),
    timerStartedAt: z.string().datetime().nullable().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, "At least one field is required.");

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

tasksRouter.get("/", async (req, res) => {
  const { userId } = req as AuthenticatedRequest;

  let query = supabaseAdmin
    .from("tasks")
    .select("*")
    .eq("user_id", userId);

  const { date, categoryId } = req.query;
  if (typeof date === "string") {
    const dayStart = `${date}T00:00:00.000Z`;
    const dayEnd = `${date}T23:59:59.999Z`;
    query = query.gte("scheduled_at", dayStart).lte("scheduled_at", dayEnd);
  }
  if (typeof categoryId === "string") {
    query = query.eq("category_id", categoryId);
  }

  const { data, error } = await query
    .order("completed", { ascending: true })
    .order("priority", { ascending: false })
    .order("deadline", { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const tasks = (data as TaskRow[]).map(toTaskDto);
  res.json({ tasks });
});

tasksRouter.post("/", async (req, res) => {
  const parseResult = createTaskSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.flatten() });
    return;
  }

  const { userId } = req as AuthenticatedRequest;
  const payload = parseResult.data;

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .insert({
      user_id: userId,
      title: payload.title,
      description: payload.description,
      category_id: payload.categoryId,
      scheduled_at: payload.scheduledAt,
      deadline: payload.deadline,
      duration_minutes: payload.durationMinutes,
      priority: payload.priority,
      completed: false,
      completed_at: null,
      timer_started_at: null,
    })
    .select("*")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json({ task: toTaskDto(data as TaskRow) });
});

tasksRouter.patch("/:taskId", async (req, res) => {
  const parseResult = updateTaskSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.flatten() });
    return;
  }

  const { userId } = req as AuthenticatedRequest;
  const { taskId } = req.params;
  const payload = parseResult.data;

  const updatePayload: Record<string, unknown> = {};
  if (payload.title !== undefined) updatePayload.title = payload.title;
  if (payload.description !== undefined) updatePayload.description = payload.description;
  if (payload.categoryId !== undefined) updatePayload.category_id = payload.categoryId;
  if (payload.scheduledAt !== undefined) updatePayload.scheduled_at = payload.scheduledAt;
  if (payload.deadline !== undefined) updatePayload.deadline = payload.deadline;
  if (payload.durationMinutes !== undefined) updatePayload.duration_minutes = payload.durationMinutes;
  if (payload.priority !== undefined) updatePayload.priority = payload.priority;
  if (payload.completed !== undefined) {
    updatePayload.completed = payload.completed;
    updatePayload.completed_at = payload.completed ? new Date().toISOString() : null;
  }
  if (payload.timerStartedAt !== undefined) updatePayload.timer_started_at = payload.timerStartedAt;

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .update(updatePayload)
    .eq("id", taskId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Task not found." });
    return;
  }

  res.json({ task: toTaskDto(data as TaskRow) });
});

tasksRouter.delete("/:taskId", async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const { taskId } = req.params;

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Task not found." });
    return;
  }

  res.status(204).send();
});
