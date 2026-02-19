import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  createCategory as apiCreateCategory,
  deleteCategory as apiDeleteCategory,
  fetchCategories,
  updateCategory as apiUpdateCategory,
} from "../services/api";
import { useAuth } from "./AuthContext";
import {
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
  type Category,
  type CategoryIcon,
  type CreateCategoryInput,
} from "../types/category";

type CategoriesContextValue = {
  categories: Category[];
  loading: boolean;
  refresh: () => Promise<void>;
  addCategory: (input: CreateCategoryInput) => Promise<void>;
  editCategory: (id: string, input: CreateCategoryInput) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
  setCategoryOrder: (orderedIds: string[]) => Promise<void>;
};

const CategoriesContext = createContext<CategoriesContextValue | undefined>(undefined);

const DEFAULT_CATEGORIES: Array<{ name: string; color: string; icon: CategoryIcon }> = [
  { name: "Personal", color: "#E8651A", icon: "user" },
  { name: "Work", color: "#3B82F6", icon: "briefcase" },
];
const CATEGORY_ORDER_KEY_PREFIX = "dodo.categoryOrder";

function orderKey(userId: string): string {
  return `${CATEGORY_ORDER_KEY_PREFIX}:${userId}`;
}

function orderCategories(categories: Category[], orderedIds: string[]): Category[] {
  const indexMap = new Map<string, number>();
  orderedIds.forEach((id, index) => indexMap.set(id, index));

  return [...categories].sort((a, b) => {
    const aIndex = indexMap.get(a.id);
    const bIndex = indexMap.get(b.id);

    if (aIndex != null && bIndex != null) return aIndex - bIndex;
    if (aIndex != null) return -1;
    if (bIndex != null) return 1;

    return a.createdAt.localeCompare(b.createdAt);
  });
}

function normalizeOrder(categories: Category[], rawOrder: string[]): string[] {
  const existingIds = new Set(categories.map((c) => c.id));
  const nextOrder = rawOrder.filter((id) => existingIds.has(id));

  for (const category of categories) {
    if (!nextOrder.includes(category.id)) {
      nextOrder.push(category.id);
    }
  }

  return nextOrder;
}

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);

  const persistOrder = useCallback(
    async (ids: string[]) => {
      if (!user?.id) return;
      await AsyncStorage.setItem(orderKey(user.id), JSON.stringify(ids));
    },
    [user?.id],
  );

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setCategories([]);
      setOrderedIds([]);
      return;
    }

    setLoading(true);
    try {
      let nextCategories = await fetchCategories();
      if (nextCategories.length === 0) {
        const seeded: Category[] = [];
        for (const category of DEFAULT_CATEGORIES) {
          seeded.push(await apiCreateCategory(category));
        }
        nextCategories = seeded;
      }

      nextCategories = nextCategories.map((category) => ({
        ...category,
        color: category.color || DEFAULT_CATEGORY_COLOR,
        icon: category.icon || DEFAULT_CATEGORY_ICON,
      }));

      const storedOrderRaw = await AsyncStorage.getItem(orderKey(user.id));
      let storedOrder: string[] = [];
      if (storedOrderRaw) {
        try {
          storedOrder = JSON.parse(storedOrderRaw) as string[];
        } catch {
          storedOrder = [];
        }
      }
      const normalizedOrder = normalizeOrder(nextCategories, storedOrder);

      setOrderedIds(normalizedOrder);
      setCategories(orderCategories(nextCategories, normalizedOrder));

      if (storedOrderRaw == null || JSON.stringify(storedOrder) !== JSON.stringify(normalizedOrder)) {
        await persistOrder(normalizedOrder);
      }
    } catch (err) {
      console.error("[CategoriesContext] refresh error:", err);
    } finally {
      setLoading(false);
    }
  }, [persistOrder, user?.id]);

  const addCategory = useCallback(
    async (input: CreateCategoryInput) => {
      const name = input.name.trim();
      if (!name) throw new Error("Category name cannot be empty.");

      const created = await apiCreateCategory({
        name,
        color: input.color || DEFAULT_CATEGORY_COLOR,
        icon: input.icon || DEFAULT_CATEGORY_ICON,
      });

      const nextCategories = [...categories, created];
      const nextOrder = normalizeOrder(nextCategories, [...orderedIds, created.id]);

      setOrderedIds(nextOrder);
      setCategories(orderCategories(nextCategories, nextOrder));
      await persistOrder(nextOrder);
    },
    [categories, orderedIds, persistOrder],
  );

  const editCategory = useCallback(
    async (id: string, input: CreateCategoryInput) => {
      const name = input.name.trim();
      if (!name) throw new Error("Category name cannot be empty.");

      const updated = await apiUpdateCategory(id, {
        name,
        color: input.color || DEFAULT_CATEGORY_COLOR,
        icon: input.icon || DEFAULT_CATEGORY_ICON,
      });
      setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
    },
    [],
  );

  const removeCategory = useCallback(
    async (id: string) => {
      await apiDeleteCategory(id);

      const nextCategories = categories.filter((c) => c.id !== id);
      const nextOrder = orderedIds.filter((categoryId) => categoryId !== id);

      setOrderedIds(nextOrder);
      setCategories(orderCategories(nextCategories, nextOrder));
      await persistOrder(nextOrder);
    },
    [categories, orderedIds, persistOrder],
  );

  const setCategoryOrder = useCallback(
    async (nextOrderInput: string[]) => {
      const nextOrder = normalizeOrder(categories, nextOrderInput);
      setOrderedIds(nextOrder);
      setCategories((prev) => orderCategories(prev, nextOrder));
      await persistOrder(nextOrder);
    },
    [categories, persistOrder],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<CategoriesContextValue>(
    () => ({
      categories,
      loading,
      refresh,
      addCategory,
      editCategory,
      removeCategory,
      setCategoryOrder,
    }),
    [addCategory, categories, editCategory, loading, refresh, removeCategory, setCategoryOrder],
  );

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

export function useCategories(): CategoriesContextValue {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error("useCategories must be used inside CategoriesProvider");
  return ctx;
}
