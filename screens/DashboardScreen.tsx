import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTasks } from '../context/TasksContext';
import { getLastNDays, getSessionHistory } from '../utils/pomodoroSessions';
import { Task } from '../types';
import { User } from '@supabase/supabase-js';

interface Props {
  user?: User | null;
}

const PRIORITY_COLOR: Record<string, string> = {
  high: '#FF453A', medium: '#FF9F0A', low: '#30D158',
};

const CATEGORY_COLORS = ['#1877F2', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#06B6D4'];

function todayStr() { return new Date().toISOString().split('T')[0]; }

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDuration(secs: number): string {
  if (secs < 60)   return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function startOfWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

interface BarProps {
  label: string;
  value: number;
  max: number;
  color: string;
  suffix?: string;
}

function Bar({ label, value, max, color, suffix = '' }: BarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <View style={b.row}>
      <Text style={b.label} numberOfLines={1}>{label}</Text>
      <View style={b.track}>
        <View style={[b.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[b.value, { color }]}>{value}{suffix}</Text>
    </View>
  );
}

const b = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  label: { width: 80, fontSize: 12, color: '#636366' },
  track: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  value: { width: 40, fontSize: 12, fontWeight: '600', textAlign: 'right' },
});

/** Mini bar chart — 7 columns */
function WeekBarChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <View style={wbc.container}>
      {data.map(d => {
        const pct = (d.count / max) * 100;
        const dow = new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
        const isToday = d.date === todayStr();
        return (
          <View key={d.date} style={wbc.col}>
            <Text style={wbc.count}>{d.count > 0 ? d.count : ''}</Text>
            <View style={wbc.barTrack}>
              <View style={[wbc.barFill, { height: `${Math.max(pct, d.count > 0 ? 8 : 0)}%` as any, backgroundColor: isToday ? '#1877F2' : '#8B5CF6' }]} />
            </View>
            <Text style={[wbc.dow, isToday && { color: '#1877F2', fontWeight: '700' }]}>{dow}</Text>
          </View>
        );
      })}
    </View>
  );
}

const wbc = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 6 },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  count: { fontSize: 10, color: '#636366', height: 14 },
  barTrack: { flex: 1, width: '100%', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 4 },
  dow: { fontSize: 10, color: '#48484A' },
});

export default function DashboardScreen({ user }: Props) {
  const userEmail = user?.email;
  const { tasks } = useTasks();
  const [last7, setLast7] = useState<{ date: string; count: number }[]>([]);
  const [pomodoroHistory, setPomodoroHistory] = useState<Record<string, number>>({});

  useFocusEffect(useCallback(() => {
    getLastNDays(7, userEmail).then(setLast7);
    getSessionHistory(userEmail).then(setPomodoroHistory);
  }, [userEmail]));

  const today = todayStr();
  const now = new Date();

  // Task stats
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const active = total - completed;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const overdue = tasks.filter(t => {
    if (!t.dueDate || t.completed) return false;
    return parseLocalDate(t.dueDate) < parseLocalDate(today);
  }).length;

  const weekEnd = new Date(now.getTime() + 7 * 86400000);
  const dueThisWeek = tasks.filter(t => {
    if (!t.dueDate || t.completed) return false;
    const d = parseLocalDate(t.dueDate);
    return d >= parseLocalDate(today) && d <= weekEnd;
  }).length;

  const totalTimeSpent = tasks.reduce((s, t) => s + (t.timeSpent ?? 0), 0);

  // Priority breakdown (active tasks)
  const activeTasks = tasks.filter(t => !t.completed);
  const byPriority = { high: 0, medium: 0, low: 0 };
  activeTasks.forEach(t => { byPriority[t.priority as keyof typeof byPriority]++; });
  const maxPriority = Math.max(...Object.values(byPriority), 1);

  // Category breakdown
  const catMap: Record<string, number> = {};
  activeTasks.forEach(t => { if (t.category) catMap[t.category] = (catMap[t.category] ?? 0) + 1; });
  const categories = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(...categories.map(c => c[1]), 1);

  // Time by priority
  const timeByPriority = { high: 0, medium: 0, low: 0 };
  tasks.forEach(t => { timeByPriority[t.priority as keyof typeof timeByPriority] += t.timeSpent ?? 0; });
  const maxTime = Math.max(...Object.values(timeByPriority), 1);

  // Pomodoro stats
  const pomodoroToday = pomodoroHistory[today] ?? 0;
  const sow = startOfWeek();
  const som = startOfMonth();
  const pomodoroWeek = Object.entries(pomodoroHistory)
    .filter(([d]) => parseLocalDate(d) >= sow)
    .reduce((s, [, c]) => s + c, 0);
  const pomodoroMonth = Object.entries(pomodoroHistory)
    .filter(([d]) => parseLocalDate(d) >= som)
    .reduce((s, [, c]) => s + c, 0);
  const pomodoroTotal = Object.values(pomodoroHistory).reduce((s, c) => s + c, 0);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>📊 Dashboard</Text>
          <Text style={s.subtitle}>Your productivity at a glance</Text>
        </View>

        {/* Task overview grid */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Tasks Overview</Text>
          <View style={s.grid}>
            <StatCard label="Total" value={total} icon="📋" />
            <StatCard label="Completed" value={completed} icon="✅" color="#30D158" />
            <StatCard label="Active" value={active} icon="🎯" color="#1877F2" />
            <StatCard label="Done Rate" value={`${rate}%`} icon="📈" color={rate >= 70 ? '#30D158' : rate >= 40 ? '#FF9F0A' : '#FF453A'} />
            <StatCard label="Overdue" value={overdue} icon="⚠️" color={overdue > 0 ? '#FF453A' : '#30D158'} />
            <StatCard label="This Week" value={dueThisWeek} icon="📅" color="#FF9F0A" />
          </View>
        </View>

        {/* Time tracked */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Time Tracked</Text>
          <View style={s.card}>
            <View style={s.timeRow}>
              <Text style={s.timeTotal}>⏱ {formatDuration(totalTimeSpent)}</Text>
              <Text style={s.timeSub}>total across all tasks</Text>
            </View>
            {totalTimeSpent > 0 && (
              <View style={{ marginTop: 12 }}>
                <Bar label="High" value={Math.round(timeByPriority.high / 60)} max={Math.round(maxTime / 60)} color={PRIORITY_COLOR.high} suffix="m" />
                <Bar label="Medium" value={Math.round(timeByPriority.medium / 60)} max={Math.round(maxTime / 60)} color={PRIORITY_COLOR.medium} suffix="m" />
                <Bar label="Low" value={Math.round(timeByPriority.low / 60)} max={Math.round(maxTime / 60)} color={PRIORITY_COLOR.low} suffix="m" />
              </View>
            )}
            {totalTimeSpent === 0 && <Text style={s.empty}>No time tracked yet. Use Focus Mode on a task!</Text>}
          </View>
        </View>

        {/* Priority breakdown */}
        {active > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Active Tasks by Priority</Text>
            <View style={s.card}>
              <Bar label="High" value={byPriority.high} max={maxPriority} color={PRIORITY_COLOR.high} />
              <Bar label="Medium" value={byPriority.medium} max={maxPriority} color={PRIORITY_COLOR.medium} />
              <Bar label="Low" value={byPriority.low} max={maxPriority} color={PRIORITY_COLOR.low} />
            </View>
          </View>
        )}

        {/* Category breakdown */}
        {categories.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Active Tasks by Category</Text>
            <View style={s.card}>
              {categories.map(([cat, count], i) => (
                <Bar key={cat} label={cat} value={count} max={maxCat} color={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
              ))}
            </View>
          </View>
        )}

        {/* Pomodoro stats */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>🍅 Pomodoro Sessions</Text>
          <View style={s.grid}>
            <StatCard label="Today" value={pomodoroToday} icon="🍅" color="#1877F2" />
            <StatCard label="This Week" value={pomodoroWeek} icon="📅" color="#8B5CF6" />
            <StatCard label="This Month" value={pomodoroMonth} icon="🗓" color="#FF9F0A" />
            <StatCard label="All Time" value={pomodoroTotal} icon="🏆" color="#30D158" />
          </View>
        </View>

        {/* 7-day bar chart */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Last 7 Days</Text>
          <View style={s.card}>
            {last7.every(d => d.count === 0) ? (
              <Text style={s.empty}>No Pomodoro sessions yet. Complete a focus session to see data here!</Text>
            ) : (
              <WeekBarChart data={last7} />
            )}
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, icon, color = '#EBEBF5' }: { label: string; value: number | string; icon: string; color?: string }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statIcon}>{icon}</Text>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 13, color: '#636366', marginTop: 4 },

  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: '#EBEBF5', marginBottom: 10 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '30.5%',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
    padding: 14, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  statIcon: { fontSize: 20 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#636366', textAlign: 'center' },

  card: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },

  timeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  timeTotal: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  timeSub: { fontSize: 13, color: '#636366' },

  empty: { fontSize: 13, color: '#48484A', textAlign: 'center', paddingVertical: 8 },
});
