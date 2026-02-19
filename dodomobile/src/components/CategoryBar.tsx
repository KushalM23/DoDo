import React, { useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Icon from "react-native-vector-icons/Feather";
import { useCategories } from "../state/CategoriesContext";
import { colors, spacing, radii, fontSize } from "../theme/colors";
import type { Category } from "../types/category";

type Props = {
  selected: string | null; // null = Overview
  onSelect: (categoryId: string | null) => void;
};

export function CategoryBar({ selected, onSelect }: Props) {
  const { categories, addCategory, editCategory, removeCategory } = useCategories();
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [inputValue, setInputValue] = useState("");

  function handleAdd() {
    setInputValue("");
    setAddModalVisible(true);
  }

  async function handleAddSubmit() {
    const name = inputValue.trim();
    if (!name) return;
    try {
      await addCategory({ name });
      setAddModalVisible(false);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to add category");
    }
  }

  function handleLongPress(cat: Category) {
    setEditingCategory(cat);
    setInputValue(cat.name);
    setEditModalVisible(true);
  }

  async function handleEditSubmit() {
    if (!editingCategory) return;
    const name = inputValue.trim();
    if (!name) return;
    try {
      await editCategory(editingCategory.id, { name });
      setEditModalVisible(false);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to update category");
    }
  }

  async function handleDelete() {
    if (!editingCategory) return;
    try {
      await removeCategory(editingCategory.id);
      if (selected === editingCategory.id) onSelect(null);
      setEditModalVisible(false);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to delete category");
    }
  }

  const isOverview = selected === null;

  return (
    <View style={styles.wrapper}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
        <Pressable
          style={[styles.chip, isOverview && styles.chipActive]}
          onPress={() => onSelect(null)}
        >
          <Text style={[styles.chipText, isOverview && styles.chipTextActive]}>Overview</Text>
        </Pressable>

        {categories.map((cat) => {
          const active = selected === cat.id;
          return (
            <Pressable
              key={cat.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onSelect(cat.id)}
              onLongPress={() => handleLongPress(cat)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat.name}</Text>
            </Pressable>
          );
        })}

        <Pressable style={styles.addChip} onPress={handleAdd}>
          <Icon name="plus" size={16} color={colors.accent} />
        </Pressable>
      </ScrollView>

      {/* Add Category Modal */}
      <Modal transparent animationType="fade" visible={addModalVisible} onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New Category</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Category name"
              placeholderTextColor={colors.mutedText}
              value={inputValue}
              onChangeText={setInputValue}
              autoFocus
              onSubmitEditing={handleAddSubmit}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setAddModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSubmit} onPress={handleAddSubmit}>
                <Text style={styles.modalSubmitText}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Category Modal */}
      <Modal transparent animationType="fade" visible={editModalVisible} onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Edit Category</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Category name"
              placeholderTextColor={colors.mutedText}
              value={inputValue}
              onChangeText={setInputValue}
              autoFocus
              onSubmitEditing={handleEditSubmit}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalDelete} onPress={handleDelete}>
                <Text style={styles.modalDeleteText}>Delete</Text>
              </Pressable>
              <Pressable style={styles.modalCancel} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSubmit} onPress={handleEditSubmit}>
                <Text style={styles.modalSubmitText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
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
  addChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
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
    maxWidth: 340,
  },
  modalTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: "700",
    marginBottom: 14,
  },
  modalInput: {
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.sm,
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
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLight,
  },
  modalCancelText: {
    color: colors.mutedText,
    fontWeight: "600",
  },
  modalSubmit: {
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
  },
  modalSubmitText: {
    color: "#fff",
    fontWeight: "700",
  },
  modalDelete: {
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    backgroundColor: colors.dangerLight,
    marginRight: "auto",
  },
  modalDeleteText: {
    color: colors.danger,
    fontWeight: "700",
  },
});
