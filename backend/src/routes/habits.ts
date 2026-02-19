import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../config/supabase.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { toHabitDto, type HabitRow } from "../types/habit.js";

const createHabitSchema = z.object({
  title: z.string().trim().min(1).max(100),
  frequency: z.enum(["daily", "weekly"]).default("daily"),
});

const updateHabitSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  frequency: z.enum(["daily", "weekly"]).optional(),
}).refine((p) => Object.keys(p).length > 0, "At least one field is required.");

export const habitsRouter = Router();

habitsRouter.use(requireAuth);

habitsRouter.get("/", async (req, res) => {
  const { userId } = req as AuthenticatedRequest;

  const { data, error } = await supabaseAdmin
    .from("habits")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ habits: (data as HabitRow[]).map(toHabitDto) });
});

habitsRouter.post("/", async (req, res) => {
  const parseResult = createHabitSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.flatten() });
    return;
  }

  const { userId } = req as AuthenticatedRequest;

  const { data, error } = await supabaseAdmin
    .from("habits")
    .insert({ user_id: userId, title: parseResult.data.title, frequency: parseResult.data.frequency })
    .select("*")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json({ habit: toHabitDto(data as HabitRow) });
});

habitsRouter.patch("/:habitId", async (req, res) => {
  const parseResult = updateHabitSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.flatten() });
    return;
  }

  const userId = (req as unknown as AuthenticatedRequest).userId;
  const { habitId } = req.params;

  const updatePayload: Record<string, unknown> = {};
  if (parseResult.data.title !== undefined) updatePayload.title = parseResult.data.title;
  if (parseResult.data.frequency !== undefined) updatePayload.frequency = parseResult.data.frequency;

  const { data, error } = await supabaseAdmin
    .from("habits")
    .update(updatePayload)
    .eq("id", habitId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Habit not found." });
    return;
  }

  res.json({ habit: toHabitDto(data as HabitRow) });
});

habitsRouter.delete("/:habitId", async (req, res) => {
  const userId = (req as unknown as AuthenticatedRequest).userId;
  const { habitId } = req.params;

  const { data, error } = await supabaseAdmin
    .from("habits")
    .delete()
    .eq("id", habitId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Habit not found." });
    return;
  }

  res.status(204).send();
});
