import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@supabase/supabase-js';
import { Task, TaskStatus, Priority } from '../types';
import supabaseService from '../services/supabase';

const GUEST_TASKS_KEY = 'zentask:guest_tasks';

const COLUMNS: { id: TaskStatus; title: string; icon: string; color: string; desc: string }[] = [
  { id: 'todo',       title: 'To Do',       icon: '🧠', color: '#1877F2', desc: 'Ideas & upcoming' },
  { id: 'inprogress', title: 'In Progress', icon: '⚙️', color: '#FF9F0A', desc: 'Currently active'  },
  { id: 'done',       title: 'Done',        icon: '🎉', color: '#30D158', desc: 'Wrapped up'         },
];

const PRIORITY_COLOR: Record<string, string> = {
  high: '#FF453A', medium: '#FF9F0A', low: '#30D158',
};

function getStatus(task: Task): TaskStatus {
  if (task.status && ['todo', 'inprogress', 'done'].includes(task.status)) return task.status as TaskStatus;
  return task.completed ? 'done' : 'todo';
}

function formatDue(task: Task): string | null {
  if (!task.dueDate) return null;
  const [y, m, d] = task.dueDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface Props { user: User | null; }

export default function KanbanScreen({ user }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);

  const userEmail = user?.email || '';
  const isGuest = !userEmail;

  const loadTasks = useCallback(async () => {
    try {
      if (isGuest) {
        const raw = await AsyncStorage.getItem(GUEST_TASKS_KEY);
        setTasks(raw ? JSON.parse(raw) : []);
      } else {
        const dbTasks = await supabaseService.fetchTasks(userEmail);
        setTasks(dbTasks.map(t => supabaseService.convertToAppFormat(t)));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [userEmail, isGuest]);

  useFocusEffect(useCallback(() => { loadTasks(); }, [loadTasks]));

  const persist = async (updated: Task[]) => {
    if (isGuest) {
      await AsyncStorage.setItem(GUEST_TASKS_KEY, JSON.stringify(updated));
    }
  };

  const moveTask = async (task: Task, newStatus: TaskStatus) => {
    const completed = newStatus === 'done';
    const updated = tasks.map(t => t.id === task.id ? { ...t, status: newStatus, completed } : t);
    setTasks(updated);
    await persist(updated);
    if (!isGuest) {
      supabaseService.updateTask(task.id as number, { status: newStatus, completed }, userEmail).catch(console.error);
    }
    setShowMoveModal(false);
    setSelectedTask(null);
  };

  const deleteTask = async (id: number) => {
    const updated = tasks.filter(t => t.id !== id);
    setTasks(updated);
    await persist(updated);
    if (!isGuest) supabaseService.deleteTask(id, userEmail).catch(console.error);
  };

  const addTask = async (text: string, priority: Priority, status: TaskStatus) => {
    const task: Task = {
      id: Date.now(), text, completed: status === 'done', priority,
      status, timeSpent: 0, isTracking: false, pomodoroActive: false, sortOrder: 0,
      dueDate: new Date().toISOString().split('T')[0],
    };
    const updated = [task, ...tasks];
    setTasks(updated);
    await persist(updated);
    if (!isGuest) {
      supabaseService.createTask(task, userEmail)
        .then(db => setTasks(prev => [supabaseService.convertToAppFormat(db), ...prev.filter(t => t.id !== task.id)]))
        .catch(console.error);
    }
  };

  const columnTasks = (col: TaskStatus) => tasks.filter(t => getStatus(t) === col);

  if (loading) return <View style={s.loader}><ActivityIndicator size="large" color="#1877F2" /></View>;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Kanban</Text>
        <Text style={s.subtitle}>Tap a card to move it</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.board}>
        {COLUMNS.map(col => (
          <Column
            key={col.id}
            col={col}
            tasks={columnTasks(col.id)}
            onCardPress={task => { setSelectedTask(task); setShowMoveModal(true); }}
            onDelete={id => Alert.alert('Delete', 'Delete this task?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteTask(id) },
            ])}
            onAdd={addTask}
          />
        ))}
      </ScrollView>

      {/* Move modal */}
      <Modal visible={showMoveModal} transparent animationType="fade" onRequestClose={() => setShowMoveModal(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowMoveModal(false)}>
          <View style={s.moveModal}>
            <Text style={s.moveTitle}>Move to…</Text>
            {selectedTask && <Text style={s.moveTaskText} numberOfLines={2}>{selectedTask.text}</Text>}
            <View style={s.moveOptions}>
              {COLUMNS.map(col => {
                const isCurrent = selectedTask ? getStatus(selectedTask) === col.id : false;
                return (
                  <TouchableOpacity
                    key={col.id}
                    style={[s.moveOption, isCurrent && { borderColor: col.color, backgroundColor: col.color + '22' }]}
                    onPress={() => selectedTask && moveTask(selectedTask, col.id)}
                    disabled={isCurrent}
                  >
                    <Text style={s.moveOptionIcon}>{col.icon}</Text>
                    <Text style={[s.moveOptionLabel, isCurrent && { color: col.color }]}>{col.title}</Text>
                    {isCurrent && <Text style={[s.currentBadge, { color: col.color }]}>Current</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// --- Column ---
function Column({ col, tasks, onCardPress, onDelete, onAdd }: {
  col: typeof COLUMNS[0];
  tasks: Task[];
  onCardPress: (t: Task) => void;
  onDelete: (id: number) => void;
  onAdd: (text: string, priority: Priority, status: TaskStatus) => void;
}) {
  const [newText, setNewText] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');

  const handleAdd = () => {
    if (!newText.trim()) return;
    onAdd(newText.trim(), priority, col.id);
    setNewText('');
  };

  return (
    <View style={[col_s.column]}>
      {/* Column header */}
      <View style={col_s.header}>
        <View style={col_s.headerLeft}>
          <Text style={col_s.icon}>{col.icon}</Text>
          <View>
            <Text style={[col_s.title, { color: col.color }]}>{col.title}</Text>
            <Text style={col_s.desc}>{col.desc}</Text>
          </View>
        </View>
        <View style={[col_s.badge, { backgroundColor: col.color }]}>
          <Text style={col_s.badgeText}>{tasks.length}</Text>
        </View>
      </View>

      {/* Cards */}
      <ScrollView style={col_s.cards} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {tasks.length === 0 && (
          <View style={col_s.empty}>
            <Text style={col_s.emptyText}>No tasks yet</Text>
          </View>
        )}
        {tasks.map(task => (
          <TaskCard key={String(task.id)} task={task} colColor={col.color} onPress={() => onCardPress(task)} onDelete={() => onDelete(task.id as number)} />
        ))}
      </ScrollView>

      {/* Add task */}
      <View style={col_s.addBox}>
        <View style={col_s.addRow}>
          <TextInput
            style={col_s.addInput}
            placeholder="Add task…"
            placeholderTextColor="#48484A"
            value={newText}
            onChangeText={setNewText}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <TouchableOpacity style={[col_s.addBtn, { backgroundColor: col.color }]} onPress={handleAdd} disabled={!newText.trim()}>
            <Text style={col_s.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>
        <View style={col_s.priorityRow}>
          {(['high', 'medium', 'low'] as Priority[]).map(p => (
            <TouchableOpacity key={p} style={[col_s.priorityChip, priority === p && { backgroundColor: PRIORITY_COLOR[p] + '33', borderColor: PRIORITY_COLOR[p] }]} onPress={() => setPriority(p)}>
              <Text style={[col_s.priorityChipText, priority === p && { color: PRIORITY_COLOR[p] }]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

// --- Task card ---
function TaskCard({ task, colColor, onPress, onDelete }: { task: Task; colColor: string; onPress: () => void; onDelete: () => void }) {
  const due = formatDue(task);
  return (
    <TouchableOpacity style={card_s.card} onPress={onPress} activeOpacity={0.75}>
      <View style={card_s.topRow}>
        <View style={[card_s.priorityDot, { backgroundColor: PRIORITY_COLOR[task.priority || 'medium'] }]} />
        <Text style={[card_s.priorityLabel, { color: PRIORITY_COLOR[task.priority || 'medium'] }]}>{(task.priority || 'medium').toUpperCase()}</Text>
        <TouchableOpacity style={card_s.deleteBtn} onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={card_s.deleteBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
      <Text style={[card_s.text, task.completed && card_s.textDone]} numberOfLines={3}>{task.text}</Text>
      <View style={card_s.meta}>
        {task.category && <View style={card_s.tag}><Text style={card_s.tagText}>{task.category}</Text></View>}
        {due && <Text style={card_s.due}>📅 {due}</Text>}
      </View>
      <View style={[card_s.moveBadge, { borderColor: colColor + '44' }]}>
        <Text style={[card_s.moveBadgeText, { color: colColor }]}>Tap to move</Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  loader: { flex: 1, backgroundColor: '#0A0A0F', justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 13, color: '#636366', marginTop: 2 },
  board: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  moveModal: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  moveTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  moveTaskText: { fontSize: 14, color: '#636366', marginBottom: 20 },
  moveOptions: { gap: 10 },
  moveOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 12 },
  moveOptionIcon: { fontSize: 22 },
  moveOptionLabel: { flex: 1, fontSize: 16, color: '#EBEBF5', fontWeight: '500' },
  currentBadge: { fontSize: 12, fontWeight: '600' },
});

const col_s = StyleSheet.create({
  column: { width: 280, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', maxHeight: '90%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { fontSize: 22 },
  title: { fontSize: 15, fontWeight: '700' },
  desc: { fontSize: 11, color: '#636366', marginTop: 1 },
  badge: { borderRadius: 10, minWidth: 24, paddingHorizontal: 8, paddingVertical: 2, alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cards: { maxHeight: 420, padding: 10 },
  empty: { padding: 20, alignItems: 'center' },
  emptyText: { color: '#48484A', fontSize: 14 },
  addBox: { padding: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  addInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 10, fontSize: 14, color: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  addBtn: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontSize: 22, fontWeight: '300' },
  priorityRow: { flexDirection: 'row', gap: 6 },
  priorityChip: { flex: 1, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  priorityChipText: { fontSize: 11, color: '#636366', fontWeight: '500' },
});

const card_s = StyleSheet.create({
  card: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  priorityLabel: { fontSize: 11, fontWeight: '700', flex: 1 },
  deleteBtn: { padding: 2 },
  deleteBtnText: { color: '#48484A', fontSize: 14 },
  text: { fontSize: 14, color: '#EBEBF5', lineHeight: 20, marginBottom: 8 },
  textDone: { color: '#48484A', textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tag: { backgroundColor: 'rgba(24,119,242,0.2)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontSize: 11, color: '#1877F2' },
  due: { fontSize: 11, color: '#636366' },
  moveBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  moveBadgeText: { fontSize: 11, fontWeight: '500' },
});
