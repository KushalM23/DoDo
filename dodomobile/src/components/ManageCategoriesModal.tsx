import React, {useMemo, useState} from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useAlert} from '../state/AlertContext';
import {useCategories} from '../state/CategoriesContext';
import {spacing, radii, fontSize} from '../theme/colors';
import {fonts} from '../theme/fonts';
import {type ThemeColors, useThemeColors} from '../theme/ThemeProvider';
import {
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_ICON_OPTIONS,
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
  type Category,
  type CategoryIcon,
} from '../types/category';
import {AppIcon} from './AppIcon';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ManageCategoriesModal({visible, onClose}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {showAlert} = useAlert();
  const {
    categories,
    addCategory,
    editCategory,
    removeCategory,
    setCategoryOrder,
  } = useCategories();
  
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  // Add State
  const [addInputValue, setAddInputValue] = useState('');
  const [addColor, setAddColor] = useState<string>(DEFAULT_CATEGORY_COLOR);
  const [addIcon, setAddIcon] = useState<CategoryIcon>(DEFAULT_CATEGORY_ICON);
  
  // Edit State
  const [editInputValue, setEditInputValue] = useState('');
  const [editColor, setEditColor] = useState<string>(DEFAULT_CATEGORY_COLOR);
  const [editIcon, setEditIcon] = useState<CategoryIcon>(DEFAULT_CATEGORY_ICON);
  
  const [busy, setBusy] = useState(false);

  const orderedIds = useMemo(
    () => categories.map(category => category.id),
    [categories],
  );

  function handleAdd() {
    setAddInputValue('');
    setAddColor(DEFAULT_CATEGORY_COLOR);
    setAddIcon(DEFAULT_CATEGORY_ICON);
    setAddModalVisible(true);
  }

  async function handleAddSubmit() {
    const name = addInputValue.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await addCategory({name, color: addColor, icon: addIcon});
      setAddModalVisible(false);
    } catch (err) {
      showAlert(
        'Error',
        err instanceof Error ? err.message : 'Failed to add category',
      );
    } finally {
      setBusy(false);
    }
  }

  function openEditModal(category: Category) {
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
      await editCategory(editingCategory.id, {
        name,
        color: editColor,
        icon: editIcon,
      });
      setEditModalVisible(false);
      setEditingCategory(null);
    } catch (err) {
      showAlert(
        'Error',
        err instanceof Error ? err.message : 'Failed to update category',
      );
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
          void (async () => {
            try {
              await removeCategory(category.id);
            } catch (err) {
              showAlert(
                'Error',
                err instanceof Error
                  ? err.message
                  : 'Failed to delete category',
              );
            }
          })();
        },
      },
    ]);
  }

  async function moveCategory(categoryId: string, direction: -1 | 1) {
    const fromIndex = orderedIds.findIndex(id => id === categoryId);
    if (fromIndex < 0) return;
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= orderedIds.length) return;

    const nextOrder = [...orderedIds];
    [nextOrder[fromIndex], nextOrder[toIndex]] = [
      nextOrder[toIndex],
      nextOrder[fromIndex],
    ];

    try {
      await setCategoryOrder(nextOrder);
    } catch (err) {
      showAlert(
        'Error',
        err instanceof Error ? err.message : 'Failed to reorder categories',
      );
    }
  }

  return (
    <>
      {/* Manage Categories Base Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={visible && !addModalVisible && !editModalVisible}
        onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.manageHeader}>
              <Text style={styles.modalTitle}>Categories</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <AppIcon name="x" size={22} color={colors.mutedText} />
              </Pressable>
            </View>

            <ScrollView style={{maxHeight: 400}} showsVerticalScrollIndicator={false}>
              {categories.length === 0 ? (
                <Text style={styles.emptyText}>No categories yet.</Text>
              ) : (
                categories.map((category, index) => (
                  <View key={category.id} style={styles.manageRow}>
                    <View style={styles.manageLabelWrap}>
                      <AppIcon
                        name={category.icon as any}
                        size={14}
                        color={category.color}
                      />
                      <Text style={styles.manageName} numberOfLines={1}>
                        {category.name}
                      </Text>
                    </View>
                    <Pressable
                      style={[
                        styles.iconBtn,
                        index === 0 && styles.iconBtnDisabled,
                      ]}
                      disabled={index === 0}
                      onPress={() => void moveCategory(category.id, -1)}>
                      <AppIcon
                        name="arrow-up"
                        size={14}
                        color={index === 0 ? colors.border : colors.text}
                      />
                    </Pressable>
                    <Pressable
                      style={[
                        styles.iconBtn,
                        index === categories.length - 1 && styles.iconBtnDisabled,
                      ]}
                      disabled={index === categories.length - 1}
                      onPress={() => void moveCategory(category.id, 1)}>
                      <AppIcon
                        name="arrow-down"
                        size={14}
                        color={
                          index === categories.length - 1
                            ? colors.border
                            : colors.text
                        }
                      />
                    </Pressable>
                    <Pressable
                      style={styles.iconBtn}
                      onPress={() => openEditModal(category)}>
                      <AppIcon name="edit" size={14} color={colors.mutedText} />
                    </Pressable>
                    <Pressable
                      style={styles.iconBtn}
                      onPress={() => handleDelete(category)}>
                      <AppIcon name="trash-2" size={14} color={colors.danger} />
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
            
            <Pressable
              style={styles.addButton}
              onPress={handleAdd}>
              <AppIcon name="plus" size={16} color="#fff" />
              <Text style={styles.addButtonText}>Add Category</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Add New Category Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={addModalVisible}
        onRequestClose={() => setAddModalVisible(false)}>
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
              {CATEGORY_COLOR_OPTIONS.map(option => {
                const active = addColor === option;
                return (
                  <Pressable
                    key={option}
                    style={[
                      styles.colorOption,
                      {backgroundColor: option},
                    ]}
                    onPress={() => setAddColor(option)}>
                    {active ? (
                      <AppIcon name="check" size={13} color="#fff" />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Icon</Text>
            <View style={styles.optionGrid}>
              {CATEGORY_ICON_OPTIONS.map(option => {
                const active = addIcon === option;
                return (
                  <Pressable
                    key={option}
                    style={[styles.iconOption]}
                    onPress={() => setAddIcon(option)}>
                    <AppIcon
                      name={option as any}
                      size={24}
                      color={active ? colors.accent : colors.text}
                    />
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => setAddModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSubmit, busy && styles.disabled]}
                onPress={handleAddSubmit}
                disabled={busy}>
                <Text style={styles.modalSubmitText}>
                  {busy ? 'Saving...' : 'Add'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Category Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}>
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
              {CATEGORY_COLOR_OPTIONS.map(option => {
                const active = editColor === option;
                return (
                  <Pressable
                    key={option}
                    style={[
                      styles.colorOption,
                      {backgroundColor: option}
                    ]}
                    onPress={() => setEditColor(option)}>
                    {active ? (
                      <AppIcon name="check" size={13} color="#fff" />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Icon</Text>
            <View style={styles.optionGrid}>
              {CATEGORY_ICON_OPTIONS.map(option => {
                const active = editIcon === option;
                return (
                  <Pressable
                    key={option}
                    style={[styles.iconOption]}
                    onPress={() => setEditIcon(option)}>
                    <AppIcon
                      name={option as any}
                      size={24}
                      color={active ? colors.accent : colors.text}
                    />
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSubmit, busy && styles.disabled]}
                onPress={handleEditSubmit}
                disabled={busy}>
                <Text style={styles.modalSubmitText}>
                  {busy ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.sm,
    },
    modal: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      paddingVertical: spacing.xl,
      paddingHorizontal: 36,
      width: '100%',
      maxWidth: 380,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      shadowColor: colors.shadow,
      shadowOffset: {width: 0, height: 16},
      shadowOpacity: 1,
      shadowRadius: 32,
      elevation: 16,
    },
    modalTitle: {
      color: colors.text,
      fontFamily: fonts.heading,
      fontSize: fontSize.xl,
      letterSpacing: -0.5,
      marginBottom: 16,
      fontWeight: '700',
    },
    modalInput: {
      backgroundColor: colors.surfaceLight,
      borderRadius: 50,
      paddingHorizontal: spacing.xxl,
      paddingVertical: spacing.md,
      color: colors.text,
      borderWidth: 1.5,
      borderColor: colors.border,
      marginBottom: spacing.sm,
      fontSize: fontSize.md,
    },
    fieldLabel: {
      color: colors.mutedText,
      fontSize: fontSize.xs,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 8,
      marginTop: 8,
    },
    optionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: spacing.md,
    },
    colorOption: {
      width: 40,
      height: 40,
      borderRadius: 50,
      borderWidth: 2.5,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconOption: {
      width: 40,
      height: 40,
      borderRadius: 50,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'flex-end',
      marginTop: spacing.md,
    },
    modalCancel: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 60,
      backgroundColor: colors.surfaceLight,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalCancelText: {
      color: colors.mutedText,
      fontWeight: '600',
    },
    modalSubmit: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 60,
      backgroundColor: colors.accent,
      shadowColor: colors.accent,
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    modalSubmitText: {
      color: '#fff',
      fontWeight: '700',
    },
    disabled: {
      opacity: 0.6,
    },
    manageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    manageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 60,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      marginBottom: 8,
      backgroundColor: colors.surfaceLight,
    },
    manageLabelWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    manageName: {
      flex: 1,
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 50,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBtnDisabled: {
      opacity: 0.35,
    },
    emptyText: {
      color: colors.mutedText,
      fontSize: fontSize.md,
      textAlign: 'center',
      paddingVertical: spacing.xl,
    },
    addButton: {
      marginTop: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.accent,
      paddingVertical: 14,
      borderRadius: 50,
    },
    addButtonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: fontSize.md,
    },
  });
