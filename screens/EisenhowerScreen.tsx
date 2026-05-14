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
  { key: 'q1', label: 'Do First',  subtitle: 'Urgent & Important',         icon: '🔥', color: '#FF453A', cardBg: '#1A0806', blobColor: 'rgba(255,69,58,0.22)',  border: 'rgba(255,69,58,0.2)'  },
  { key: 'q2', label: 'Schedule',  subtitle: 'Not Urgent & Important',     icon: '📅', color: '#14B478', cardBg: '#061A10', blobColor: 'rgba(20,180,120,0.22)', border: 'rgba(20,180,120,0.2)' },
  { key: 'q3', label: 'Delegate',  subtitle: 'Urgent & Not Important',     icon: '⚡', color: '#FF9F0A', cardBg: '#1A0F00', blobColor: 'rgba(255,159,10,0.22)', border: 'rgba(255,159,10,0.2)' },
  { key: 'q4', label: 'Eliminate', subtitle: 'Not Urgent & Not Important', icon: '🗑️', color: '#8E8E93', cardBg: '#0E0E10', blobColor: 'rgba(142,142,147,0.18)', border: 'rgba(142,142,147,0.15)' },
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

  const totalActive = activeTasks.length;
  const q1Count = quadrantTasks('q1').length;
  const q2Count = quadrantTasks('q2').length;

  if (loading) return <View style={s.loader}><ActivityIndicator size="large" color="#14B478" /></View>;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Ambient blobs */}
      <View style={s.blobGreen} />
      <View style={s.blobTeal} />

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor="#14B478" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Matrix</Text>
          <Text style={s.subtitle}>Organised by urgency & importance</Text>
        </View>

        {/* Hero card */}
        <View style={s.heroCard}>
          <View style={s.heroBlob} />
          <View style={s.heroTop}>
            <View>
              <Text style={s.heroLabel}>Active Tasks</Text>
              <View style={s.heroValueRow}>
                <Text style={s.heroValue}>{totalActive}</Text>
                <Text style={s.heroUnit}> tasks</Text>
              </View>
            </View>
            <View style={s.heroCircle}>
              <Text style={s.heroCircleNum}>{q1Count}</Text>
              <Text style={s.heroCircleLabel}>urgent</Text>
            </View>
          </View>
          <Text style={s.heroMotivation}>
            {q1Count === 0
              ? 'No urgent tasks — great position'
              : q1Count === 1
              ? '1 urgent task needs your attention'
              : `${q1Count} urgent tasks need your attention`}
          </Text>
        </View>

        {/* Stat row */}
        <View style={s.statRow}>
          <View style={s.statCard}>
            <Text style={s.statValue}>{q2Count}</Text>
            <Text style={s.statLabel}>Schedule</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statValue}>{quadrantTasks('q3').length}</Text>
            <Text style={s.statLabel}>Delegate</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statValue}>{quadrantTasks('q4').length}</Text>
            <Text style={s.statLabel}>Eliminate</Text>
          </View>
        </View>

        {/* Axis labels */}
        <View style={s.axisRow}>
          <Text style={s.axisSpace} />
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
            { dot: '#14B478', text: 'High priority + Due later → Schedule' },
            { dot: '#FF9F0A', text: 'Med/Low priority + Due today/overdue → Delegate' },
            { dot: '#8E8E93', text: 'Med/Low priority + Due later → Eliminate' },
          ].map(l => (
            <View key={l.text} style={s.legendRow}>
              <View style={[s.legendDot, { backgroundColor: l.dot }]} />
              <Text style={s.legendText}>{l.text}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 32 }} />
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
    <View style={[qs.quadrant, { backgroundColor: q.cardBg, borderColor: q.border }]}>
      {/* blob in corner */}
      <View style={[qs.blob, { backgroundColor: q.blobColor }]} />

      <View style={qs.qHeader}>
        <Text style={qs.qIcon}>{q.icon}</Text>
        <View style={qs.qTitles}>
          <Text style={[qs.qLabel, { color: q.color }]}>{q.label}</Text>
          <Text style={qs.qSub}>{q.subtitle}</Text>
        </View>
        <View style={[qs.qBadge, { backgroundColor: q.color + '33' }]}>
          <Text style={[qs.qBadgeText, { color: q.color }]}>{tasks.length}</Text>
        </View>
      </View>

      {tasks.length === 0 ? (
        <Text style={qs.empty}>No tasks</Text>
      ) : (
        tasks.map(task => (
          <View key={String(task.id)} style={qs.card}>
            <TouchableOpacity
              style={[qs.checkbox, task.completed && { backgroundColor: '#14B478', borderColor: '#14B478' }]}
              onPress={() => onToggle(task.id as number)}
            >
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
  container: { flex: 1, backgroundColor: '#060A10' },
  loader: { flex: 1, backgroundColor: '#060A10', justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 14, paddingTop: 8 },

  // Ambient blobs
  blobGreen: {
    position: 'absolute', top: -60, left: -60,
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(20,180,120,0.07)',
  },
  blobTeal: {
    position: 'absolute', top: 200, right: -80,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: 'rgba(20,180,120,0.05)',
  },

  // Header
  header: { paddingHorizontal: 6, marginBottom: 18, marginTop: 4 },
  title: { fontSize: 30, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.3)', marginTop: 2 },

  // Hero card
  heroCard: {
    backgroundColor: '#081A10',
    borderRadius: 24,
    padding: 22,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(20,180,120,0.18)',
    overflow: 'hidden',
    marginHorizontal: 0,
  },
  heroBlob: {
    position: 'absolute', bottom: -40, right: -40,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(20,180,120,0.15)',
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  heroLabel: { fontSize: 12, color: '#1F6A48', fontWeight: '500', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' },
  heroValueRow: { flexDirection: 'row', alignItems: 'flex-end' },
  heroValue: { fontSize: 52, fontWeight: '800', color: '#FFFFFF', letterSpacing: -2, lineHeight: 56 },
  heroUnit: { fontSize: 18, fontWeight: '600', color: '#1F6A48', marginBottom: 8 },
  heroCircle: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2, borderColor: 'rgba(20,180,120,0.4)',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(20,180,120,0.08)',
  },
  heroCircleNum: { fontSize: 22, fontWeight: '800', color: '#14B478', lineHeight: 26 },
  heroCircleLabel: { fontSize: 10, color: '#1F6A48', fontWeight: '500' },
  heroMotivation: { fontSize: 13, color: '#1F6A48', fontWeight: '500' },

  // Stat row
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 16, marginHorizontal: 0 },
  statCard: {
    flex: 1, backgroundColor: '#081A10', borderRadius: 18,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(20,180,120,0.12)',
  },
  statValue: { fontSize: 26, fontWeight: '800', color: '#14B478', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2, fontWeight: '500' },

  // Matrix grid
  axisRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingLeft: 2 },
  axisSpace: { width: 38 },
  axisLabel: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: '500' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 8 },
  importantLabel: { width: 38, fontSize: 10, color: 'rgba(255,255,255,0.25)', textAlign: 'center', paddingTop: 14, lineHeight: 14 },

  // Legend
  legend: {
    marginTop: 8, backgroundColor: 'rgba(20,180,120,0.06)', borderRadius: 18,
    padding: 16, borderWidth: 1, borderColor: 'rgba(20,180,120,0.14)', marginHorizontal: 0,
  },
  legendTitle: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: 'rgba(255,255,255,0.3)', flex: 1, lineHeight: 16 },
});

const qs = StyleSheet.create({
  quadrant: { flex: 1, borderRadius: 18, borderWidth: 1, padding: 12, minHeight: 130, overflow: 'hidden' },
  blob: { position: 'absolute', top: -28, right: -28, width: 90, height: 90, borderRadius: 45 },
  qHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  qIcon: { fontSize: 15 },
  qTitles: { flex: 1 },
  qLabel: { fontSize: 13, fontWeight: '700' },
  qSub: { fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 1 },
  qBadge: { borderRadius: 8, minWidth: 22, paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center' },
  qBadgeText: { fontSize: 11, fontWeight: '700' },
  empty: { fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', paddingVertical: 14 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 10,
    padding: 8, marginBottom: 6, gap: 8,
  },
  checkbox: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  check: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cardText: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 16 },
  deleteText: { color: 'rgba(255,255,255,0.15)', fontSize: 13 },
});
