import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User } from '@supabase/supabase-js';
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

function getKeys(userEmail: string) {
  const ns = userEmail || 'guest';
  return {
    START_DATE_KEY: `zentask:nofap_start:${ns}`,
    STREAKS_KEY: `zentask:nofap_streaks:${ns}`,
  };
}

interface StreakLog {
  id: number;
  startDate: string;
  endDate: string;
  duration: number;
}

const MILESTONES = [
  { days: 7,   icon: '⭐', label: '7 Days'   },
  { days: 30,  icon: '🏆', label: '30 Days'  },
  { days: 90,  icon: '🎖️', label: '90 Days'  },
  { days: 365, icon: '🏅', label: '365 Days' },
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
  if (days === 0)  return 'Start your journey today';
  if (days === 1)  return 'Day 1 — the journey begins';
  if (days < 7)   return 'Building momentum — keep going';
  if (days === 7)  return 'One week strong — amazing';
  if (days < 30)  return "You're crushing it — stay focused";
  if (days === 30) return '30 days — incredible achievement';
  if (days < 90)  return "You're unstoppable — keep it up";
  if (days === 90) return '90 days — life-changing milestone';
  if (days < 365) return "Legendary streak — you're an inspiration";
  return '365+ days — absolute legend';
}

function getMilestoneProgress(days: number) {
  const next = MILESTONES.find(m => m.days > days)?.days ?? 365;
  const prev = [...MILESTONES].reverse().find(m => m.days <= days)?.days ?? 0;
  const progress = prev === next ? 100 : ((days - prev) / (next - prev)) * 100;
  return { next, progress: Math.min(progress, 100), remaining: next - days };
}

interface Props { user?: User | null; }

export default function NoFapTrackerScreen({ user }: Props) {
  const userEmail = user?.email || '';
  const { START_DATE_KEY, STREAKS_KEY } = useMemo(() => getKeys(userEmail), [userEmail]);

  const [startDate, setStartDate] = useState<string | null>(null);
  const [streaks, setStreaks] = useState<StreakLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setLoaded(false);
    setStartDate(null);
    setStreaks([]);
    Promise.all([
      AsyncStorage.getItem(START_DATE_KEY),
      AsyncStorage.getItem(STREAKS_KEY),
    ]).then(([rawStart, rawStreaks]) => {
      if (rawStart) setStartDate(rawStart);
      if (rawStreaks) setStreaks(JSON.parse(rawStreaks));
      setLoaded(true);
    }).catch(console.error);
  }, [START_DATE_KEY, STREAKS_KEY]);

  useEffect(() => {
    if (!loaded) return;
    if (startDate) AsyncStorage.setItem(START_DATE_KEY, startDate).catch(console.error);
    else AsyncStorage.removeItem(START_DATE_KEY).catch(console.error);
  }, [startDate, loaded, START_DATE_KEY]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STREAKS_KEY, JSON.stringify(streaks)).catch(console.error);
  }, [streaks, loaded, STREAKS_KEY]);

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

  const accent = startDate ? '#FF9F0A' : '#8E8E93';
  const accentDim = startDate ? 'rgba(255,159,10,0.12)' : 'rgba(142,142,147,0.08)';
  const accentBorder = startDate ? 'rgba(255,159,10,0.3)' : 'rgba(142,142,147,0.15)';

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Ambient glow */}
      <View style={[s.glowBlob, { backgroundColor: accent }]} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Discipline</Text>
            <Text style={s.subtitle}>Build discipline, one day at a time</Text>
          </View>
        </View>

        {/* Hero ring card */}
        <View style={s.ringCard}>
          <Text style={[s.modeLabel, { color: accent }]}>
            {startDate ? 'ACTIVE STREAK' : 'NO ACTIVE STREAK'}
          </Text>

          <View style={s.ringOuter}>
            {/* Halo */}
            <View style={[s.ringHalo, { backgroundColor: accent }]} />
            {/* Track ring */}
            <View style={[s.ringTrack, {
              width: 200, height: 200, borderRadius: 100,
              borderColor: 'rgba(255,255,255,0.06)',
            }]} />
            {/* Progress ring — simple border trick for filled look */}
            <View style={[s.ringProgress, {
              width: 200, height: 200, borderRadius: 100,
              borderColor: accent,
              shadowColor: accent,
              opacity: startDate ? 1 : 0.2,
            }]} />
            {/* Center content */}
            <View style={s.ringCenter}>
              <Text style={[s.timerText, { color: startDate ? '#FFFFFF' : '#3A4A50' }]}>
                {currentStreak}
              </Text>
              <Text style={s.timerUnit}>{currentStreak === 1 ? 'DAY' : 'DAYS'}</Text>
              {startDate && (
                <Text style={s.timerSince}>since {formatDate(startDate)}</Text>
              )}
            </View>
          </View>

          <Text style={[s.motivationText, { color: accent }]}>{getMotivation(currentStreak)}</Text>

          {/* Action button inside card */}
          {!startDate ? (
            <TouchableOpacity style={[s.mainBtn, { backgroundColor: '#FF9F0A', shadowColor: '#FF9F0A' }]} onPress={handleStart} activeOpacity={0.85}>
              <Text style={s.mainBtnText}>Start Streak</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.resetBtn} onPress={handleReset} activeOpacity={0.85}>
              <Text style={s.resetBtnText}>Reset Streak</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={[s.statCard, { borderColor: accentBorder }]}>
            <Text style={[s.statValue, { color: accent }]}>{currentStreak}</Text>
            <Text style={s.statLabel}>Current</Text>
          </View>
          <View style={[s.statCard, { borderColor: 'rgba(52,199,89,0.3)' }]}>
            <Text style={[s.statValue, { color: '#34C759' }]}>{longestStreak}</Text>
            <Text style={s.statLabel}>Longest</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: '#8E8E93' }]}>{streaks.length}</Text>
            <Text style={s.statLabel}>Attempts</Text>
          </View>
        </View>

        {/* Milestone progress */}
        {startDate && milestone.remaining > 0 && (
          <View style={[s.milestoneCard, { borderColor: accentBorder, backgroundColor: accentDim }]}>
            <View style={s.milestoneHeader}>
              <Text style={[s.milestoneTitle, { color: accent }]}>Next: {milestone.next} Days</Text>
              <Text style={[s.milestoneRemaining, { color: accent }]}>{milestone.remaining}d to go</Text>
            </View>
            <View style={s.progressBar}>
              <View style={[s.progressFill, { width: `${milestone.progress}%` as any, backgroundColor: accent }]} />
            </View>
          </View>
        )}

        {/* Milestone badges */}
        <Text style={s.sectionTitle}>Milestones</Text>
        <View style={s.badgesRow}>
          {MILESTONES.map(m => {
            const achieved = currentStreak >= m.days;
            return (
              <View key={m.days} style={[s.badge, achieved && { borderColor: 'rgba(255,159,10,0.4)', backgroundColor: 'rgba(255,159,10,0.1)' }]}>
                <Text style={[s.badgeIcon, !achieved && s.badgeLocked]}>{m.icon}</Text>
                <Text style={[s.badgeLabel, achieved && { color: '#FF9F0A' }]}>{m.label}</Text>
                {achieved && <Text style={s.badgeCheck}>✓</Text>}
              </View>
            );
          })}
        </View>

        {/* Streak History */}
        <Text style={s.sectionTitle}>Streak History</Text>
        {streaks.length === 0 ? (
          <Text style={s.emptyText}>No previous streaks yet — stay strong</Text>
        ) : (
          streaks.map(streak => (
            <View key={streak.id} style={s.historyItem}>
              <View style={s.historyDot} />
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
  container: { flex: 1, backgroundColor: '#080E12' },
  scroll: { paddingBottom: 40 },

  // Ambient glow
  glowBlob: {
    position: 'absolute',
    width: 320, height: 320, borderRadius: 160,
    top: -100, alignSelf: 'center',
    opacity: 0.1,
  },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#3A5A60', marginTop: 2 },

  // Ring card
  ringCard: {
    marginHorizontal: 20, marginBottom: 20,
    backgroundColor: '#0D1C22',
    borderRadius: 28, padding: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
  },
  modeLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20 },

  ringOuter: { alignItems: 'center', justifyContent: 'center', width: 220, height: 220, marginBottom: 20 },
  ringHalo: {
    position: 'absolute',
    width: 260, height: 260, borderRadius: 130,
    opacity: 0.08,
  },
  ringTrack: {
    position: 'absolute',
    borderWidth: 10,
  },
  ringProgress: {
    position: 'absolute',
    borderWidth: 10,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 6,
  },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  timerText: { fontSize: 64, fontWeight: '200', letterSpacing: 2, lineHeight: 72 },
  timerUnit: { fontSize: 13, color: '#3A5A60', fontWeight: '700', letterSpacing: 2, marginTop: 2 },
  timerSince: { fontSize: 11, color: '#3A5A60', marginTop: 6 },

  motivationText: { fontSize: 14, fontWeight: '500', textAlign: 'center', marginBottom: 20, letterSpacing: 0.2 },

  mainBtn: {
    width: '100%', borderRadius: 18, paddingVertical: 16,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  mainBtnText: { color: '#000', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  resetBtn: {
    width: '100%', borderRadius: 18, paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: 'rgba(255,69,58,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,69,58,0.3)',
  },
  resetBtnText: { color: '#FF453A', fontWeight: '700', fontSize: 16 },

  // Stats
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: '#0D1C22', borderRadius: 20, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  statValue: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: '#3A5A60', textAlign: 'center', marginTop: 4 },

  // Milestone progress
  milestoneCard: {
    marginHorizontal: 20, borderRadius: 18, padding: 16,
    marginBottom: 20, borderWidth: 1, gap: 10,
  },
  milestoneHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  milestoneTitle: { fontSize: 14, fontWeight: '700' },
  milestoneRemaining: { fontSize: 13, fontWeight: '600' },
  progressBar: { height: 7, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },

  // Badges
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#3A5A60', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, paddingHorizontal: 20 },
  badgesRow: { flexDirection: 'row', gap: 10, marginBottom: 24, paddingHorizontal: 20 },
  badge: {
    flex: 1, backgroundColor: '#0D1C22', borderRadius: 16,
    padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 4,
  },
  badgeIcon: { fontSize: 24 },
  badgeLocked: { opacity: 0.25 },
  badgeLabel: { fontSize: 10, color: '#3A5A60', fontWeight: '600', textAlign: 'center' },
  badgeCheck: { fontSize: 10, color: '#FF9F0A', fontWeight: '700' },

  // History
  emptyText: { fontSize: 14, color: '#3A5A60', textAlign: 'center', paddingVertical: 16, paddingHorizontal: 20 },
  historyItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0D1C22', borderRadius: 16, padding: 14,
    marginBottom: 8, marginHorizontal: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 12,
  },
  historyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF9F0A' },
  historyInfo: { flex: 1 },
  historyDays: { fontSize: 15, color: 'rgba(255,255,255,0.7)' },
  historyDaysNum: { fontWeight: '700', color: '#FFFFFF' },
  historyDates: { fontSize: 12, color: '#3A5A60', marginTop: 2 },
  deleteText: { fontSize: 16, color: '#3A5A60' },
});
