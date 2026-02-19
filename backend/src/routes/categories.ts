import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../config/supabase.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { toCategoryDto, type CategoryRow } from "../types/category.js";

const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(50),
});

const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(50),
});

export const categoriesRouter = Router();

categoriesRouter.use(requireAuth);

categoriesRouter.get("/", async (req, res) => {
  const { userId } = req as AuthenticatedRequest;

  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ categories: (data as CategoryRow[]).map(toCategoryDto) });
});

categoriesRouter.post("/", async (req, res) => {
  const parseResult = createCategorySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.flatten() });
    return;
  }

  const { userId } = req as AuthenticatedRequest;

  const { data, error } = await supabaseAdmin
    .from("categories")
    .insert({ user_id: userId, name: parseResult.data.name })
    .select("*")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json({ category: toCategoryDto(data as CategoryRow) });
});

categoriesRouter.patch("/:categoryId", async (req, res) => {
  const parseResult = updateCategorySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.flatten() });
    return;
  }

  const userId = (req as unknown as AuthenticatedRequest).userId;
  const { categoryId } = req.params;

  const { data, error } = await supabaseAdmin
    .from("categories")
    .update({ name: parseResult.data.name })
    .eq("id", categoryId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Category not found." });
    return;
  }

  res.json({ category: toCategoryDto(data as CategoryRow) });
});

categoriesRouter.delete("/:categoryId", async (req, res) => {
  const userId = (req as unknown as AuthenticatedRequest).userId;
  const { categoryId } = req.params;

  const { data, error } = await supabaseAdmin
    .from("categories")
    .delete()
    .eq("id", categoryId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Category not found." });
    return;
  }

  res.status(204).send();
});
