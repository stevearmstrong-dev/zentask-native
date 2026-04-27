import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTasks } from '../context/TasksContext';
import { Task, Priority } from '../types';
import FocusMode from '../components/FocusMode';

// ─── Helpers ────────────────────────────────────────────────────────────────

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDayLabel(key: string): { weekday: string; date: string } {
  const d = parseDayKey(key);
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    date: String(d.getDate()),
  };
}

function formatFullDate(key: string): string {
  const d = parseDayKey(key);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const h12 = h % 12 || 12;
  const p = h >= 12 ? 'PM' : 'AM';
  return `${h12}:${String(m).padStart(2, '0')} ${p}`;
}

function formatTimeFromISO(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const h12 = h % 12 || 12;
  const p = h >= 12 ? 'PM' : 'AM';
  return `${h12}:${String(m).padStart(2, '0')} ${p}`;
}

function formatRangeLabel(iso: string, durationMins: number): string {
  const start = new Date(iso);
  const end = new Date(start.getTime() + durationMins * 60000);
  return `${formatTimeFromISO(iso)} → ${formatTimeFromISO(end.toISOString())}`;
}

const PRIORITY_COLORS: Record<Priority, string> = {
  high: '#FF453A',
  medium: '#FF9F0A',
  low: '#30D158',
};

// ─── Generate next 7 days (tomorrow → +7) ───────────────────────────────────

function getNext7Days(): string[] {
  const days: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(toLocalDateString(d));
  }
  return days;
}

// ─── Schedule Modal ──────────────────────────────────────────────────────────

interface ScheduleModalProps {
  task: Task | null;
  dayKey: string;
  onSave: (taskId: number, scheduledStart: string, scheduledDuration: number, dueDate: string) => void;
  onClose: () => void;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = ['00', '15', '30', '45'];

function ScheduleModal({ task, dayKey, onSave, onClose }: ScheduleModalProps) {
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState('00');
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM');
  const [duration, setDuration] = useState('60');

  if (!task) return null;

  const handleSave = () => {
    let h = hour % 12;
    if (ampm === 'PM') h += 12;
    const [y, mo, d] = dayKey.split('-').map(Number);
    const startDate = new Date(y, mo - 1, d, h, parseInt(minute));
    const dur = Math.max(15, parseInt(duration) || 60);
    onSave(task.id as number, startDate.toISOString(), dur, dayKey);
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={sm.overlay}>
        <View style={sm.card}>
          <Text style={sm.label}>SCHEDULE TASK</Text>
          <Text style={sm.taskTitle} numberOfLines={2}>{task.text}</Text>

          <Text style={sm.sectionLabel}>Start Time</Text>
          <View style={sm.timeRow}>
            {/* Hour picker */}
            <ScrollView style={sm.picker} showsVerticalScrollIndicator={false}>
              {HOURS.map(h => (
                <TouchableOpacity key={h} onPress={() => setHour(h)} style={[sm.pickerItem, hour === h && sm.pickerItemActive]}>
                  <Text style={[sm.pickerText, hour === h && sm.pickerTextActive]}>{h}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={sm.colon}>:</Text>
            {/* Minute picker */}
            <ScrollView style={sm.picker} showsVerticalScrollIndicator={false}>
              {MINUTES.map(m => (
                <TouchableOpacity key={m} onPress={() => setMinute(m)} style={[sm.pickerItem, minute === m && sm.pickerItemActive]}>
                  <Text style={[sm.pickerText, minute === m && sm.pickerTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {/* AM/PM toggle */}
            <View style={sm.ampmCol}>
              {(['AM', 'PM'] as const).map(p => (
                <TouchableOpacity key={p} onPress={() => setAmpm(p)} style={[sm.ampmBtn, ampm === p && sm.ampmActive]}>
                  <Text style={[sm.ampmText, ampm === p && sm.ampmTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text style={sm.sectionLabel}>Duration (minutes)</Text>
          <View style={sm.durationRow}>
            {[15, 30, 60, 90].map(d => (
              <TouchableOpacity key={d} onPress={() => setDuration(String(d))} style={[sm.durationChip, duration === String(d) && sm.durationChipActive]}>
                <Text style={[sm.durationChipText, duration === String(d) && sm.durationChipTextActive]}>{d}m</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={sm.actions}>
            <TouchableOpacity onPress={onClose} style={sm.cancelBtn}>
              <Text style={sm.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={sm.saveBtn}>
              <Text style={sm.saveText}>Save Block</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const sm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: '#2C2C2E', borderRadius: 16, padding: 20, width: '100%' },
  label: { fontSize: 11, fontWeight: '600', color: '#636366', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  taskTitle: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginBottom: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#636366', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 8 },
  picker: { height: 100, width: 50 },
  pickerItem: { paddingVertical: 8, paddingHorizontal: 6, borderRadius: 8, alignItems: 'center' },
  pickerItemActive: { backgroundColor: '#1877F2' },
  pickerText: { fontSize: 18, color: '#EBEBF5' },
  pickerTextActive: { color: '#FFFFFF', fontWeight: '700' },
  colon: { fontSize: 22, color: '#FFFFFF', fontWeight: '700' },
  ampmCol: { gap: 6, marginLeft: 8 },
  ampmBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  ampmActive: { backgroundColor: '#1877F2', borderColor: '#1877F2' },
  ampmText: { fontSize: 14, color: '#EBEBF5' },
  ampmTextActive: { color: '#FFFFFF', fontWeight: '600' },
  durationRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  durationChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.06)' },
  durationChipActive: { backgroundColor: '#1877F2', borderColor: '#1877F2' },
  durationChipText: { fontSize: 14, color: '#EBEBF5' },
  durationChipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center' },
  cancelText: { fontSize: 15, color: '#EBEBF5' },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#1877F2', alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
});

// ─── Edit Task Modal ─────────────────────────────────────────────────────────

interface EditModalProps {
  task: Task | null;
  onSave: (taskId: number, updates: Partial<Task>) => void;
  onClose: () => void;
}

function EditTaskModal({ task, onSave, onClose }: EditModalProps) {
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState('');

  React.useEffect(() => {
    if (task) {
      setText(task.text);
      setPriority(task.priority);
      setCategory(task.category || '');
    }
  }, [task]);

  if (!task) return null;

  const handleSave = () => {
    if (!text.trim()) return;
    onSave(task.id as number, {
      text: text.trim(),
      priority,
      category: category || undefined,
    });
    onClose();
  };

  const PRIORITIES: { label: string; value: Priority; color: string }[] = [
    { label: 'High', value: 'high', color: '#FF453A' },
    { label: 'Medium', value: 'medium', color: '#FF9F0A' },
    { label: 'Low', value: 'low', color: '#30D158' },
  ];

  const CATEGORIES = ['Work', 'Personal', 'Health', 'Finance', 'Learning', 'Other'];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={em.overlay}>
        <View style={em.card}>
          <View style={em.header}>
            <Text style={em.title}>Edit Task</Text>
            <TouchableOpacity onPress={onClose} style={em.closeBtn}>
              <Text style={em.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={em.label}>Task</Text>
          <TextInput
            style={em.input}
            value={text}
            onChangeText={setText}
            placeholder="What needs to be done?"
            placeholderTextColor="#636366"
            autoFocus
            multiline
          />

          <Text style={em.label}>Priority</Text>
          <View style={em.priorityRow}>
            {PRIORITIES.map(p => (
              <TouchableOpacity
                key={p.value}
                onPress={() => setPriority(p.value)}
                style={[em.priorityBtn, priority === p.value && { backgroundColor: p.color, borderColor: p.color }]}
              >
                <Text style={[em.priorityText, priority === p.value && em.priorityTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={em.label}>Category (Optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={em.categoryScroll}>
            <View style={em.categoryRow}>
              <TouchableOpacity
                onPress={() => setCategory('')}
                style={[em.categoryChip, !category && em.categoryChipActive]}
              >
                <Text style={[em.categoryText, !category && em.categoryTextActive]}>None</Text>
              </TouchableOpacity>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={[em.categoryChip, category === cat && em.categoryChipActive]}
                >
                  <Text style={[em.categoryText, category === cat && em.categoryTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={em.actions}>
            <TouchableOpacity onPress={onClose} style={em.cancelBtn}>
              <Text style={em.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={[em.saveBtn, !text.trim() && em.saveBtnDisabled]} disabled={!text.trim()}>
              <Text style={em.saveText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const em = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 20, color: '#636366' },
  label: { fontSize: 12, fontWeight: '600', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, fontSize: 16, color: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', minHeight: 80, textAlignVertical: 'top' },
  priorityRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  priorityBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  priorityText: { fontSize: 14, color: '#EBEBF5', fontWeight: '500' },
  priorityTextActive: { color: '#FFFFFF', fontWeight: '700' },
  categoryScroll: { maxHeight: 50 },
  categoryRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.06)' },
  categoryChipActive: { backgroundColor: '#1877F2', borderColor: '#1877F2' },
  categoryText: { fontSize: 14, color: '#EBEBF5' },
  categoryTextActive: { color: '#FFFFFF', fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center' },
  cancelText: { fontSize: 16, color: '#EBEBF5', fontWeight: '500' },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#1877F2', alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: '#2C2C2E', opacity: 0.5 },
  saveText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});

// ─── Task Row ────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  onSchedule: () => void;
  onUnschedule: () => void;
  onFocus: () => void;
  onEdit: () => void;
  isScheduled: boolean;
}

function TaskRow({ task, onToggle, onDelete, onSchedule, onUnschedule, onFocus, onEdit, isScheduled }: TaskRowProps) {
  const priorityColor = PRIORITY_COLORS[task.priority] || '#636366';

  const timeLabel = useMemo(() => {
    if (task.scheduledStart && task.scheduledDuration) {
      return formatRangeLabel(task.scheduledStart, task.scheduledDuration);
    }
    if (task.dueTime) return formatTime12(task.dueTime);
    return 'All day';
  }, [task]);

  return (
    <View style={tr.row}>
      {/* Priority bar */}
      <View style={[tr.priorityBar, { backgroundColor: priorityColor }]} />

      <View style={tr.content}>
        {/* Time label */}
        <Text style={tr.timeLabel}>{timeLabel}</Text>

        {/* Task text */}
        <Text style={[tr.text, task.completed && tr.textDone]} numberOfLines={2}>{task.text}</Text>

        {/* Meta chips */}
        <View style={tr.meta}>
          <View style={[tr.chip, { borderColor: priorityColor }]}>
            <Text style={[tr.chipText, { color: priorityColor }]}>{task.priority}</Text>
          </View>
          {task.category ? (
            <View style={tr.chip}>
              <Text style={tr.chipText}>{task.category}</Text>
            </View>
          ) : null}
        </View>

        {/* Actions */}
        <View style={tr.actions}>
          <TouchableOpacity onPress={onEdit} style={tr.actionBtn}>
            <Text style={tr.actionIcon}>✎</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onFocus} style={tr.actionBtn}>
            <Text style={tr.actionIcon}>🎯</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onToggle} style={tr.actionBtn}>
            <Text style={tr.actionIcon}>{task.completed ? '↺' : '✓'}</Text>
          </TouchableOpacity>
          {isScheduled ? (
            <TouchableOpacity onPress={onUnschedule} style={tr.actionBtn}>
              <Text style={tr.actionIcon}>⏏</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onSchedule} style={tr.actionBtn}>
              <Text style={tr.actionIcon}>⏱</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onDelete} style={tr.actionBtn}>
            <Text style={[tr.actionIcon, { color: '#FF453A' }]}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const tr = StyleSheet.create({
  row: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, marginBottom: 10, overflow: 'hidden' },
  priorityBar: { width: 4 },
  content: { flex: 1, padding: 12 },
  timeLabel: { fontSize: 11, fontWeight: '600', color: '#8E8E93', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  text: { fontSize: 15, color: '#FFFFFF', fontWeight: '500', marginBottom: 8 },
  textDone: { textDecorationLine: 'line-through', color: '#636366' },
  meta: { flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.06)' },
  chipText: { fontSize: 11, color: '#EBEBF5', fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 4 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)' },
  actionIcon: { fontSize: 14, color: '#EBEBF5' },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function UpcomingScreen() {
  const { tasks, toggleTask, deleteTask, editTask, addTask } = useTasks();
  const [selectedDay, setSelectedDay] = useState<string>(getNext7Days()[0]);
  const [newTaskText, setNewTaskText] = useState('');
  const [scheduleTarget, setScheduleTarget] = useState<Task | null>(null);
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [editTarget, setEditTarget] = useState<Task | null>(null);
  const dayScrollRef = useRef<ScrollView>(null);

  // Re-render when screen is focused
  useFocusEffect(React.useCallback(() => {}, []));

  const days = useMemo(() => getNext7Days(), []);

  // Group tasks by due date — only show days in our 7-day window
  const tasksByDay = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    days.forEach(d => { groups[d] = []; });

    tasks.forEach(task => {
      const key = task.dueDate || '';
      if (!groups[key]) return; // outside our 7-day window
      groups[key].push(task);
    });

    // Sort within each day: scheduled first (by start time), then unscheduled (by sortOrder)
    days.forEach(key => {
      groups[key].sort((a, b) => {
        if (a.scheduledStart && b.scheduledStart) {
          return new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime();
        }
        if (a.scheduledStart) return -1;
        if (b.scheduledStart) return 1;
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      });
    });

    return groups;
  }, [tasks, days]);

  const dayTasks = tasksByDay[selectedDay] || [];
  const scheduledTasks = dayTasks.filter(t => !!t.scheduledStart);
  const unscheduledTasks = dayTasks.filter(t => !t.scheduledStart);

  const handleAddTask = async () => {
    if (!newTaskText.trim()) return;
    const task: Task = {
      id: Date.now(),
      text: newTaskText.trim(),
      completed: false,
      priority: 'medium',
      dueDate: selectedDay,
      timeSpent: 0,
      isTracking: false,
      pomodoroActive: false,
      sortOrder: unscheduledTasks.length,
      status: 'todo',
    };
    await addTask(task);
    setNewTaskText('');
  };

  const handleSchedule = (taskId: number, scheduledStart: string, scheduledDuration: number, dueDate: string) => {
    editTask(taskId, { scheduledStart, scheduledDuration, dueDate });
  };

  const handleUnschedule = (taskId: number) => {
    editTask(taskId, { scheduledStart: undefined, scheduledDuration: undefined });
  };

  const handleEdit = (taskId: number, updates: Partial<Task>) => {
    editTask(taskId, updates);
  };

  const totalCount = dayTasks.length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Upcoming</Text>
        <Text style={styles.subtitle}>Next 7 days</Text>
      </View>

      {/* Day navigator */}
      <ScrollView
        ref={dayScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dayNav}
        contentContainerStyle={styles.dayNavContent}
      >
        {days.map(dayKey => {
          const { weekday, date } = formatDayLabel(dayKey);
          const count = (tasksByDay[dayKey] || []).length;
          const isSelected = selectedDay === dayKey;
          return (
            <TouchableOpacity
              key={dayKey}
              style={[styles.dayPill, isSelected && styles.dayPillActive]}
              onPress={() => setSelectedDay(dayKey)}
            >
              <Text style={[styles.dayWeekday, isSelected && styles.dayTextActive]}>{weekday}</Text>
              <Text style={[styles.dayDate, isSelected && styles.dayTextActive]}>{date}</Text>
              {count > 0 && (
                <View style={[styles.dayBadge, isSelected && styles.dayBadgeActive]}>
                  <Text style={[styles.dayBadgeText, isSelected && styles.dayBadgeTextActive]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Selected day label */}
      <View style={styles.dayHeading}>
        <Text style={styles.dayHeadingText}>{formatFullDate(selectedDay)}</Text>
        {totalCount > 0 && (
          <Text style={styles.dayHeadingCount}>{totalCount} task{totalCount !== 1 ? 's' : ''}</Text>
        )}
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">

        {/* Scheduled section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>⏰ Time Blocks</Text>
          {scheduledTasks.length > 0 && (
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{scheduledTasks.length}</Text>
            </View>
          )}
        </View>

        {scheduledTasks.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No time blocks yet. Schedule a task below.</Text>
          </View>
        ) : (
          scheduledTasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              isScheduled
              onToggle={() => toggleTask(task.id as number)}
              onDelete={() => deleteTask(task.id as number)}
              onSchedule={() => setScheduleTarget(task)}
              onUnschedule={() => handleUnschedule(task.id as number)}
              onFocus={() => setFocusTask(task)}
              onEdit={() => setEditTarget(task)}
            />
          ))
        )}

        {/* Unscheduled section */}
        <View style={[styles.sectionHeader, { marginTop: 20 }]}>
          <Text style={styles.sectionTitle}>📋 Unscheduled</Text>
          {unscheduledTasks.length > 0 && (
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{unscheduledTasks.length}</Text>
            </View>
          )}
        </View>

        {unscheduledTasks.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              {scheduledTasks.length > 0
                ? 'Everything for this day is scheduled. 🎉'
                : 'No tasks yet. Add one below.'}
            </Text>
          </View>
        ) : (
          unscheduledTasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              isScheduled={false}
              onToggle={() => toggleTask(task.id as number)}
              onDelete={() => deleteTask(task.id as number)}
              onSchedule={() => setScheduleTarget(task)}
              onUnschedule={() => handleUnschedule(task.id as number)}
              onFocus={() => setFocusTask(task)}
              onEdit={() => setEditTarget(task)}
            />
          ))
        )}

        {/* Add task input */}
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder={`Add task for ${formatDayLabel(selectedDay).weekday}…`}
            placeholderTextColor="#636366"
            value={newTaskText}
            onChangeText={setNewTaskText}
            onSubmitEditing={handleAddTask}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addBtn, !newTaskText.trim() && styles.addBtnDisabled]}
            onPress={handleAddTask}
            disabled={!newTaskText.trim()}
          >
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Schedule modal */}
      <ScheduleModal
        task={scheduleTarget}
        dayKey={selectedDay}
        onSave={handleSchedule}
        onClose={() => setScheduleTarget(null)}
      />

      {/* Edit modal */}
      <EditTaskModal
        task={editTarget}
        onSave={handleEdit}
        onClose={() => setEditTarget(null)}
      />

      {/* Focus mode */}
      {focusTask && (
        <FocusMode
          task={focusTask}
          visible={!!focusTask}
          onClose={() => setFocusTask(null)}
          onComplete={(id) => { toggleTask(id); setFocusTask(null); }}
          onUpdateTime={(id, data) => editTask(id, data)}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 13, color: '#636366', marginTop: 2 },

  dayNav: { flexGrow: 0, marginTop: 12 },
  dayNavContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  dayPill: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    minWidth: 56,
  },
  dayPillActive: {
    backgroundColor: '#1877F2',
    borderColor: '#1877F2',
  },
  dayWeekday: { fontSize: 11, fontWeight: '600', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5 },
  dayDate: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginTop: 2 },
  dayTextActive: { color: '#FFFFFF' },
  dayBadge: { marginTop: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  dayBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  dayBadgeText: { fontSize: 10, fontWeight: '700', color: '#EBEBF5' },
  dayBadgeTextActive: { color: '#FFFFFF' },

  dayHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  dayHeadingText: { fontSize: 15, fontWeight: '600', color: '#EBEBF5' },
  dayHeadingCount: { fontSize: 13, color: '#636366' },

  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingBottom: 40 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#636366', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionBadge: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  sectionBadgeText: { fontSize: 11, fontWeight: '700', color: '#EBEBF5' },

  emptyBox: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 10,
  },
  emptyText: { fontSize: 13, color: '#48484A', textAlign: 'center' },

  addRow: { flexDirection: 'row', gap: 10, marginTop: 24, alignItems: 'center' },
  addInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    color: '#FFFFFF',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addBtn: { backgroundColor: '#1877F2', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  addBtnDisabled: { backgroundColor: '#2C2C2E' },
  addBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
});
