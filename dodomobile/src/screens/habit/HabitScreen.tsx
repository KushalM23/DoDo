import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Feather";
import { useHabits } from "../../state/HabitsContext";
import { colors, spacing, radii, fontSize } from "../../theme/colors";
import type { HabitFrequency } from "../../types/habit";

export function HabitScreen() {
  const { habits, loading, addHabit, removeHabit } = useHabits();
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState<HabitFrequency>("daily");
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await addHabit({ title: title.trim(), frequency });
      setTitle("");
      setFrequency("daily");
      setModalVisible(false);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to create habit");
    } finally {
      setBusy(false);
    }
  }

  function handleDelete(id: string) {
    removeHabit(id).catch((err) => {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to delete habit");
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.appName}>Dodo</Text>
        <Text style={styles.pageName}>Habits</Text>
      </View>

      <FlatList
        data={habits}
        keyExtractor={(item) => item.id}
        contentContainerStyle={habits.length === 0 ? styles.emptyContainer : styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardIcon}>
              <Icon name="repeat" size={18} color={colors.habitBadge} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.habitTitle}>{item.title}</Text>
              <View style={styles.freqBadge}>
                <Text style={styles.freqText}>{item.frequency}</Text>
              </View>
            </View>
            <Pressable style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
              <Icon name="trash-2" size={16} color={colors.danger} />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="repeat" size={40} color={colors.mutedText} />
            <Text style={styles.emptyTitle}>No habits yet</Text>
            <Text style={styles.emptyText}>Create your first habit to start tracking.</Text>
          </View>
        }
      />

      <Pressable style={styles.fab} onPress={() => setModalVisible(true)}>
        <Icon name="plus" size={18} color="#fff" />
        <Text style={styles.fabText}>New Habit</Text>
      </Pressable>

      {/* Create Habit Modal */}
      <Modal transparent animationType="fade" visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Habit</Text>
              <Pressable onPress={() => setModalVisible(false)} hitSlop={12}>
                <Icon name="x" size={22} color={colors.mutedText} />
              </Pressable>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Habit name"
              placeholderTextColor={colors.mutedText}
              value={title}
              onChangeText={setTitle}
              autoFocus
            />

            <Text style={styles.label}>Frequency</Text>
            <View style={styles.freqRow}>
              {(["daily", "weekly"] as HabitFrequency[]).map((f) => (
                <Pressable
                  key={f}
                  style={[styles.freqOption, frequency === f && styles.freqOptionActive]}
                  onPress={() => setFrequency(f)}
                >
                  <Icon
                    name={f === "daily" ? "sun" : "calendar"}
                    size={14}
                    color={frequency === f ? colors.accent : colors.mutedText}
                  />
                  <Text style={[styles.freqOptionText, frequency === f && styles.freqOptionTextActive]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[styles.submitBtn, (busy || !title.trim()) && styles.disabled]}
              onPress={handleCreate}
              disabled={busy || !title.trim()}
            >
              <Icon name="plus" size={18} color="#fff" />
              <Text style={styles.submitBtnText}>{busy ? "Saving..." : "Create"}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: 14,
    paddingBottom: 10,
  },
  appName: {
    fontSize: fontSize.xxl,
    fontWeight: "800",
    color: colors.accent,
  },
  pageName: {
    fontSize: fontSize.lg,
    color: colors.mutedText,
    marginTop: 2,
  },
  list: {
    paddingHorizontal: 14,
    paddingTop: spacing.sm,
    paddingBottom: 80,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: spacing.sm,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.habitBadgeLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  cardContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  habitTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: "600",
    flex: 1,
  },
  freqBadge: {
    backgroundColor: colors.accentLight,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: spacing.xs,
  },
  freqText: {
    color: colors.accent,
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  deleteBtn: {
    marginLeft: 10,
    padding: 6,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.text,
  },
  emptyText: {
    color: colors.mutedText,
    textAlign: "center",
    fontSize: fontSize.sm,
  },
  fab: {
    position: "absolute",
    bottom: 20,
    right: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    elevation: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  fabText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: fontSize.sm,
  },
  // Modal
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
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  modalTitle: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: "700",
  },
  input: {
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.sm,
    padding: spacing.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    fontSize: fontSize.md,
  },
  label: {
    color: colors.mutedText,
    fontWeight: "600",
    fontSize: fontSize.xs,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  freqRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  freqOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  freqOptionActive: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accent,
  },
  freqOptionText: {
    color: colors.mutedText,
    fontWeight: "600",
    fontSize: fontSize.sm,
  },
  freqOptionTextActive: {
    color: colors.accent,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
  },
  submitBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: fontSize.md,
  },
  disabled: {
    opacity: 0.5,
  },
});
