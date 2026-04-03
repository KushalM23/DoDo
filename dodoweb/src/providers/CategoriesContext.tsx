import React, {
  startTransition,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  createCategoryLocal,
  listCategoriesLocal,
  softDeleteCategoryLocal,
  updateCategoryLocal,
} from '@/lib/local/repository';
import {runSync} from '@/lib/local/syncEngine';
import {subscribeToSyncCompleted} from '@/lib/local/syncEvents';
import {useAuth} from './AuthContext';
import {
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
  normalizeCategoryColor,
  type Category,
  type CreateCategoryInput,
} from '@/types/category';

type CategoriesContextValue = {
  categories: Category[];
  loading: boolean;
  initialized: boolean;
  refresh: () => Promise<void>;
  addCategory: (input: CreateCategoryInput) => Promise<void>;
  editCategory: (id: string, input: CreateCategoryInput) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
  setCategoryOrder: (orderedIds: string[]) => Promise<void>;
};

const CategoriesContext = createContext<CategoriesContextValue | undefined>(
  undefined,
);
const CATEGORY_ORDER_KEY_PREFIX = 'dodo.categoryOrder';

function orderKey(userId: string) {
  return `${CATEGORY_ORDER_KEY_PREFIX}:${userId}`;
}

function orderCategories(categories: Category[], orderedIds: string[]): Category[] {
  const indexMap = new Map<string, number>();
  orderedIds.forEach((id, index) => indexMap.set(id, index));
  return [...categories].sort((a, b) => {
    const aIndex = indexMap.get(a.id);
    const bIndex = indexMap.get(b.id);
    if (aIndex != null && bIndex != null) {
      return aIndex - bIndex;
    }
    if (aIndex != null) {
      return -1;
    }
    if (bIndex != null) {
      return 1;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}

function normalizeOrder(categories: Category[], rawOrder: string[]): string[] {
  const existingIds = new Set(categories.map(category => category.id));
  const nextOrder = rawOrder.filter(id => existingIds.has(id));
  for (const category of categories) {
    if (!nextOrder.includes(category.id)) {
      nextOrder.push(category.id);
    }
  }
  return nextOrder;
}

function buildOrderedCategoryState(categories: Category[], rawOrder: string[]) {
  const nextOrder = normalizeOrder(categories, rawOrder);
  return {
    orderedIds: nextOrder,
    categories: orderCategories(categories, nextOrder),
  };
}

export function CategoriesProvider({children}: {children: React.ReactNode}) {
  const {user} = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);

  const persistOrder = useCallback(
    async (ids: string[]) => {
      if (!user?.id) {
        return;
      }
      localStorage.setItem(orderKey(user.id), JSON.stringify(ids));
    },
    [user?.id],
  );

  const reconcileLocalState = useCallback(
    async (userId: string, preferredOrder?: string[]) => {
      const nextCategories = (await listCategoriesLocal(userId)).map(category => ({
        ...category,
        color: normalizeCategoryColor(category.color),
        icon: category.icon || DEFAULT_CATEGORY_ICON,
      }));

      let storedOrder = preferredOrder ?? [];
      if (!preferredOrder) {
        const storedOrderRaw = localStorage.getItem(orderKey(userId));
        if (storedOrderRaw) {
          try {
            storedOrder = JSON.parse(storedOrderRaw) as string[];
          } catch {
            storedOrder = [];
          }
        }
      }

      const orderedState = buildOrderedCategoryState(nextCategories, storedOrder);
      startTransition(() => {
        setOrderedIds(orderedState.orderedIds);
        setCategories(orderedState.categories);
      });

      if (JSON.stringify(storedOrder) !== JSON.stringify(orderedState.orderedIds)) {
        await persistOrder(orderedState.orderedIds);
      }
    },
    [persistOrder],
  );

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setCategories([]);
      setOrderedIds([]);
      setInitialized(true);
      return;
    }

    setLoading(true);
    try {
      let nextCategories = await listCategoriesLocal(user.id);
      const hadLocalCategories = nextCategories.length > 0;

      if (!hadLocalCategories) {
        const didSync = await runSync(user.id, 'manual');
        if (didSync) {
          nextCategories = await listCategoriesLocal(user.id);
        }
      }

      const storedOrderRaw = localStorage.getItem(orderKey(user.id));
      let storedOrder: string[] = [];
      if (storedOrderRaw) {
        try {
          storedOrder = JSON.parse(storedOrderRaw) as string[];
        } catch {
          storedOrder = [];
        }
      }

      const orderedState = buildOrderedCategoryState(
        nextCategories.map(category => ({
          ...category,
          color: normalizeCategoryColor(category.color),
          icon: category.icon || DEFAULT_CATEGORY_ICON,
        })),
        storedOrder,
      );
      setOrderedIds(orderedState.orderedIds);
      setCategories(orderedState.categories);

      if (
        storedOrderRaw == null ||
        JSON.stringify(storedOrder) !== JSON.stringify(orderedState.orderedIds)
      ) {
        await persistOrder(orderedState.orderedIds);
      }

      if (hadLocalCategories) {
        void runSync(user.id, 'manual').then(async didSync => {
          if (!didSync) {
            return;
          }
          await reconcileLocalState(user.id, orderedState.orderedIds);
        });
      }
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [persistOrder, reconcileLocalState, user?.id]);

  useEffect(() => {
    setInitialized(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    return subscribeToSyncCompleted(user.id, () => {
      void reconcileLocalState(user.id, orderedIds);
    });
  }, [orderedIds, reconcileLocalState, user?.id]);

  const addCategory = useCallback(
    async (input: CreateCategoryInput) => {
      if (!user?.id) {
        return;
      }
      const name = input.name.trim();
      if (!name) {
        throw new Error('Category name cannot be empty.');
      }
      const created = await createCategoryLocal(user.id, {
        name,
        color: normalizeCategoryColor(input.color || DEFAULT_CATEGORY_COLOR),
        icon: input.icon || DEFAULT_CATEGORY_ICON,
      });
      const nextCategories = [...categories, created];
      const orderedState = buildOrderedCategoryState(nextCategories, [...orderedIds, created.id]);
      setOrderedIds(orderedState.orderedIds);
      setCategories(orderedState.categories);
      await persistOrder(orderedState.orderedIds);
      void runSync(user.id, 'manual');
    },
    [categories, orderedIds, persistOrder, user?.id],
  );

  const editCategory = useCallback(
    async (id: string, input: CreateCategoryInput) => {
      if (!user?.id) {
        return;
      }
      const name = input.name.trim();
      if (!name) {
        throw new Error('Category name cannot be empty.');
      }
      const updated = await updateCategoryLocal(user.id, id, {
        name,
        color: normalizeCategoryColor(input.color || DEFAULT_CATEGORY_COLOR),
        icon: input.icon || DEFAULT_CATEGORY_ICON,
      });
      if (!updated) {
        return;
      }
      setCategories(prev => prev.map(category => (category.id === id ? updated : category)));
      void runSync(user.id, 'manual');
    },
    [user?.id],
  );

  const removeCategory = useCallback(
    async (id: string) => {
      if (!user?.id) {
        return;
      }
      await softDeleteCategoryLocal(user.id, id);
      const nextCategories = categories.filter(category => category.id !== id);
      const orderedState = buildOrderedCategoryState(
        nextCategories,
        orderedIds.filter(categoryId => categoryId !== id),
      );
      setOrderedIds(orderedState.orderedIds);
      setCategories(orderedState.categories);
      await persistOrder(orderedState.orderedIds);
      void runSync(user.id, 'manual');
    },
    [categories, orderedIds, persistOrder, user?.id],
  );

  const setCategoryOrder = useCallback(
    async (nextOrderInput: string[]) => {
      const orderedState = buildOrderedCategoryState(categories, nextOrderInput);
      setOrderedIds(orderedState.orderedIds);
      setCategories(orderedState.categories);
      await persistOrder(orderedState.orderedIds);
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
      initialized,
      refresh,
      addCategory,
      editCategory,
      removeCategory,
      setCategoryOrder,
    }),
    [
      addCategory,
      categories,
      editCategory,
      initialized,
      loading,
      refresh,
      removeCategory,
      setCategoryOrder,
    ],
  );

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

export function useCategories(): CategoriesContextValue {
  const context = useContext(CategoriesContext);
  if (!context) {
    throw new Error('useCategories must be used inside CategoriesProvider');
  }
  return context;
}

