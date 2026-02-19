import React, { useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useCategories } from "../state/CategoriesContext";
import { colors, spacing, radii, fontSize } from "../theme/colors";
import {
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_ICON_OPTIONS,
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
  type Category,
  type CategoryIcon,
} from "../types/category";
import { AppIcon } from "./AppIcon";

type Props = {
  selected: string | null;
  onSelect: (categoryId: string | null) => void;
};

export function CategoryBar({ selected, onSelect }: Props) {
  const { categories, addCategory, editCategory, removeCategory, setCategoryOrder } = useCategories();
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [manageModalVisible, setManageModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [addInputValue, setAddInputValue] = useState("");
  const [addColor, setAddColor] = useState<string>(DEFAULT_CATEGORY_COLOR);
  const [addIcon, setAddIcon] = useState<CategoryIcon>(DEFAULT_CATEGORY_ICON);
  const [editInputValue, setEditInputValue] = useState("");
  const [editColor, setEditColor] = useState<string>(DEFAULT_CATEGORY_COLOR);
  const [editIcon, setEditIcon] = useState<CategoryIcon>(DEFAULT_CATEGORY_ICON);
  const [busy, setBusy] = useState(false);

  const orderedIds = useMemo(() => categories.map((category) => category.id), [categories]);

  function handleAdd() {
    setAddInputValue("");
    setAddColor(DEFAULT_CATEGORY_COLOR);
    setAddIcon(DEFAULT_CATEGORY_ICON);
    setAddModalVisible(true);
  }

  async function handleAddSubmit() {
    const name = addInputValue.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await addCategory({ name, color: addColor, icon: addIcon });
      setAddModalVisible(false);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to add category");
    } finally {
      setBusy(false);
    }
  }

  function openEditModal(category: Category) {
    setManageModalVisible(false);
    setEditingCategory(category);
    setEditInputValue(category.name);
    setEditColor(category.color);
    setEditIcon(category.icon);
    setEditModalVisible(true);
  }

  async function handleEditSubmit() {
    if (!editingCategory || busy) return;
    const name = editInputValue.trim();
    if (!name) return;

    setBusy(true);
    try {
      await editCategory(editingCategory.id, { name, color: editColor, icon: editIcon });
      setEditModalVisible(false);
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
                <View style={styles.chipInner}>
                  <AppIcon name={cat.icon} size={12} color={active ? colors.accent : cat.color} />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat.name}</Text>
                </View>
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

            <Text style={styles.fieldLabel}>Color</Text>
            <View style={styles.optionGrid}>
              {CATEGORY_COLOR_OPTIONS.map((option) => {
                const active = addColor === option;
                return (
                  <Pressable
                    key={option}
                    style={[styles.colorOption, { backgroundColor: option }, active && styles.optionActive]}
                    onPress={() => setAddColor(option)}
                  >
                    {active ? <AppIcon name="check" size={13} color="#fff" /> : null}
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Icon</Text>
            <View style={styles.optionGrid}>
              {CATEGORY_ICON_OPTIONS.map((option) => {
                const active = addIcon === option;
                return (
                  <Pressable key={option} style={[styles.iconOption, active && styles.optionActive]} onPress={() => setAddIcon(option)}>
                    <AppIcon name={option} size={16} color={active ? colors.accent : colors.text} />
                  </Pressable>
                );
              })}
            </View>

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
                  <View style={styles.manageLabelWrap}>
                    <View style={[styles.manageColorDot, { backgroundColor: category.color }]} />
                    <AppIcon name={category.icon} size={14} color={category.color} />
                    <Text style={styles.manageName} numberOfLines={1}>
                      {category.name}
                    </Text>
                  </View>
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
                  <Pressable style={styles.iconBtn} onPress={() => openEditModal(category)}>
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
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Edit Category</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Category name"
              placeholderTextColor={colors.mutedText}
              value={editInputValue}
              onChangeText={setEditInputValue}
              autoFocus
              onSubmitEditing={handleEditSubmit}
            />

            <Text style={styles.fieldLabel}>Color</Text>
            <View style={styles.optionGrid}>
              {CATEGORY_COLOR_OPTIONS.map((option) => {
                const active = editColor === option;
                return (
                  <Pressable
                    key={option}
                    style={[styles.colorOption, { backgroundColor: option }, active && styles.optionActive]}
                    onPress={() => setEditColor(option)}
                  >
                    {active ? <AppIcon name="check" size={13} color="#fff" /> : null}
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Icon</Text>
            <View style={styles.optionGrid}>
              {CATEGORY_ICON_OPTIONS.map((option) => {
                const active = editIcon === option;
                return (
                  <Pressable key={option} style={[styles.iconOption, active && styles.optionActive]} onPress={() => setEditIcon(option)}>
                    <AppIcon name={option} size={16} color={active ? colors.accent : colors.text} />
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSubmit, busy && styles.disabled]}
                onPress={handleEditSubmit}
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
  chipInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
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
    marginBottom: spacing.md,
    fontSize: fontSize.md,
  },
  fieldLabel: {
    color: colors.mutedText,
    fontSize: fontSize.xs,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  iconOption: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  optionActive: {
    borderColor: colors.accent,
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
  manageLabelWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  manageColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
  emptyText: {
    color: colors.mutedText,
    fontSize: fontSize.sm,
  },
});
