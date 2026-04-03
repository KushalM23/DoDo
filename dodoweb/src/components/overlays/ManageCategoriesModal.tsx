"use client";

import {useEffect, useRef, useState} from 'react';
import {AppIcon} from '@/components/common/AppIcon';
import {cx} from '@/lib/tw';
import {useAlert} from '@/providers/AlertContext';
import {useCategories} from '@/providers/CategoriesContext';
import {
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_ICON_OPTIONS,
  CreateCategoryInput,
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
  type Category,
  type CategoryIcon,
} from '@/types/category';

type ManageCategoriesModalProps = {
  open: boolean;
  onClose: () => void;
};

function reorderCategories(list: Category[], fromId: string, toId: string): Category[] {
  const fromIndex = list.findIndex(item => item.id === fromId);
  const toIndex = list.findIndex(item => item.id === toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return list;
  }

  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function CategoriesManager({open, onClose}: ManageCategoriesModalProps) {
  const {showAlert} = useAlert();
  const {categories, addCategory, editCategory, removeCategory, setCategoryOrder} =
    useCategories();

  const [isEditingFormVisible, setIsEditingFormVisible] = useState(false);
  const [draft, setDraft] = useState('');
  const [color, setColor] = useState<string>(DEFAULT_CATEGORY_COLOR);
  const [icon, setIcon] = useState<CategoryIcon>(DEFAULT_CATEGORY_ICON);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [orderedCategories, setOrderedCategories] = useState<Category[]>(categories);
  const orderedRef = useRef<Category[]>(categories);

  useEffect(() => {
    if (!open) {
      return;
    }
    setOrderedCategories(categories);
    orderedRef.current = categories;
  }, [categories, open]);

  useEffect(() => {
    orderedRef.current = orderedCategories;
  }, [orderedCategories]);

  function resetForm() {
    setDraft('');
    setColor(DEFAULT_CATEGORY_COLOR);
    setIcon(DEFAULT_CATEGORY_ICON);
    setEditingId(null);
    setIsEditingFormVisible(false);
  }

  function openCreate() {
    resetForm();
    setIsEditingFormVisible(true);
  }

  function openEdit(category: Category) {
    setEditingId(category.id);
    setDraft(category.name);
    setColor(category.color);
    setIcon(category.icon);
    setIsEditingFormVisible(true);
  }

  async function saveCategory() {
    const input: CreateCategoryInput = {
      name: draft.trim(),
      color,
      icon,
    };

    if (!input.name || busy) {
      return;
    }

    setBusy(true);
    try {
      if (editingId) {
        await editCategory(editingId, input);
      } else {
        await addCategory(input);
      }
      resetForm();
    } catch (error) {
      showAlert('Error', error instanceof Error ? error.message : 'Failed to save category');
    } finally {
      setBusy(false);
    }
  }

  function handleDelete(category: Category) {
    showAlert('Delete category?', `Delete "${category.name}"?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void removeCategory(category.id);
        },
      },
    ]);
  }

  function commitOrder() {
    const order = orderedRef.current.map(category => category.id);
    void setCategoryOrder(order).catch(error => {
      showAlert('Error', error instanceof Error ? error.message : 'Failed to reorder categories');
      setOrderedCategories(categories);
      orderedRef.current = categories;
    });
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button type="button" className="absolute inset-0 bg-black/90" onClick={onClose} />

      <div className="relative w-full max-w-[420px] rounded-3xl bg-surface px-6 py-6 shadow-2xl">
        {!isEditingFormVisible ? (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-heading text-[30px] tracking-[-0.5px] text-text">Categories</h2>
              <button
                type="button"
                className="inline-grid h-10 w-10 place-items-center rounded-full text-muted-text"
                onClick={onClose}
              >
                <AppIcon name="x" size={22} />
              </button>
            </div>

            <div className="max-h-[400px] overflow-y-auto pb-2">
              {orderedCategories.length === 0 ? (
                <p className="py-6 text-center font-sans-medium text-base text-muted-text">
                  No categories yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {orderedCategories.map(category => (
                    <div
                      key={category.id}
                      draggable
                      onDragStart={() => setDraggingId(category.id)}
                      onDragOver={event => {
                        event.preventDefault();
                        if (!draggingId || draggingId === category.id) {
                          return;
                        }
                        setOrderedCategories(prev => reorderCategories(prev, draggingId, category.id));
                      }}
                      onDragEnd={() => {
                        if (draggingId) {
                          setDraggingId(null);
                          commitOrder();
                        }
                      }}
                      className={cx(
                        'flex h-[57px] items-center gap-2 rounded-full bg-surface-light px-4',
                        draggingId === category.id && 'ring-2 ring-accent',
                      )}
                    >
                      <span className="inline-grid h-8 w-8 place-items-center text-muted-text">
                        <AppIcon name="grip-vertical" size={16} />
                      </span>

                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <AppIcon name={category.icon as any} size={14} color={category.color} />
                        <span className="truncate font-sans-medium text-base text-text">{category.name}</span>
                      </div>

                      <button
                        type="button"
                        className="inline-grid h-9 w-9 place-items-center rounded-full text-muted-text"
                        onClick={() => openEdit(category)}
                      >
                        <AppIcon name="edit" size={14} />
                      </button>
                      <button
                        type="button"
                        className="inline-grid h-9 w-9 place-items-center rounded-full text-danger"
                        onClick={() => handleDelete(category)}
                      >
                        <AppIcon name="trash-2" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3.5"
              onClick={openCreate}
            >
              <AppIcon name="plus" size={16} color="#fff" />
              <span className="font-sans-bold text-base text-white">Add Category</span>
            </button>
          </>
        ) : (
          <>
            <h2 className="mb-4 font-heading text-[30px] tracking-[-0.5px] text-text">
              {editingId ? 'Edit Category' : 'New Category'}
            </h2>

            <input
              className="mb-3 h-12.5 w-full rounded-full bg-surface-light px-6 font-sans-bold text-lg text-text outline-none placeholder:text-muted-text"
              value={draft}
              onChange={event => setDraft(event.target.value)}
              placeholder="Category name"
              autoFocus
            />

            <label className="mb-2 block text-xs uppercase tracking-[1px] text-muted-text">Color</label>
            <div className="mb-3 flex flex-wrap gap-2.5">
              {CATEGORY_COLOR_OPTIONS.map(option => {
                const active = color === option;
                return (
                  <button
                    key={option}
                    type="button"
                    className="inline-grid h-10 w-10 place-items-center rounded-full"
                    style={{backgroundColor: option}}
                    onClick={() => setColor(option)}
                  >
                    {active ? <AppIcon name="check" size={16} color="#fff" /> : null}
                  </button>
                );
              })}
            </div>

            <label className="mb-2 block text-xs uppercase tracking-[1px] text-muted-text">Icon</label>
            <div className="mb-4 flex flex-wrap gap-2.5">
              {CATEGORY_ICON_OPTIONS.map(option => {
                const active = icon === option;
                return (
                  <button
                    key={option}
                    type="button"
                    className={cx(
                      'inline-grid h-10 w-10 place-items-center rounded-full bg-surface-light',
                      active && 'ring-2 ring-accent',
                    )}
                    onClick={() => setIcon(option as CategoryIcon)}
                  >
                    <AppIcon
                      name={option as any}
                      size={20}
                      color={active ? 'var(--accent)' : 'var(--text)'}
                    />
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-full bg-surface-light px-5 py-2.5 font-sans-bold text-muted-text"
                onClick={() => setIsEditingFormVisible(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-accent px-5 py-2.5 font-sans-bold text-white disabled:opacity-60"
                onClick={() => {
                  void saveCategory();
                }}
                disabled={busy}
              >
                {busy ? 'Saving...' : editingId ? 'Save' : 'Add'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
