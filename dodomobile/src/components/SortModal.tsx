import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";
import type { SortMode } from "../utils/taskSort";

type Props = {
  visible: boolean;
  current: SortMode;
  onSelect: (mode: SortMode) => void;
  onClose: () => void;
};

const OPTIONS: { mode: SortMode; label: string }[] = [
  { mode: "smart", label: "Smart (Default)" },
  { mode: "priority_desc", label: "Priority: High → Low" },
  { mode: "priority_asc", label: "Priority: Low → High" },
  { mode: "time_asc", label: "Time: Earliest First" },
  { mode: "time_desc", label: "Time: Latest First" },
];

export function SortModal({ visible, current, onSelect, onClose }: Props) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Sort Tasks</Text>
          {OPTIONS.map(({ mode, label }) => (
            <Pressable
              key={mode}
              style={[styles.option, current === mode && styles.optionActive]}
              onPress={() => {
                onSelect(mode);
                onClose();
              }}
            >
              <Text style={[styles.optionText, current === mode && styles.optionTextActive]}>
                {label}
              </Text>
              {current === mode && <Text style={styles.check}>✓</Text>}
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  optionActive: {
    backgroundColor: colors.accentLight,
  },
  optionText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: "500",
  },
  optionTextActive: {
    color: colors.accent,
    fontWeight: "700",
  },
  check: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "700",
  },
});
