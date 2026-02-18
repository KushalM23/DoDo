import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../config/supabase.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { toTaskDto, type TaskRow } from "../types/task.js";

const prioritySchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(1000).optional().default(""),
  scheduledAt: z.string().datetime(),
  deadline: z.string().datetime(),
  priority: prioritySchema,
});

const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(140).optional(),
    description: z.string().trim().max(1000).optional(),
    scheduledAt: z.string().datetime().optional(),
    deadline: z.string().datetime().optional(),
    priority: prioritySchema.optional(),
    completed: z.boolean().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, "At least one field is required.");

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

tasksRouter.get("/", async (req, res) => {
  const { userId } = req as AuthenticatedRequest;

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
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
      scheduled_at: payload.scheduledAt,
      deadline: payload.deadline,
      priority: payload.priority,
      completed: false,
      completed_at: null,
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
  if (payload.scheduledAt !== undefined) updatePayload.scheduled_at = payload.scheduledAt;
  if (payload.deadline !== undefined) updatePayload.deadline = payload.deadline;
  if (payload.priority !== undefined) updatePayload.priority = payload.priority;
  if (payload.completed !== undefined) {
    updatePayload.completed = payload.completed;
    updatePayload.completed_at = payload.completed ? new Date().toISOString() : null;
  }

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
