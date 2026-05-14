import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTasks } from '../context/TasksContext';
import { getLastNDays, getSessionHistory } from '../utils/pomodoroSessions';
import { Task } from '../types';
import { User } from '@supabase/supabase-js';
import { toLocalDateString } from '../utils/date';

interface Props { user?: User | null; }

const PRIORITY_COLOR: Record<string, string> = {
  high: '#FF453A', medium: '#FF9F0A', low: '#30D158',
};

const CATEGORY_COLORS = ['#00C9B8', '#E84DB1', '#3B82F6', '#F97316', '#8B5CF6', '#10B981', '#EF4444'];

function todayStr() { return toLocalDateString(); }

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
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); return d;
}
function startOfMonth(): Date {
  const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
}

// ── Horizontal bar ────────────────────────────────────────────────────────────
function Bar({ label, value, max, color, suffix = '' }: { label: string; value: number; max: number; color: string; suffix?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <View style={bar.row}>
      <Text style={bar.label} numberOfLines={1}>{label}</Text>
      <View style={bar.track}>
        <View style={[bar.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[bar.val, { color }]}>{value}{suffix}</Text>
    </View>
  );
}
const bar = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  label: { width: 72, fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  track: { flex: 1, height: 7, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 4 },
  val:   { width: 40, fontSize: 12, fontWeight: '700', textAlign: 'right' },
});

// ── 7-day mini bar chart ──────────────────────────────────────────────────────
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
              <View style={[wbc.barFill, {
                height: `${Math.max(pct, d.count > 0 ? 8 : 0)}%` as any,
                backgroundColor: isToday ? '#00C9B8' : 'rgba(0,201,184,0.4)',
              }]} />
            </View>
            <Text style={[wbc.dow, isToday && { color: '#00C9B8', fontWeight: '700' }]}>{dow}</Text>
          </View>
        );
      })}
    </View>
  );
}
const wbc = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: 6 },
  col:       { flex: 1, alignItems: 'center', gap: 4 },
  count:     { fontSize: 10, color: 'rgba(255,255,255,0.3)', height: 14 },
  barTrack:  { flex: 1, width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill:   { width: '100%', borderRadius: 4 },
  dow:       { fontSize: 10, color: 'rgba(255,255,255,0.25)' },
});

// ── Coloured stat grid card (matches hydration blob cards) ────────────────────
function GridCard({ label, value, unit, cardStyle, blobStyle, valueColor }:
  { label: string; value: string | number; unit?: string; cardStyle: object; blobStyle: object; valueColor: string }) {
  return (
    <View style={[s.gridCard, cardStyle]}>
      <View style={[s.gridBlob, blobStyle]} />
      <Text style={s.gridLabel}>{label}</Text>
      <Text style={[s.gridValue, { color: valueColor }]}>{value}</Text>
      {unit ? <Text style={s.gridUnit}>{unit}</Text> : null}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function DashboardScreen({ user }: Props) {
  const userEmail = user?.email;
  const { tasks } = useTasks();
  const [last7, setLast7]               = useState<{ date: string; count: number }[]>([]);
  const [pomodoroHistory, setPomHistory] = useState<Record<string, number>>({});

  useFocusEffect(useCallback(() => {
    getLastNDays(7, userEmail).then(setLast7);
    getSessionHistory(userEmail).then(setPomHistory);
  }, [userEmail]));

  const today = todayStr();
  const now   = new Date();

  // Task stats
  const total     = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const active    = total - completed;
  const rate      = total > 0 ? Math.round((completed / total) * 100) : 0;

  const overdue = tasks.filter(t => {
    if (!t.dueDate || t.completed) return false;
    return parseLocalDate(t.dueDate) < parseLocalDate(today);
  }).length;

  const weekEnd      = new Date(now.getTime() + 7 * 86400000);
  const dueThisWeek  = tasks.filter(t => {
    if (!t.dueDate || t.completed) return false;
    const d = parseLocalDate(t.dueDate);
    return d >= parseLocalDate(today) && d <= weekEnd;
  }).length;

  const totalTimeSpent = tasks.reduce((s, t) => s + (t.timeSpent ?? 0), 0);

  // Priority breakdown
  const activeTasks = tasks.filter(t => !t.completed);
  const byPriority  = { high: 0, medium: 0, low: 0 };
  activeTasks.forEach(t => { byPriority[t.priority as keyof typeof byPriority]++; });
  const maxPriority = Math.max(...Object.values(byPriority), 1);

  // Category breakdown
  const catMap: Record<string, number> = {};
  activeTasks.forEach(t => { if (t.category) catMap[t.category] = (catMap[t.category] ?? 0) + 1; });
  const categories = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const maxCat     = Math.max(...categories.map(c => c[1]), 1);

  // Time by priority
  const timeByPriority = { high: 0, medium: 0, low: 0 };
  tasks.forEach(t => { timeByPriority[t.priority as keyof typeof timeByPriority] += t.timeSpent ?? 0; });
  const maxTime = Math.max(...Object.values(timeByPriority), 1);

  // Pomodoro stats
  const pomodoroToday = pomodoroHistory[today] ?? 0;
  const sow           = startOfWeek();
  const som           = startOfMonth();
  const pomodoroWeek  = Object.entries(pomodoroHistory).filter(([d]) => parseLocalDate(d) >= sow).reduce((s, [, c]) => s + c, 0);
  const pomodoroMonth = Object.entries(pomodoroHistory).filter(([d]) => parseLocalDate(d) >= som).reduce((s, [, c]) => s + c, 0);
  const pomodoroTotal = Object.values(pomodoroHistory).reduce((s, c) => s + c, 0);

  const rateColor = rate >= 70 ? '#00C9B8' : rate >= 40 ? '#FF9F0A' : '#FF453A';

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Ambient background blobs */}
      <View style={s.bgBlobTeal} />
      <View style={s.bgBlobPink} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Dashboard</Text>
          <Text style={s.subtitle}>Productivity at a glance</Text>
        </View>

        {/* Hero card — completion rate */}
        <View style={s.heroCard}>
          <View style={s.heroBlob} />
          <View style={s.heroTop}>
            <View>
              <Text style={s.heroLabel}>Completion Rate</Text>
              <View style={s.heroValueRow}>
                <Text style={s.heroValue}>{rate}</Text>
                <Text style={s.heroUnit}>%</Text>
              </View>
              <Text style={s.heroSub}>{completed} of {total} tasks done</Text>
            </View>
            <View style={[s.heroCircle, { borderColor: rateColor + '66' }]}>
              <Text style={[s.heroCircleVal, { color: rateColor }]}>{active}</Text>
              <Text style={s.heroCircleLabel}>active</Text>
            </View>
          </View>
          {/* Progress bar */}
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${rate}%` as any, backgroundColor: rateColor }]} />
          </View>
          <Text style={s.heroMotivation}>
            {overdue > 0 ? `⚠️ ${overdue} task${overdue > 1 ? 's' : ''} overdue` : rate >= 70 ? 'Great pace — keep it up' : 'Start completing tasks to build momentum'}
          </Text>
        </View>

        {/* 2×2 grid — task stats */}
        <View style={s.gridRow}>
          <GridCard label="Overdue"    value={overdue}      unit="tasks" cardStyle={s.cardRed}    blobStyle={s.blobRed}    valueColor="#FF453A" />
          <GridCard label="This Week"  value={dueThisWeek}  unit="due"   cardStyle={s.cardOrange} blobStyle={s.blobOrange} valueColor="#F97316" />
        </View>
        <View style={s.gridRow}>
          <GridCard label="Time Tracked" value={formatDuration(totalTimeSpent)} cardStyle={s.cardTeal} blobStyle={s.blobTeal} valueColor="#00C9B8" />
          <GridCard label="Pomodoros"    value={pomodoroTotal} unit="total"      cardStyle={s.cardPink} blobStyle={s.blobPink} valueColor="#E84DB1" />
        </View>

        {/* Pomodoro mini-stats row */}
        <Text style={s.sectionTitle}>Pomodoro Sessions</Text>
        <View style={s.gridRow}>
          <GridCard label="Today"      value={pomodoroToday} cardStyle={s.cardBlue}   blobStyle={s.blobBlue}   valueColor="#3B82F6" />
          <GridCard label="This Week"  value={pomodoroWeek}  cardStyle={s.cardPurple} blobStyle={s.blobPurple} valueColor="#8B5CF6" />
        </View>
        <View style={s.gridRow}>
          <GridCard label="This Month" value={pomodoroMonth} cardStyle={s.cardTeal}   blobStyle={s.blobTeal}   valueColor="#00C9B8" />
          <GridCard label="All Time"   value={pomodoroTotal} cardStyle={s.cardOrange} blobStyle={s.blobOrange} valueColor="#F97316" />
        </View>

        {/* 7-day chart */}
        <Text style={s.sectionTitle}>Last 7 Days</Text>
        <View style={s.infoCard}>
          {last7.every(d => d.count === 0)
            ? <Text style={s.empty}>No sessions yet — complete a focus session to see data.</Text>
            : <WeekBarChart data={last7} />}
        </View>

        {/* Priority breakdown */}
        {active > 0 && (
          <>
            <Text style={s.sectionTitle}>Active by Priority</Text>
            <View style={s.infoCard}>
              <Bar label="High"   value={byPriority.high}   max={maxPriority} color={PRIORITY_COLOR.high} />
              <Bar label="Medium" value={byPriority.medium} max={maxPriority} color={PRIORITY_COLOR.medium} />
              <Bar label="Low"    value={byPriority.low}    max={maxPriority} color={PRIORITY_COLOR.low} />
            </View>
          </>
        )}

        {/* Category breakdown */}
        {categories.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Active by Category</Text>
            <View style={s.infoCard}>
              {categories.map(([cat, count], i) => (
                <Bar key={cat} label={cat} value={count} max={maxCat} color={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
              ))}
            </View>
          </>
        )}

        {/* Time tracked */}
        {totalTimeSpent > 0 && (
          <>
            <Text style={s.sectionTitle}>Time by Priority</Text>
            <View style={s.infoCard}>
              <View style={s.timeTotalRow}>
                <Text style={s.timeTotal}>{formatDuration(totalTimeSpent)}</Text>
                <Text style={s.timeSub}>total tracked</Text>
              </View>
              <Bar label="High"   value={Math.round(timeByPriority.high / 60)}   max={Math.round(maxTime / 60)} color={PRIORITY_COLOR.high}   suffix="m" />
              <Bar label="Medium" value={Math.round(timeByPriority.medium / 60)} max={Math.round(maxTime / 60)} color={PRIORITY_COLOR.medium} suffix="m" />
              <Bar label="Low"    value={Math.round(timeByPriority.low / 60)}    max={Math.round(maxTime / 60)} color={PRIORITY_COLOR.low}    suffix="m" />
            </View>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060A10' },
  scroll:    { paddingHorizontal: 18, paddingTop: 8 },

  // Ambient background blobs
  bgBlobTeal: { position: 'absolute', top: -60, left: -60,  width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(0,201,184,0.06)' },
  bgBlobPink: { position: 'absolute', top: 200, right: -80, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(232,77,177,0.05)' },

  // Header
  header:   { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, marginTop: 4 },
  title:    { fontSize: 30, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.25)', marginBottom: 4 },

  // Hero card
  heroCard: {
    backgroundColor: '#0D1926', borderRadius: 24, padding: 22, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(0,201,184,0.15)', overflow: 'hidden',
  },
  heroBlob: { position: 'absolute', bottom: -40, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(0,201,184,0.12)' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  heroLabel: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: '600', marginBottom: 6, letterSpacing: 0.8, textTransform: 'uppercase' },
  heroValueRow: { flexDirection: 'row', alignItems: 'flex-end' },
  heroValue: { fontSize: 52, fontWeight: '800', color: '#FFFFFF', letterSpacing: -2, lineHeight: 56 },
  heroUnit:  { fontSize: 22, fontWeight: '600', color: 'rgba(255,255,255,0.3)', marginBottom: 8 },
  heroSub:   { fontSize: 13, color: 'rgba(255,255,255,0.3)', marginTop: 4 },
  heroCircle: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  heroCircleVal:   { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  heroCircleLabel: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 },
  progressTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  progressFill:  { height: '100%', borderRadius: 3 },
  heroMotivation: { fontSize: 13, color: 'rgba(255,255,255,0.3)', fontWeight: '500' },

  // 2×2 grid
  gridRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  gridCard: { flex: 1, borderRadius: 22, padding: 18, overflow: 'hidden', borderWidth: 1, minHeight: 110, justifyContent: 'flex-end' },
  gridBlob: { position: 'absolute', top: -20, right: -20, width: 110, height: 110, borderRadius: 55 },
  gridLabel: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '500', marginBottom: 4, letterSpacing: 0.3 },
  gridValue: { fontSize: 32, fontWeight: '800', letterSpacing: -1, lineHeight: 36 },
  gridUnit:  { fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: '500', marginTop: 2 },

  // Card colour variants
  cardTeal:   { backgroundColor: '#061E1C', borderColor: 'rgba(0,201,184,0.15)' },
  blobTeal:   { backgroundColor: 'rgba(0,201,184,0.2)' },
  cardPink:   { backgroundColor: '#1A0B18', borderColor: 'rgba(232,77,177,0.15)' },
  blobPink:   { backgroundColor: 'rgba(232,77,177,0.22)' },
  cardBlue:   { backgroundColor: '#070E1C', borderColor: 'rgba(59,130,246,0.15)' },
  blobBlue:   { backgroundColor: 'rgba(59,130,246,0.2)' },
  cardOrange: { backgroundColor: '#1A0F06', borderColor: 'rgba(249,115,22,0.15)' },
  blobOrange: { backgroundColor: 'rgba(249,115,22,0.22)' },
  cardRed:    { backgroundColor: '#1A0806', borderColor: 'rgba(255,69,58,0.15)' },
  blobRed:    { backgroundColor: 'rgba(255,69,58,0.2)' },
  cardPurple: { backgroundColor: '#0E0818', borderColor: 'rgba(139,92,246,0.15)' },
  blobPurple: { backgroundColor: 'rgba(139,92,246,0.22)' },

  // Section title
  sectionTitle: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.3)', marginBottom: 12, marginTop: 4, letterSpacing: 0.8, textTransform: 'uppercase' },

  // Info card (bars, chart)
  infoCard: { backgroundColor: '#0D1926', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 14 },

  timeTotalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 14 },
  timeTotal:    { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  timeSub:      { fontSize: 13, color: 'rgba(255,255,255,0.3)' },

  empty: { fontSize: 13, color: 'rgba(255,255,255,0.2)', textAlign: 'center', paddingVertical: 8 },
});
