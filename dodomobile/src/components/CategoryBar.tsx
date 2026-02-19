import React, { useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useCategories } from "../state/CategoriesContext";
import { colors, spacing, radii, fontSize } from "../theme/colors";
import type { Category } from "../types/category";
import { AppIcon } from "./AppIcon";

type Props = {
  selected: string | null;
  onSelect: (categoryId: string | null) => void;
};

export function CategoryBar({ selected, onSelect }: Props) {
  const { categories, addCategory, editCategory, removeCategory, setCategoryOrder } = useCategories();
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [manageModalVisible, setManageModalVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [addInputValue, setAddInputValue] = useState("");
  const [renameInputValue, setRenameInputValue] = useState("");
  const [busy, setBusy] = useState(false);

  const orderedIds = useMemo(() => categories.map((category) => category.id), [categories]);

  function handleAdd() {
    setAddInputValue("");
    setAddModalVisible(true);
  }

  async function handleAddSubmit() {
    const name = addInputValue.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await addCategory({ name });
      setAddModalVisible(false);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to add category");
    } finally {
      setBusy(false);
    }
  }

  function openRenameModal(category: Category) {
    setManageModalVisible(false);
    setEditingCategory(category);
    setRenameInputValue(category.name);
    setRenameModalVisible(true);
  }

  async function handleRenameSubmit() {
    if (!editingCategory || busy) return;
    const name = renameInputValue.trim();
    if (!name) return;

    setBusy(true);
    try {
      await editCategory(editingCategory.id, { name });
      setRenameModalVisible(false);
      setEditingCategory(null);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to update category");
    } finally {
      setBusy(false);
    }
  }

  function handleDelete(category: Category) {
    Alert.alert("Delete category?", `Delete "${category.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await removeCategory(category.id);
              if (selected === category.id) {
                onSelect(null);
              }
            } catch (err) {
              Alert.alert("Error", err instanceof Error ? err.message : "Failed to delete category");
            }
          })();
        },
      },
    ]);
  }

  async function moveCategory(categoryId: string, direction: -1 | 1) {
    const fromIndex = orderedIds.findIndex((id) => id === categoryId);
    if (fromIndex < 0) return;
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= orderedIds.length) return;

    const nextOrder = [...orderedIds];
    [nextOrder[fromIndex], nextOrder[toIndex]] = [nextOrder[toIndex], nextOrder[fromIndex]];

    try {
      await setCategoryOrder(nextOrder);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to reorder categories");
    }
  }

  const isOverview = selected === null;

  return (
    <View>
      <View style={styles.outerRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent} style={styles.scrollView}>
          <Pressable style={[styles.chip, isOverview && styles.chipActive]} onPress={() => onSelect(null)}>
            <Text style={[styles.chipText, isOverview && styles.chipTextActive]}>Overview</Text>
          </Pressable>

          {categories.map((cat) => {
            const active = selected === cat.id;
            return (
              <Pressable key={cat.id} style={[styles.chip, active && styles.chipActive]} onPress={() => onSelect(cat.id)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.stickyButtons}>
          <Pressable style={styles.iconButton} onPress={handleAdd}>
            <AppIcon name="plus" size={16} color={colors.accent} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => setManageModalVisible(true)}>
            <AppIcon name="edit" size={16} color={colors.accent} />
          </Pressable>
        </View>
      </View>

      <Modal transparent animationType="fade" visible={addModalVisible} onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New Category</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Category name"
              placeholderTextColor={colors.mutedText}
              value={addInputValue}
              onChangeText={setAddInputValue}
              autoFocus
              onSubmitEditing={handleAddSubmit}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setAddModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalSubmit, busy && styles.disabled]} onPress={handleAddSubmit} disabled={busy}>
                <Text style={styles.modalSubmitText}>{busy ? "Saving..." : "Add"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={manageModalVisible}
        onRequestClose={() => setManageModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.manageHeader}>
              <Text style={styles.modalTitle}>Edit Categories</Text>
              <Pressable onPress={() => setManageModalVisible(false)} hitSlop={8}>
                <AppIcon name="x" size={18} color={colors.mutedText} />
              </Pressable>
            </View>

            {categories.length === 0 ? (
              <Text style={styles.emptyText}>No categories yet.</Text>
            ) : (
              categories.map((category, index) => (
                <View key={category.id} style={styles.manageRow}>
                  <Text style={styles.manageName} numberOfLines={1}>
                    {category.name}
                  </Text>
                  <Pressable
                    style={[styles.iconBtn, index === 0 && styles.iconBtnDisabled]}
                    disabled={index === 0}
                    onPress={() => void moveCategory(category.id, -1)}
                  >
                    <AppIcon name="arrow-up" size={14} color={index === 0 ? colors.border : colors.text} />
                  </Pressable>
                  <Pressable
                    style={[styles.iconBtn, index === categories.length - 1 && styles.iconBtnDisabled]}
                    disabled={index === categories.length - 1}
                    onPress={() => void moveCategory(category.id, 1)}
                  >
                    <AppIcon
                      name="arrow-down"
                      size={14}
                      color={index === categories.length - 1 ? colors.border : colors.text}
                    />
                  </Pressable>
                  <Pressable style={styles.iconBtn} onPress={() => openRenameModal(category)}>
                    <AppIcon name="edit" size={14} color={colors.mutedText} />
                  </Pressable>
                  <Pressable style={styles.iconBtn} onPress={() => handleDelete(category)}>
                    <AppIcon name="trash-2" size={14} color={colors.danger} />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={renameModalVisible}
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Rename Category</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Category name"
              placeholderTextColor={colors.mutedText}
              value={renameInputValue}
              onChangeText={setRenameInputValue}
              autoFocus
              onSubmitEditing={handleRenameSubmit}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setRenameModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSubmit, busy && styles.disabled]}
                onPress={handleRenameSubmit}
                disabled={busy}
              >
                <Text style={styles.modalSubmitText}>{busy ? "Saving..." : "Save"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
  },
  stickyButtons: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingRight: spacing.lg,
    paddingLeft: spacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.mutedText,
    fontWeight: "600",
    fontSize: fontSize.sm,
  },
  chipTextActive: {
    color: colors.accent,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxl,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: "700",
    marginBottom: 14,
  },
  modalInput: {
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    fontSize: fontSize.md,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  modalCancel: {
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLight,
  },
  modalCancelText: {
    color: colors.mutedText,
    fontWeight: "600",
  },
  modalSubmit: {
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
  },
  modalSubmitText: {
    color: "#fff",
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.6,
  },
  manageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  manageHint: {
    color: colors.mutedText,
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  manageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceLight,
  },
  manageName: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconBtnDisabled: {
    opacity: 0.45,
  },
  textBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  textBtnLabel: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: fontSize.xs,
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: fontSize.sm,
  },
});
