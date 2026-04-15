import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User } from '@supabase/supabase-js';
import { Task } from '../types';
import { useTasks } from '../context/TasksContext';

const QUADRANTS = [
  { key: 'q1', label: 'Do First',  subtitle: 'Urgent & Important',        icon: '🔥', color: '#FF453A', bg: 'rgba(255,69,58,0.1)',  border: 'rgba(255,69,58,0.25)'  },
  { key: 'q2', label: 'Schedule',  subtitle: 'Not Urgent & Important',    icon: '📅', color: '#1877F2', bg: 'rgba(24,119,242,0.1)', border: 'rgba(24,119,242,0.25)' },
  { key: 'q3', label: 'Delegate',  subtitle: 'Urgent & Not Important',    icon: '⚡', color: '#FF9F0A', bg: 'rgba(255,159,10,0.1)', border: 'rgba(255,159,10,0.25)' },
  { key: 'q4', label: 'Eliminate', subtitle: 'Not Urgent & Not Important', icon: '🗑️', color: '#636366', bg: 'rgba(99,99,102,0.1)',  border: 'rgba(99,99,102,0.25)'  },
];

function isUrgent(task: Task): boolean {
  if (!task.dueDate || task.completed) return false;
  const [y, m, d] = task.dueDate.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due <= today;
}

function getQuadrant(task: Task): string {
  const urgent = isUrgent(task);
  const important = task.priority === 'high';
  if (urgent && important) return 'q1';
  if (!urgent && important) return 'q2';
  if (urgent && !important) return 'q3';
  return 'q4';
}

interface Props { user: User | null; }

export default function EisenhowerScreen({ user }: Props) {
  const { tasks, loading, reload, toggleTask, deleteTask } = useTasks();

  const handleDelete = (task: Task) => {
    Alert.alert('Delete Task', `Delete "${task.text}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTask(task.id as number) },
    ]);
  };

  const activeTasks = tasks.filter(t => !t.completed);
  const quadrantTasks = (key: string) => activeTasks.filter(t => getQuadrant(t) === key);

  if (loading) return <View style={s.loader}><ActivityIndicator size="large" color="#1877F2" /></View>;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Matrix</Text>
        <Text style={s.subtitle}>Organised by urgency & importance</Text>
      </View>

      <ScrollView
        contentContainerStyle={s.grid}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor="#1877F2" />}
      >
        {/* Axis labels */}
        <View style={s.axisRow}>
          <Text style={s.axisLabel}>          </Text>
          <Text style={[s.axisLabel, { flex: 1, textAlign: 'center' }]}>🔴 Urgent</Text>
          <Text style={[s.axisLabel, { flex: 1, textAlign: 'center' }]}>🟢 Not Urgent</Text>
        </View>

        {/* Q1 + Q2 row */}
        <View style={s.row}>
          <Text style={s.importantLabel}>⬆️{'\n'}Important</Text>
          <Quadrant q={QUADRANTS[0]} tasks={quadrantTasks('q1')} onToggle={id => toggleTask(id)} onDelete={handleDelete} />
          <Quadrant q={QUADRANTS[1]} tasks={quadrantTasks('q2')} onToggle={id => toggleTask(id)} onDelete={handleDelete} />
        </View>

        {/* Q3 + Q4 row */}
        <View style={s.row}>
          <Text style={s.importantLabel}>⬇️{'\n'}Not{'\n'}Important</Text>
          <Quadrant q={QUADRANTS[2]} tasks={quadrantTasks('q3')} onToggle={id => toggleTask(id)} onDelete={handleDelete} />
          <Quadrant q={QUADRANTS[3]} tasks={quadrantTasks('q4')} onToggle={id => toggleTask(id)} onDelete={handleDelete} />
        </View>

        {/* Legend */}
        <View style={s.legend}>
          <Text style={s.legendTitle}>How tasks are classified</Text>
          {[
            { dot: '#FF453A', text: 'High priority + Due today/overdue → Do First' },
            { dot: '#1877F2', text: 'High priority + Due later → Schedule' },
            { dot: '#FF9F0A', text: 'Med/Low priority + Due today/overdue → Delegate' },
            { dot: '#636366', text: 'Med/Low priority + Due later → Eliminate' },
          ].map(l => (
            <View key={l.text} style={s.legendRow}>
              <View style={[s.legendDot, { backgroundColor: l.dot }]} />
              <Text style={s.legendText}>{l.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Quadrant({ q, tasks, onToggle, onDelete }: {
  q: typeof QUADRANTS[0];
  tasks: Task[];
  onToggle: (id: number) => void;
  onDelete: (t: Task) => void;
}) {
  return (
    <View style={[qs.quadrant, { backgroundColor: q.bg, borderColor: q.border }]}>
      <View style={qs.qHeader}>
        <Text style={qs.qIcon}>{q.icon}</Text>
        <View style={qs.qTitles}>
          <Text style={[qs.qLabel, { color: q.color }]}>{q.label}</Text>
          <Text style={qs.qSub}>{q.subtitle}</Text>
        </View>
        <View style={[qs.qBadge, { backgroundColor: q.color }]}>
          <Text style={qs.qBadgeText}>{tasks.length}</Text>
        </View>
      </View>

      {tasks.length === 0 ? (
        <Text style={qs.empty}>No tasks</Text>
      ) : (
        tasks.map(task => (
          <View key={String(task.id)} style={qs.card}>
            <TouchableOpacity style={[qs.checkbox, task.completed && { backgroundColor: '#30D158', borderColor: '#30D158' }]} onPress={() => onToggle(task.id as number)}>
              {task.completed && <Text style={qs.check}>✓</Text>}
            </TouchableOpacity>
            <Text style={qs.cardText} numberOfLines={2}>{task.text}</Text>
            <TouchableOpacity onPress={() => onDelete(task)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={qs.deleteText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  loader: { flex: 1, backgroundColor: '#0A0A0F', justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 13, color: '#636366', marginTop: 2 },
  grid: { padding: 12, gap: 8 },
  axisRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 36, marginBottom: 2 },
  axisLabel: { fontSize: 11, color: '#636366', fontWeight: '500' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  importantLabel: { width: 36, fontSize: 10, color: '#636366', textAlign: 'center', paddingTop: 12, lineHeight: 14 },
  legend: { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  legendTitle: { fontSize: 12, color: '#636366', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: '#636366', flex: 1, lineHeight: 16 },
});

const qs = StyleSheet.create({
  quadrant: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 10, minHeight: 120 },
  qHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  qIcon: { fontSize: 16 },
  qTitles: { flex: 1 },
  qLabel: { fontSize: 13, fontWeight: '700' },
  qSub: { fontSize: 10, color: '#636366', marginTop: 1 },
  qBadge: { borderRadius: 8, minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, alignItems: 'center' },
  qBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  empty: { fontSize: 12, color: '#48484A', textAlign: 'center', paddingVertical: 12 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 8, marginBottom: 6, gap: 8 },
  checkbox: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  check: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cardText: { flex: 1, fontSize: 12, color: '#EBEBF5', lineHeight: 16 },
  deleteText: { color: '#48484A', fontSize: 13 },
});
