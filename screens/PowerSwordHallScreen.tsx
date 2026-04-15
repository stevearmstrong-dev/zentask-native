import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SWORD_RECORDS_KEY = 'zentask:power_sword_records';

export interface SwordRecord {
  date: string;      // YYYY-MM-DD
  timestamp: string; // ISO
}

interface SwordTier {
  name: string;
  emoji: string;
  color: string;
  description: string;
  minDays: number;
}

const SWORD_TIERS: SwordTier[] = [
  { name: 'Power Sword',   emoji: '⚔️',  color: '#94A3B8', description: 'Your journey begins',              minDays: 0   },
  { name: 'Bronze Sword',  emoji: '🗡️',  color: '#D97706', description: '7 days of discipline',             minDays: 7   },
  { name: 'Silver Sword',  emoji: '🔱',  color: '#D1D5DB', description: '30 days of mastery',               minDays: 30  },
  { name: 'Gold Sword',    emoji: '✨',  color: '#FBBF24', description: '90 days of excellence',            minDays: 90  },
  { name: 'Eternia Sword', emoji: '🌟',  color: '#FBBF24', description: '365 days of legendary discipline', minDays: 365 },
];

const MILESTONES = [
  { days: 7,   label: 'Bronze Sword',  emoji: '🗡️',  color: '#D97706' },
  { days: 30,  label: 'Silver Sword',  emoji: '🔱',  color: '#D1D5DB' },
  { days: 90,  label: 'Gold Sword',    emoji: '✨',  color: '#FBBF24' },
  { days: 365, label: 'Eternia Sword', emoji: '🌟',  color: '#FBBF24' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getCurrentTier(streak: number): SwordTier {
  return [...SWORD_TIERS].reverse().find(t => streak >= t.minDays) ?? SWORD_TIERS[0];
}

function calcStreaks(records: SwordRecord[]): { current: number; longest: number } {
  if (records.length === 0) return { current: 0, longest: 0 };

  const uniqueDates = [...new Set(records.map(r => r.date))].sort().reverse();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Current streak
  let current = 0;
  let expected = uniqueDates[0] === today || uniqueDates[0] === yesterday ? uniqueDates[0] : null;
  if (expected) {
    for (const date of uniqueDates) {
      if (date === expected) {
        current++;
        const d = new Date(expected);
        d.setDate(d.getDate() - 1);
        expected = d.toISOString().split('T')[0];
      } else break;
    }
  }

  // Longest streak
  let longest = 0;
  let run = 1;
  for (let i = 0; i < uniqueDates.length - 1; i++) {
    const a = new Date(uniqueDates[i]);
    const b = new Date(uniqueDates[i + 1]);
    const diff = Math.round((a.getTime() - b.getTime()) / 86400000);
    if (diff === 1) { run++; } else { longest = Math.max(longest, run); run = 1; }
  }
  longest = Math.max(longest, run, current);
  return { current, longest };
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return { firstDay, daysInMonth };
}

function pad2(n: number) { return String(n).padStart(2, '0'); }

interface Props {
  onBack?: () => void;
}

export default function PowerSwordHallScreen({ onBack }: Props) {
  const [records, setRecords] = useState<SwordRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });

  useEffect(() => {
    AsyncStorage.getItem(SWORD_RECORDS_KEY).then(raw => {
      if (raw) setRecords(JSON.parse(raw));
      setLoaded(true);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(SWORD_RECORDS_KEY, JSON.stringify(records)).catch(console.error);
  }, [records, loaded]);

  const { current, longest } = calcStreaks(records);
  const tier = getCurrentTier(current);
  const unlockDates = new Set(records.map(r => r.date));

  const prevMonth = useCallback(() => {
    setSelectedMonth(prev => {
      const m = prev.month === 0 ? 11 : prev.month - 1;
      const y = prev.month === 0 ? prev.year - 1 : prev.year;
      return { year: y, month: m };
    });
  }, []);

  const nextMonth = useCallback(() => {
    setSelectedMonth(prev => {
      const m = prev.month === 11 ? 0 : prev.month + 1;
      const y = prev.month === 11 ? prev.year + 1 : prev.year;
      return { year: y, month: m };
    });
  }, []);

  const { firstDay, daysInMonth } = getMonthDays(selectedMonth.year, selectedMonth.month);
  const monthLabel = new Date(selectedMonth.year, selectedMonth.month, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Build calendar grid (pad with nulls for leading empty cells)
  const calendarCells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>⚔️ Power Sword Hall</Text>
          <Text style={s.subtitle}>Your hall of discipline achievements</Text>
        </View>

        {/* Current sword */}
        <View style={[s.swordCard, { borderColor: tier.color + '55' }]}>
          <Text style={s.swordEmoji}>{tier.emoji}</Text>
          <Text style={[s.swordName, { color: tier.color }]}>{tier.name}</Text>
          <Text style={s.swordDesc}>{tier.description}</Text>
          {current > 0 && (
            <View style={[s.streakBadge, { backgroundColor: tier.color + '22', borderColor: tier.color + '55' }]}>
              <Text style={[s.streakBadgeText, { color: tier.color }]}>{current} day streak 🔥</Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statValue}>{records.length}</Text>
            <Text style={s.statLabel}>Total Swords</Text>
          </View>
          <View style={[s.statCard, s.statCardHighlight]}>
            <Text style={[s.statValue, { color: tier.color }]}>{current}</Text>
            <Text style={s.statLabel}>Current Streak</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: '#FBBF24' }]}>{longest}</Text>
            <Text style={s.statLabel}>Longest Streak</Text>
          </View>
        </View>

        {/* Milestones */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Milestones</Text>
          <View style={s.milestonesRow}>
            {MILESTONES.map(m => {
              const achieved = longest >= m.days;
              return (
                <View key={m.days} style={[s.milestone, achieved && { borderColor: m.color + '55', backgroundColor: m.color + '11' }]}>
                  <Text style={[s.milestoneEmoji, !achieved && s.locked]}>{m.emoji}</Text>
                  <Text style={[s.milestoneLabel, achieved && { color: m.color }]}>{m.label}</Text>
                  <Text style={[s.milestoneDays, achieved && { color: m.color }]}>{m.days}d</Text>
                  {achieved && <Text style={[s.milestoneCheck, { color: m.color }]}>✓</Text>}
                </View>
              );
            })}
          </View>
        </View>

        {/* Calendar */}
        <View style={s.section}>
          <View style={s.calHeader}>
            <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.calNav}>‹</Text>
            </TouchableOpacity>
            <Text style={s.calTitle}>{monthLabel}</Text>
            <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.calNav}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={s.calGrid}>
            {WEEKDAYS.map(d => (
              <Text key={d} style={s.calWeekday}>{d}</Text>
            ))}
            {calendarCells.map((day, i) => {
              if (day === null) return <View key={`e${i}`} style={s.calCell} />;
              const dateStr = `${selectedMonth.year}-${pad2(selectedMonth.month + 1)}-${pad2(day)}`;
              const hasUnlock = unlockDates.has(dateStr);
              return (
                <View key={dateStr} style={[s.calCell, hasUnlock && s.calCellUnlocked]}>
                  <Text style={[s.calDay, hasUnlock && s.calDayUnlocked]}>{day}</Text>
                  {hasUnlock && <Text style={s.calSword}>⚔️</Text>}
                </View>
              );
            })}
          </View>
        </View>

        {records.length === 0 && (
          <Text style={s.emptyText}>Complete all 5 gems in a day to earn your first Power Sword!</Text>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 13, color: '#636366', marginTop: 4 },

  swordCard: {
    marginHorizontal: 20, marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20,
    padding: 24, alignItems: 'center', borderWidth: 1, gap: 8,
  },
  swordEmoji: { fontSize: 64 },
  swordName: { fontSize: 22, fontWeight: '800' },
  swordDesc: { fontSize: 14, color: '#636366' },
  streakBadge: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, marginTop: 4 },
  streakBadgeText: { fontSize: 14, fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
    padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  statCardHighlight: { borderColor: 'rgba(251,191,36,0.3)', backgroundColor: 'rgba(251,191,36,0.06)' },
  statValue: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  statLabel: { fontSize: 11, color: '#636366', marginTop: 3, textAlign: 'center' },

  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: '#EBEBF5', marginBottom: 12 },

  milestonesRow: { flexDirection: 'row', gap: 8 },
  milestone: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
    padding: 10, alignItems: 'center', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', gap: 3,
  },
  milestoneEmoji: { fontSize: 22 },
  locked: { opacity: 0.3 },
  milestoneLabel: { fontSize: 10, color: '#636366', fontWeight: '600', textAlign: 'center' },
  milestoneDays: { fontSize: 11, color: '#48484A' },
  milestoneCheck: { fontSize: 11, fontWeight: '700' },

  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calNav: { fontSize: 28, color: '#636366', fontWeight: '300', paddingHorizontal: 8 },
  calTitle: { fontSize: 16, fontWeight: '600', color: '#EBEBF5' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calWeekday: { width: '14.28%', textAlign: 'center', fontSize: 11, color: '#48484A', fontWeight: '600', paddingVertical: 6 },
  calCell: { width: '14.28%', alignItems: 'center', paddingVertical: 5, borderRadius: 8, minHeight: 44 },
  calCellUnlocked: { backgroundColor: 'rgba(251,191,36,0.12)' },
  calDay: { fontSize: 13, color: '#636366' },
  calDayUnlocked: { color: '#FBBF24', fontWeight: '700' },
  calSword: { fontSize: 12 },

  emptyText: { fontSize: 14, color: '#48484A', textAlign: 'center', paddingHorizontal: 40, paddingVertical: 20 },
});
