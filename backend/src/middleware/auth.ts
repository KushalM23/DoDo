import type { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "../config/supabase.js";

export type AuthenticatedRequest = Request & {
  userId: string;
};

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : null;

  if (!token) {
    res.status(401).json({ error: "Missing bearer token." });
    return;
  }

  // Validate Supabase JWT and resolve the user identity for request scoping.
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired token." });
    return;
  }

  (req as AuthenticatedRequest).userId = data.user.id;
  next();
}

