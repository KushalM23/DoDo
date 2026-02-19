import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  fetchCategories,
  createCategory as apiCreateCategory,
  updateCategory as apiUpdateCategory,
  deleteCategory as apiDeleteCategory,
} from "../services/api";
import { useAuth } from "./AuthContext";
import type { Category, CreateCategoryInput } from "../types/category";

function tempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

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
        const seeded: Category[] = [];
        for (const name of DEFAULT_CATEGORY_NAMES) {
          const c = await apiCreateCategory({ name });
          seeded.push(c);
        }
        setCategories(seeded);
      } else {
        setCategories(cats);
      }
    } catch (err) {
      console.error('[CategoriesContext] refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Optimistic add
  const addCategory = useCallback(async (input: CreateCategoryInput) => {
    const id = tempId();
    const optimistic: Category = { id, name: input.name, createdAt: new Date().toISOString() };
    setCategories((prev) => [...prev, optimistic]);

    apiCreateCategory(input)
      .then((real) => {
        setCategories((prev) => prev.map((c) => (c.id === id ? real : c)));
      })
      .catch((err) => {
        setCategories((prev) => prev.filter((c) => c.id !== id));
        console.error('[CategoriesContext] addCategory sync error:', err);
      });
  }, []);

  // Optimistic edit
  const editCategory = useCallback(async (id: string, input: CreateCategoryInput) => {
    let original: Category | undefined;
    setCategories((prev) => {
      original = prev.find((c) => c.id === id);
      return prev.map((c) => (c.id === id ? { ...c, name: input.name } : c));
    });

    apiUpdateCategory(id, input).catch((err) => {
      if (original) {
        setCategories((prev) => prev.map((c) => (c.id === id ? original! : c)));
      }
      console.error('[CategoriesContext] editCategory sync error:', err);
    });
  }, []);

  // Optimistic remove
  const removeCategory = useCallback(async (id: string) => {
    let removed: Category | undefined;
    setCategories((prev) => {
      removed = prev.find((c) => c.id === id);
      return prev.filter((c) => c.id !== id);
    });

    apiDeleteCategory(id).catch((err) => {
      if (removed) {
        setCategories((prev) => [...prev, removed!]);
      }
      console.error('[CategoriesContext] removeCategory sync error:', err);
    });
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
