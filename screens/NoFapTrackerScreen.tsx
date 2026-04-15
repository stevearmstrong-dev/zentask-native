import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const START_DATE_KEY = 'zentask:nofap_start';
const STREAKS_KEY = 'zentask:nofap_streaks';

interface StreakLog {
  id: number;
  startDate: string; // ISO
  endDate: string;   // ISO
  duration: number;  // days
}

const MILESTONES = [
  { days: 7,   icon: '⭐', label: '7 Days'  },
  { days: 30,  icon: '🏆', label: '30 Days' },
  { days: 90,  icon: '🎖️', label: '90 Days' },
  { days: 365, icon: '🏅', label: '365 Days'},
];

function calcDays(isoStart: string): number {
  const start = new Date(isoStart);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / 86400000) + 1;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getMotivation(days: number): string {
  if (days === 0)   return '💪 Start your journey today!';
  if (days === 1)   return '🌱 Day 1! The journey begins!';
  if (days < 7)     return '🔥 Building momentum! Keep going!';
  if (days === 7)   return '⭐ One week strong! Amazing!';
  if (days < 30)    return '💎 You\'re crushing it! Stay focused!';
  if (days === 30)  return '🏆 30 days! Incredible achievement!';
  if (days < 90)    return '👑 You\'re unstoppable! Keep it up!';
  if (days === 90)  return '🎖️ 90 days! Life-changing milestone!';
  if (days < 365)   return '🌟 Legendary streak! You\'re an inspiration!';
  return '🏅 365+ days! Absolute legend!';
}

function getMilestoneProgress(days: number) {
  const next = MILESTONES.find(m => m.days > days)?.days ?? 365;
  const prev = [...MILESTONES].reverse().find(m => m.days <= days)?.days ?? 0;
  const progress = prev === next ? 100 : ((days - prev) / (next - prev)) * 100;
  return { next, progress: Math.min(progress, 100), remaining: next - days };
}

export default function NoFapTrackerScreen() {
  const [startDate, setStartDate] = useState<string | null>(null);
  const [streaks, setStreaks] = useState<StreakLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(new Date());

  // Tick every minute to keep streak count live
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // Load
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(START_DATE_KEY),
      AsyncStorage.getItem(STREAKS_KEY),
    ]).then(([rawStart, rawStreaks]) => {
      if (rawStart) setStartDate(rawStart);
      if (rawStreaks) setStreaks(JSON.parse(rawStreaks));
      setLoaded(true);
    }).catch(console.error);
  }, []);

  // Persist
  useEffect(() => {
    if (!loaded) return;
    if (startDate) AsyncStorage.setItem(START_DATE_KEY, startDate).catch(console.error);
    else AsyncStorage.removeItem(START_DATE_KEY).catch(console.error);
  }, [startDate, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STREAKS_KEY, JSON.stringify(streaks)).catch(console.error);
  }, [streaks, loaded]);

  const currentStreak = startDate ? calcDays(startDate) : 0;
  const longestStreak = Math.max(0, currentStreak, ...streaks.map(s => s.duration));
  const milestone = getMilestoneProgress(currentStreak);

  const handleStart = useCallback(() => {
    setStartDate(new Date().toISOString());
  }, []);

  const handleReset = useCallback(() => {
    Alert.alert(
      'Reset Streak',
      'Are you sure? This will end your current streak.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Reset', style: 'destructive', onPress: () => {
            if (!startDate) return;
            const log: StreakLog = {
              id: Date.now(),
              startDate,
              endDate: new Date().toISOString(),
              duration: currentStreak,
            };
            setStreaks(prev => [log, ...prev]);
            setStartDate(null);
          },
        },
      ]
    );
  }, [startDate, currentStreak]);

  const handleDelete = useCallback((id: number) => {
    Alert.alert('Delete', 'Remove this streak from history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setStreaks(prev => prev.filter(s => s.id !== id)) },
    ]);
  }, []);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>💪 NoFap Tracker</Text>
          <Text style={s.subtitle}>Build discipline, one day at a time</Text>
        </View>

        {/* Streak circle */}
        <View style={s.circleWrapper}>
          <View style={[s.circle, startDate && s.circleActive]}>
            <Text style={s.circleNumber}>{currentStreak}</Text>
            <Text style={s.circleLabel}>{currentStreak === 1 ? 'Day' : 'Days'}</Text>
          </View>
          {startDate && (
            <Text style={s.startedText}>Started {formatDate(startDate)}</Text>
          )}
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={[s.statValue, startDate && { color: '#FF9F0A' }]}>{currentStreak}</Text>
            <Text style={s.statLabel}>Current Streak</Text>
          </View>
          <View style={[s.statCard, s.statCardHighlight]}>
            <Text style={[s.statValue, { color: '#30D158' }]}>{longestStreak}</Text>
            <Text style={s.statLabel}>Longest Streak</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statValue}>{streaks.length}</Text>
            <Text style={s.statLabel}>Total Attempts</Text>
          </View>
        </View>

        {/* Motivation */}
        <Text style={s.motivation}>{getMotivation(currentStreak)}</Text>

        {/* Milestone progress */}
        {startDate && milestone.remaining > 0 && (
          <View style={s.milestoneCard}>
            <Text style={s.milestoneTitle}>Next Milestone: {milestone.next} Days</Text>
            <View style={s.progressBar}>
              <View style={[s.progressFill, { width: `${milestone.progress}%` as any }]} />
            </View>
            <Text style={s.milestoneRemaining}>{milestone.remaining} day{milestone.remaining !== 1 ? 's' : ''} to go</Text>
          </View>
        )}

        {/* Milestone badges */}
        <Text style={s.sectionTitle}>Milestones</Text>
        <View style={s.badgesRow}>
          {MILESTONES.map(m => {
            const achieved = currentStreak >= m.days;
            return (
              <View key={m.days} style={[s.badge, achieved && s.badgeAchieved]}>
                <Text style={[s.badgeIcon, !achieved && s.badgeLocked]}>{m.icon}</Text>
                <Text style={[s.badgeLabel, achieved && { color: '#FF9F0A' }]}>{m.label}</Text>
                {achieved && <Text style={s.badgeCheck}>✓</Text>}
              </View>
            );
          })}
        </View>

        {/* Actions */}
        {!startDate ? (
          <TouchableOpacity style={s.startBtn} onPress={handleStart}>
            <Text style={s.startBtnText}>🚀 Start Streak</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.resetBtn} onPress={handleReset}>
            <Text style={s.resetBtnText}>🔄 Reset Streak</Text>
          </TouchableOpacity>
        )}

        {/* History */}
        <Text style={s.sectionTitle}>Streak History</Text>
        {streaks.length === 0 ? (
          <Text style={s.emptyText}>No previous streaks yet. Stay strong!</Text>
        ) : (
          streaks.map(streak => (
            <View key={streak.id} style={s.historyItem}>
              <View style={s.historyInfo}>
                <Text style={s.historyDays}>
                  <Text style={s.historyDaysNum}>{streak.duration}</Text>
                  {' '}{streak.duration === 1 ? 'day' : 'days'}
                </Text>
                <Text style={s.historyDates}>{formatDate(streak.startDate)} — {formatDate(streak.endDate)}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(streak.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={s.deleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 14, color: '#636366', marginTop: 4 },

  // Circle
  circleWrapper: { alignItems: 'center', marginBottom: 24 },
  circle: {
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  circleActive: { borderColor: '#FF9F0A', backgroundColor: 'rgba(255,159,10,0.1)' },
  circleNumber: { fontSize: 52, fontWeight: '800', color: '#FFFFFF' },
  circleLabel: { fontSize: 16, color: '#636366', marginTop: 2 },
  startedText: { marginTop: 12, fontSize: 13, color: '#636366' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16,
    padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  statCardHighlight: { borderColor: 'rgba(48,209,88,0.3)', backgroundColor: 'rgba(48,209,88,0.08)' },
  statValue: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
  statLabel: { fontSize: 11, color: '#636366', marginTop: 4, textAlign: 'center' },

  // Motivation
  motivation: { textAlign: 'center', fontSize: 15, color: '#EBEBF5', fontWeight: '500', marginBottom: 20 },

  // Milestone progress
  milestoneCard: {
    backgroundColor: 'rgba(255,159,10,0.08)', borderRadius: 16, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,159,10,0.25)', gap: 10,
  },
  milestoneTitle: { fontSize: 15, fontWeight: '600', color: '#FF9F0A' },
  progressBar: { height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#FF9F0A', borderRadius: 4 },
  milestoneRemaining: { fontSize: 13, color: '#636366' },

  // Badges
  sectionTitle: { fontSize: 17, fontWeight: '600', color: '#EBEBF5', marginBottom: 12 },
  badgesRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  badge: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 4,
  },
  badgeAchieved: { borderColor: 'rgba(255,159,10,0.4)', backgroundColor: 'rgba(255,159,10,0.1)' },
  badgeIcon: { fontSize: 24 },
  badgeLocked: { opacity: 0.3 },
  badgeLabel: { fontSize: 11, color: '#636366', fontWeight: '500', textAlign: 'center' },
  badgeCheck: { fontSize: 10, color: '#FF9F0A', fontWeight: '700' },

  // Actions
  startBtn: {
    backgroundColor: '#FF9F0A', borderRadius: 16, padding: 16,
    alignItems: 'center', marginBottom: 28,
  },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  resetBtn: {
    backgroundColor: 'rgba(255,69,58,0.12)', borderRadius: 16, padding: 16,
    alignItems: 'center', marginBottom: 28, borderWidth: 1, borderColor: 'rgba(255,69,58,0.3)',
  },
  resetBtnText: { color: '#FF453A', fontWeight: '600', fontSize: 16 },

  // History
  emptyText: { fontSize: 14, color: '#48484A', textAlign: 'center', paddingVertical: 16 },
  historyItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 12,
  },
  historyInfo: { flex: 1 },
  historyDays: { fontSize: 15, color: '#EBEBF5' },
  historyDaysNum: { fontWeight: '700', color: '#FFFFFF' },
  historyDates: { fontSize: 12, color: '#636366', marginTop: 2 },
  deleteText: { fontSize: 16, color: '#48484A' },
});
