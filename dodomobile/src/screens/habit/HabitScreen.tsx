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
import { useHabits } from "../../state/HabitsContext";
import { colors } from "../../theme/colors";
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

  async function handleDelete(id: string) {
    try {
      await removeHabit(id);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to delete habit");
    }
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
            <View style={styles.cardContent}>
              <Text style={styles.habitTitle}>{item.title}</Text>
              <View style={styles.freqBadge}>
                <Text style={styles.freqText}>{item.frequency}</Text>
              </View>
            </View>
            <Pressable style={styles.deleteBtn} onPress={() => void handleDelete(item.id)}>
              <Text style={styles.deleteBtnText}>✕</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No habits yet</Text>
            <Text style={styles.emptyText}>Create your first habit to start tracking.</Text>
          </View>
        }
      />

      <Pressable style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+ New Habit</Text>
      </Pressable>

      {/* Create Habit Modal */}
      <Modal transparent animationType="fade" visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New Habit</Text>

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
                  <Text style={[styles.freqOptionText, frequency === f && styles.freqOptionTextActive]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.submitBtn, (busy || !title.trim()) && styles.disabled]}
                onPress={handleCreate}
                disabled={busy || !title.trim()}
              >
                <Text style={styles.submitBtnText}>{busy ? "Saving..." : "Create"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
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
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  appName: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.accent,
  },
  pageName: {
    fontSize: 16,
    color: colors.mutedText,
    marginTop: 2,
  },
  list: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 80,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 8,
  },
  cardContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  habitTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  freqBadge: {
    backgroundColor: colors.accentLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  freqText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "600",
  },
  deleteBtn: {
    marginLeft: 10,
    padding: 6,
  },
  deleteBtnText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: "700",
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  emptyText: {
    color: colors.mutedText,
    marginTop: 6,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    bottom: 20,
    right: 16,
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    elevation: 4,
  },
  fabText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  // Modal
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 360,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
  },
  input: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 10,
    padding: 12,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  label: {
    color: colors.mutedText,
    fontWeight: "600",
    fontSize: 13,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  freqRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  freqOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  freqOptionActive: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accent,
  },
  freqOptionText: {
    color: colors.mutedText,
    fontWeight: "600",
  },
  freqOptionTextActive: {
    color: colors.accent,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
  },
  cancelBtnText: {
    color: colors.mutedText,
    fontWeight: "700",
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: "center",
  },
  submitBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.5,
  },
});
