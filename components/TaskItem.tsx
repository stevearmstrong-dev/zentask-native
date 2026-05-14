import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Task, Priority } from '../types';
import { Colors, Spacing, Typography, BorderRadius, ComponentTokens, getPriorityColor, getPriorityOverlay } from '../constants/theme';

interface Props {
  task: Task;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (id: number, updates: Partial<Task>) => void;
  onFocus?: (task: Task) => void;
}

// Priority colors moved to theme file

const PRIORITY_LABELS: Priority[] = ['high', 'medium', 'low'];

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(task: Task): boolean {
  if (!task.dueDate || task.completed) return false;
  const [y, m, d] = task.dueDate.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

export default function TaskItem({ task, onToggle, onDelete, onEdit, onFocus }: Props) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [editPriority, setEditPriority] = useState<Priority>(task.priority || 'medium');
  const overdue = isOverdue(task);

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete Task', `Delete "${task.text}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onDelete(task.id as number);
      }},
    ]);
  };

  const handleSave = () => {
    if (editText.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onEdit(task.id as number, { text: editText.trim(), priority: editPriority });
      setEditing(false);
    }
  };

  const handleCancel = () => {
    setEditText(task.text);
    setEditPriority(task.priority || 'medium');
    setEditing(false);
  };

  if (editing) {
    return (
      <View style={styles.editContainer}>
        <TextInput
          style={styles.editInput}
          value={editText}
          onChangeText={setEditText}
          multiline
          autoFocus
        />
        <View style={styles.priorityRow}>
          {PRIORITY_LABELS.map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.priorityChip, editPriority === p && { backgroundColor: getPriorityColor(p) }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setEditPriority(p);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.priorityChipText, editPriority === p && styles.priorityChipActive]}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.editActions}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.8}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const priorityColor = getPriorityColor(task.priority || 'medium');
  const priorityOverlay = getPriorityOverlay(task.priority || 'medium');

  return (
    <View style={[styles.container, overdue && styles.overdueContainer]}>
      <TouchableOpacity
        style={[styles.checkbox, task.completed && styles.checkboxDone]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle(task.id as number);
        }}
        activeOpacity={0.7}
      >
        {task.completed && <Ionicons name="checkmark" size={16} color="#fff" />}
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={[styles.text, task.completed && styles.textDone]} numberOfLines={2}>
          {task.text}
        </Text>
        <View style={styles.meta}>
          <View style={[styles.priorityBadge, { backgroundColor: priorityOverlay }]}>
            <Text style={[styles.priorityText, { color: priorityColor }]}>
              {(task.priority || 'medium').toUpperCase()}
            </Text>
          </View>
          {task.category ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{task.category}</Text>
            </View>
          ) : null}
          {task.dueDate ? (
            <View style={styles.dueBadge}>
              <Ionicons
                name={overdue ? "warning" : "calendar-outline"}
                size={12}
                color={overdue ? Colors.semantic.error : Colors.text.tertiary}
              />
              <Text style={[styles.dueText, overdue && styles.overdueText]}>
                {formatDate(task.dueDate)}
              </Text>
            </View>
          ) : null}
          {(task.timeSpent ?? 0) > 0 && (
            <View style={styles.timeBadge}>
              <Ionicons name="time-outline" size={12} color={Colors.text.tertiary} />
              <Text style={styles.timeSpentText}>{Math.round((task.timeSpent ?? 0) / 60)}m</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        {!task.completed && onFocus && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onFocus(task);
            }}
            activeOpacity={0.6}
          >
            <Ionicons name="bulb" size={18} color={Colors.text.tertiary} />
          </TouchableOpacity>
        )}
        {!task.completed && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setEditing(true);
            }}
            activeOpacity={0.6}
          >
            <Ionicons name="pencil" size={18} color={Colors.text.tertiary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleDelete}
          activeOpacity={0.6}
        >
          <Ionicons name="trash-outline" size={18} color={Colors.semantic.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.base,
    borderRadius: ComponentTokens.taskItem.borderRadius,
    padding: ComponentTokens.taskItem.padding,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    gap: ComponentTokens.taskItem.gap,
  },
  overdueContainer: {
    borderColor: `${Colors.semantic.error}4D`,
    backgroundColor: `${Colors.semantic.error}0F`
  },
  checkbox: {
    width: ComponentTokens.taskItem.checkboxSize,
    height: ComponentTokens.taskItem.checkboxSize,
    borderRadius: ComponentTokens.taskItem.checkboxRadius,
    borderWidth: 2,
    borderColor: Colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: Colors.semantic.success,
    borderColor: Colors.semantic.success
  },
  content: { flex: 1 },
  text: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
    lineHeight: Typography.fontSize.md * Typography.lineHeight.normal,
  },
  textDone: {
    color: Colors.text.disabled,
    textDecorationLine: 'line-through'
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    alignItems: 'center'
  },
  priorityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs
  },
  priorityText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold
  },
  categoryBadge: {
    backgroundColor: Colors.category.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs
  },
  categoryText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.category.text,
    fontWeight: Typography.fontWeight.medium
  },
  dueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dueText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary
  },
  overdueText: { color: Colors.semantic.error },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeSpentText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary
  },
  actions: { flexDirection: 'column', gap: Spacing.xs },
  actionBtn: {
    padding: Spacing.xs,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
  },
  editContainer: {
    backgroundColor: Colors.surface.elevated,
    borderRadius: ComponentTokens.taskItem.borderRadius,
    padding: ComponentTokens.taskItem.padding,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border.focus,
  },
  editInput: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.primary,
    backgroundColor: Colors.surface.input,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: ComponentTokens.input.minHeight,
    borderWidth: 1,
    borderColor: Colors.border.strong,
    marginBottom: Spacing.md,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md
  },
  priorityChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  priorityChipText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary
  },
  priorityChipActive: {
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.semibold
  },
  editActions: {
    flexDirection: 'row',
    gap: Spacing.sm
  },
  saveBtn: {
    flex: 1,
    backgroundColor: Colors.interactive.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  saveBtnText: {
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.semibold,
    fontSize: Typography.fontSize.md
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: Colors.surface.elevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center'
  },
  cancelBtnText: {
    color: Colors.text.secondary,
    fontSize: Typography.fontSize.md
  },
});
