import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCENT = '#00E5CC';
const GLOW   = 'rgba(0,229,204,0.35)';

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

const RING_SIZE = 240;
const STROKE = 12;

interface Props { user?: User | null; }

export default function NoFapTrackerScreen({ user }: Props) {
  const userEmail = user?.email || '';
  const { START_DATE_KEY, STREAKS_KEY } = useMemo(() => getKeys(userEmail), [userEmail]);

  const [startDate, setStartDate] = useState<string | null>(null);
  const [streaks, setStreaks] = useState<StreakLog[]>([]);
  const [loaded, setLoaded] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse glow when streak is active
  useEffect(() => {
    if (startDate) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 1200, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      Animated.timing(pulseAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [!!startDate]);

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

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Ambient glow blob — same as Pomodoro */}
      <Animated.View style={[s.glowBlob, { backgroundColor: GLOW, transform: [{ scale: pulseAnim }] }]} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Discipline</Text>
            <Text style={s.subtitle}>Build discipline, one day at a time</Text>
          </View>
        </View>

        {/* Ring card — identical structure to Pomodoro */}
        <View style={s.ringCard}>
          <Text style={[s.modeLabel, { color: ACCENT }]}>
            {startDate ? 'ACTIVE STREAK' : 'NO ACTIVE STREAK'}
          </Text>

          <Animated.View style={[s.ringOuter, { transform: [{ scale: pulseAnim }] }]}>
            {/* Glow halo */}
            <View style={[s.ringHalo, { backgroundColor: GLOW }]} />
            {/* Track ring */}
            <View style={[s.ringTrack, {
              width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2,
              borderColor: ACCENT + '20',
            }]} />
            {/* Progress ring */}
            <Animated.View style={[s.ringProgress, {
              width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2,
              borderColor: ACCENT,
              shadowColor: ACCENT,
              opacity: startDate ? 1 : 0.2,
            }]} />
            {/* Center */}
            <View style={s.ringCenter}>
              <Text style={[s.timerText, { color: ACCENT }]}>{currentStreak}</Text>
              <Text style={s.timerStatus}>{currentStreak === 1 ? 'DAY' : 'DAYS'}</Text>
              {startDate
                ? <Text style={s.timerSub}>since {formatDate(startDate)}</Text>
                : <Text style={s.timerSub}>not started</Text>
              }
            </View>
          </Animated.View>

          <Text style={s.motivationText}>{getMotivation(currentStreak)}</Text>

          {/* Controls — same layout as Pomodoro: icon | main | icon */}
          <View style={s.controls}>
            {/* Left square: best streak info */}
            <View style={s.squareBtn}>
              <Text style={s.squareBtnValue}>{longestStreak}</Text>
              <Text style={s.squareBtnLabel}>Best</Text>
            </View>

            {/* Main action button */}
            {!startDate ? (
              <TouchableOpacity
                style={[s.mainBtn, { backgroundColor: ACCENT, shadowColor: ACCENT }]}
                onPress={handleStart}
                activeOpacity={0.85}
              >
                <Text style={s.mainBtnText}>▶  Start</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.mainBtn, { backgroundColor: '#FF453A', shadowColor: '#FF453A' }]}
                onPress={handleReset}
                activeOpacity={0.85}
              >
                <Text style={s.mainBtnText}>↺  Reset</Text>
              </TouchableOpacity>
            )}

            {/* Right square: attempts */}
            <View style={s.squareBtn}>
              <Text style={s.squareBtnValue}>{streaks.length}</Text>
              <Text style={s.squareBtnLabel}>Tries</Text>
            </View>
          </View>
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: ACCENT }]}>{currentStreak}</Text>
            <Text style={s.statLabel}>Current{'\n'}Streak</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: '#4ADE80' }]}>{longestStreak}</Text>
            <Text style={s.statLabel}>Longest{'\n'}Streak</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: '#60A5FA' }]}>{streaks.length}</Text>
            <Text style={s.statLabel}>Total{'\n'}Attempts</Text>
          </View>
        </View>

        {/* Milestone progress card */}
        {startDate && milestone.remaining > 0 && (
          <View style={s.milestoneCard}>
            <View style={s.milestoneHeader}>
              <Text style={s.milestoneTitle}>Next Milestone</Text>
              <Text style={[s.milestoneCount, { color: ACCENT }]}>{milestone.next} days</Text>
            </View>
            <View style={s.progressTrack}>
              <Animated.View style={[s.progressFill, {
                width: `${milestone.progress}%` as any,
                backgroundColor: ACCENT,
                shadowColor: ACCENT,
              }]} />
            </View>
            <Text style={s.progressLabel}>{milestone.remaining} day{milestone.remaining !== 1 ? 's' : ''} to go</Text>

            {/* Milestone dots — same as Pomodoro session dots */}
            <View style={s.dotsRow}>
              {MILESTONES.map(m => {
                const achieved = currentStreak >= m.days;
                return (
                  <View key={m.days} style={[s.milestoneDot,
                    achieved
                      ? { backgroundColor: ACCENT, shadowColor: ACCENT, shadowOpacity: 0.6, shadowRadius: 4, elevation: 3 }
                      : { backgroundColor: 'rgba(255,255,255,0.08)' }
                  ]}>
                    <Text style={[s.milestoneDotIcon, !achieved && { opacity: 0.25 }]}>{m.icon}</Text>
                    <Text style={[s.milestoneDotLabel, achieved && { color: ACCENT }]}>{m.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Streak History */}
        <Text style={s.sectionTitle}>Streak History</Text>
        {streaks.length === 0 ? (
          <Text style={s.emptyText}>No previous streaks yet — stay strong</Text>
        ) : (
          streaks.map(streak => (
            <View key={streak.id} style={s.historyItem}>
              <View style={[s.historyDot, { backgroundColor: ACCENT }]} />
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

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080E12' },
  scroll: { paddingBottom: 40 },

  glowBlob: {
    position: 'absolute',
    width: 320, height: 320, borderRadius: 160,
    top: -80, alignSelf: 'center',
    opacity: 0.18,
  },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#3A5A60', marginTop: 2 },

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
  modeLabel: { fontSize: 14, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 24 },

  ringOuter: { alignItems: 'center', justifyContent: 'center', width: RING_SIZE, height: RING_SIZE, marginBottom: 16 },
  ringHalo: {
    position: 'absolute',
    width: RING_SIZE + 40, height: RING_SIZE + 40, borderRadius: (RING_SIZE + 40) / 2,
    opacity: 0.15,
  },
  ringTrack: { position: 'absolute', borderWidth: STROKE },
  ringProgress: {
    position: 'absolute', borderWidth: STROKE,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10, elevation: 6,
  },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  timerText: { fontSize: 58, fontWeight: '200', letterSpacing: 3, lineHeight: 64 },
  timerStatus: { fontSize: 12, color: '#3A5A60', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 },
  timerSub: { fontSize: 11, color: '#3A5A60', marginTop: 6 },

  motivationText: { fontSize: 13, color: '#3A5A60', fontWeight: '600', textAlign: 'center', marginBottom: 24 },

  controls: { flexDirection: 'row', alignItems: 'center', gap: 16, width: '100%', justifyContent: 'center' },
  squareBtn: {
    width: 60, height: 60, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 2,
  },
  squareBtnValue: { fontSize: 18, fontWeight: '700', color: '#6B8A90' },
  squareBtnLabel: { fontSize: 9, color: '#3A5A60', textTransform: 'uppercase', letterSpacing: 0.5 },
  mainBtn: {
    flex: 1, borderRadius: 18, paddingVertical: 16,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 8,
  },
  mainBtnText: { color: '#000', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },

  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: '#0D1C22', borderRadius: 20, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  statValue: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: '#3A5A60', textAlign: 'center', marginTop: 4, lineHeight: 15 },

  milestoneCard: {
    marginHorizontal: 20, backgroundColor: '#0D1C22', borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 5,
    marginBottom: 24,
  },
  milestoneHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  milestoneTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.5 },
  milestoneCount: { fontSize: 13, fontWeight: '700' },
  progressTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', borderRadius: 4, shadowOffset: { width: 0, height: 0 }, shadowRadius: 6, elevation: 3 },
  progressLabel: { fontSize: 11, color: '#3A5A60', marginBottom: 14 },
  dotsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  milestoneDot: { flex: 1, borderRadius: 8, padding: 10, alignItems: 'center', gap: 4 },
  milestoneDotIcon: { fontSize: 20 },
  milestoneDotLabel: { fontSize: 9, color: '#3A5A60', fontWeight: '600', textAlign: 'center' },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#3A5A60', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, paddingHorizontal: 20 },
  emptyText: { fontSize: 14, color: '#3A5A60', textAlign: 'center', paddingVertical: 16, paddingHorizontal: 20 },
  historyItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0D1C22', borderRadius: 16, padding: 14,
    marginBottom: 8, marginHorizontal: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 12,
  },
  historyDot: { width: 8, height: 8, borderRadius: 4 },
  historyInfo: { flex: 1 },
  historyDays: { fontSize: 15, color: 'rgba(255,255,255,0.7)' },
  historyDaysNum: { fontWeight: '700', color: '#FFFFFF' },
  historyDates: { fontSize: 12, color: '#3A5A60', marginTop: 2 },
  deleteText: { fontSize: 16, color: '#3A5A60' },
});
