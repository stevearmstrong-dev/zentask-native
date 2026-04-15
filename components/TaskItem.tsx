import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import { Task, Priority } from '../types';

interface Props {
  task: Task;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (id: number, updates: Partial<Task>) => void;
  onFocus?: (task: Task) => void;
}

const PRIORITY_COLOR: Record<string, string> = {
  high: '#FF453A',
  medium: '#FF9F0A',
  low: '#30D158',
};

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
    Alert.alert('Delete Task', `Delete "${task.text}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(task.id as number) },
    ]);
  };

  const handleSave = () => {
    if (editText.trim()) {
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
              style={[styles.priorityChip, editPriority === p && { backgroundColor: PRIORITY_COLOR[p] }]}
              onPress={() => setEditPriority(p)}
            >
              <Text style={[styles.priorityChipText, editPriority === p && styles.priorityChipActive]}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.editActions}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, overdue && styles.overdueContainer]}>
      <TouchableOpacity
        style={[styles.checkbox, task.completed && styles.checkboxDone]}
        onPress={() => onToggle(task.id as number)}
      >
        {task.completed && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={[styles.text, task.completed && styles.textDone]} numberOfLines={2}>
          {task.text}
        </Text>
        <View style={styles.meta}>
          <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLOR[task.priority || 'medium'] + '33' }]}>
            <Text style={[styles.priorityText, { color: PRIORITY_COLOR[task.priority || 'medium'] }]}>
              {(task.priority || 'medium').toUpperCase()}
            </Text>
          </View>
          {task.category ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{task.category}</Text>
            </View>
          ) : null}
          {task.dueDate ? (
            <Text style={[styles.dueText, overdue && styles.overdueText]}>
              {overdue ? '⚠️ ' : '📅 '}{formatDate(task.dueDate)}
            </Text>
          ) : null}
          {(task.timeSpent ?? 0) > 0 && (
            <Text style={styles.timeSpentText}>⏱ {Math.round((task.timeSpent ?? 0) / 60)}m</Text>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        {!task.completed && onFocus && (
          <TouchableOpacity style={styles.focusBtn} onPress={() => onFocus(task)}>
            <Text style={styles.focusBtnText}>🎯</Text>
          </TouchableOpacity>
        )}
        {!task.completed && (
          <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
            <Text style={styles.editBtnText}>✏️</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  overdueContainer: { borderColor: 'rgba(255,69,58,0.3)', backgroundColor: 'rgba(255,69,58,0.06)' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: '#30D158', borderColor: '#30D158' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  content: { flex: 1 },
  text: { fontSize: 15, color: '#EBEBF5', marginBottom: 6 },
  textDone: { color: '#48484A', textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  priorityText: { fontSize: 11, fontWeight: '700' },
  categoryBadge: { backgroundColor: 'rgba(24,119,242,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  categoryText: { fontSize: 11, color: '#1877F2', fontWeight: '500' },
  dueText: { fontSize: 12, color: '#636366' },
  overdueText: { color: '#FF453A' },
  actions: { flexDirection: 'column', gap: 4 },
  focusBtn: { padding: 4 },
  focusBtnText: { fontSize: 16 },
  editBtn: { padding: 4 },
  editBtnText: { fontSize: 16 },
  deleteBtn: { padding: 4 },
  deleteBtnText: { fontSize: 16 },
  timeSpentText: { fontSize: 11, color: '#636366' },
  editContainer: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(24,119,242,0.4)',
  },
  editInput: {
    fontSize: 15,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 12,
    minHeight: 60,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 12,
  },
  priorityRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  priorityChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  priorityChipText: { fontSize: 13, color: '#EBEBF5' },
  priorityChipActive: { color: '#FFFFFF', fontWeight: '600' },
  editActions: { flexDirection: 'row', gap: 8 },
  saveBtn: { flex: 1, backgroundColor: '#1877F2', borderRadius: 10, padding: 10, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  cancelBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 10, alignItems: 'center' },
  cancelBtnText: { color: '#EBEBF5', fontSize: 15 },
});
