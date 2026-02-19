import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  fetchCategories,
  createCategory as apiCreateCategory,
  updateCategory as apiUpdateCategory,
  deleteCategory as apiDeleteCategory,
} from "../services/api";
import { useAuth } from "./AuthContext";
import type { Category, CreateCategoryInput } from "../types/category";

type CategoriesContextValue = {
  categories: Category[];
  loading: boolean;
  refresh: () => Promise<void>;
  addCategory: (input: CreateCategoryInput) => Promise<void>;
  editCategory: (id: string, input: CreateCategoryInput) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
};

const CategoriesContext = createContext<CategoriesContextValue | undefined>(undefined);

const DEFAULT_CATEGORY_NAMES = ["Personal", "Work"];

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setCategories([]);
      return;
    }
    setLoading(true);
    try {
      const cats = await fetchCategories();
      if (cats.length === 0) {
        // Seed default categories for new users
        const seeded: Category[] = [];
        for (const name of DEFAULT_CATEGORY_NAMES) {
          const c = await apiCreateCategory({ name });
          seeded.push(c);
        }
        setCategories(seeded);
      } else {
        setCategories(cats);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user]);

  const addCategory = useCallback(async (input: CreateCategoryInput) => {
    const cat = await apiCreateCategory(input);
    setCategories((prev) => [...prev, cat]);
  }, []);

  const editCategory = useCallback(async (id: string, input: CreateCategoryInput) => {
    const updated = await apiUpdateCategory(id, input);
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }, []);

  const removeCategory = useCallback(async (id: string) => {
    await apiDeleteCategory(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<CategoriesContextValue>(
    () => ({ categories, loading, refresh, addCategory, editCategory, removeCategory }),
    [categories, loading, refresh, addCategory, editCategory, removeCategory],
  );

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

export function useCategories(): CategoriesContextValue {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error("useCategories must be used inside CategoriesProvider");
  return ctx;
}
