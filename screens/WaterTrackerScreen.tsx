import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { User } from '@supabase/supabase-js';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

function getKeys(userEmail: string) {
  const ns = userEmail || 'guest';
  return {
    WATER_LOGS_KEY: `zentask:water_logs:${ns}`,
    WATER_GOAL_KEY: `zentask:water_goal:${ns}`,
  };
}

const DEFAULT_GOAL = 2000;

interface WaterLog {
  id: number;
  amount: number;
  timestamp: string;
}

const QUICK_AMOUNTS = [250, 500, 750, 1000];

function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

type HistoryPeriod = 'day' | 'week' | 'month' | 'year';

function getDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay() || 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - day + 1);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (dt: Date) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(mon)} – ${fmt(sun)}`;
}

function getMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

interface PeriodBucket {
  label: string;
  total: number;
  goal: number;
  days: number;
}

function buildDayBuckets(logs: WaterLog[], dailyGoal: number, n = 14): PeriodBucket[] {
  const buckets: PeriodBucket[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = getDateStr(d);
    const total = logs.filter(l => l.timestamp.startsWith(key)).reduce((s, l) => s + l.amount, 0);
    buckets.push({ label: i === 0 ? 'Today' : formatDateLabel(key), total, goal: dailyGoal, days: 1 });
  }
  return buckets;
}

function buildWeekBuckets(logs: WaterLog[], dailyGoal: number, n = 8): PeriodBucket[] {
  const now = new Date();
  const day = now.getDay() || 7;
  const thisMon = new Date(now);
  thisMon.setDate(now.getDate() - day + 1);
  thisMon.setHours(0, 0, 0, 0);

  const buckets: PeriodBucket[] = [];
  for (let i = 0; i < n; i++) {
    const mon = new Date(thisMon);
    mon.setDate(thisMon.getDate() - i * 7);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23, 59, 59, 999);
    const total = logs
      .filter(l => { const t = new Date(l.timestamp); return t >= mon && t <= sun; })
      .reduce((s, l) => s + l.amount, 0);
    const today = new Date();
    const daysInBucket = Math.min(7, Math.floor((Math.min(today.getTime(), sun.getTime()) - mon.getTime()) / 86400000) + 1);
    buckets.push({ label: getWeekLabel(getDateStr(mon)), total, goal: dailyGoal * 7, days: daysInBucket });
  }
  return buckets;
}

function buildMonthBuckets(logs: WaterLog[], dailyGoal: number, n = 12): PeriodBucket[] {
  const now = new Date();
  const buckets: PeriodBucket[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    const daysInMonth = end.getDate();
    const total = logs
      .filter(l => { const t = new Date(l.timestamp); return t >= start && t <= end; })
      .reduce((s, l) => s + l.amount, 0);
    buckets.push({ label: getMonthLabel(y, m), total, goal: dailyGoal * daysInMonth, days: daysInMonth });
  }
  return buckets;
}

function buildYearBuckets(logs: WaterLog[], dailyGoal: number, n = 3): PeriodBucket[] {
  const now = new Date();
  const buckets: PeriodBucket[] = [];
  for (let i = 0; i < n; i++) {
    const y = now.getFullYear() - i;
    const start = new Date(y, 0, 1);
    const end = new Date(y, 11, 31, 23, 59, 59, 999);
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const daysInYear = isLeap ? 366 : 365;
    const total = logs
      .filter(l => { const t = new Date(l.timestamp); return t >= start && t <= end; })
      .reduce((s, l) => s + l.amount, 0);
    buckets.push({ label: String(y), total, goal: dailyGoal * daysInYear, days: daysInYear });
  }
  return buckets;
}

function getMotivationalMessage(percentage: number): string {
  if (percentage >= 100) return 'Goal reached — you\'re crushing it';
  if (percentage >= 75) return 'Almost there, keep drinking';
  if (percentage >= 50) return 'Halfway to your daily goal';
  if (percentage >= 25) return 'Good start, keep going';
  return 'Start your hydration now';
}

interface Props { user?: User | null; }

export default function WaterTrackerScreen({ user }: Props) {
  const userEmail = user?.email || '';
  const { WATER_LOGS_KEY, WATER_GOAL_KEY } = useMemo(() => getKeys(userEmail), [userEmail]);

  const [logs, setLogs] = useState<WaterLog[]>([]);
  const [dailyGoal, setDailyGoal] = useState(DEFAULT_GOAL);
  const [customAmount, setCustomAmount] = useState('');
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>('day');

  const fillAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setLoaded(false);
    setLogs([]);
    setDailyGoal(DEFAULT_GOAL);
    (async () => {
      try {
        const [rawLogs, rawGoal] = await Promise.all([
          AsyncStorage.getItem(WATER_LOGS_KEY),
          AsyncStorage.getItem(WATER_GOAL_KEY),
        ]);
        if (rawLogs) setLogs(JSON.parse(rawLogs));
        if (rawGoal) setDailyGoal(parseInt(rawGoal));
      } catch (e) { console.error(e); }
      finally { setLoaded(true); }
    })();
  }, [WATER_LOGS_KEY, WATER_GOAL_KEY]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(WATER_LOGS_KEY, JSON.stringify(logs)).catch(console.error);
  }, [logs, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(WATER_GOAL_KEY, String(dailyGoal)).catch(console.error);
  }, [dailyGoal, loaded]);

  const todayLogs = logs.filter(l => l.timestamp.startsWith(getTodayStr()));
  const todayIntake = todayLogs.reduce((sum, l) => sum + l.amount, 0);
  const actualPercentage = (todayIntake / dailyGoal) * 100;
  const displayPercentage = Math.min(actualPercentage, 100);
  const remaining = Math.max(dailyGoal - todayIntake, 0);
  const streakDays = useMemo(() => {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = getDateStr(d);
      const dayTotal = logs.filter(l => l.timestamp.startsWith(key)).reduce((s, l) => s + l.amount, 0);
      if (dayTotal >= dailyGoal) streak++;
      else if (i > 0) break;
    }
    return streak;
  }, [logs, dailyGoal]);

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: displayPercentage,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [displayPercentage]);

  // Pulse the hero blob when goal reached
  useEffect(() => {
    if (actualPercentage >= 100) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [actualPercentage >= 100]);

  const addWater = useCallback((amount: number) => {
    if (amount <= 0) return;
    const now = new Date();
    const localISO = `${getTodayStr()}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    const log: WaterLog = { id: Date.now(), amount, timestamp: localISO };
    setLogs(prev => [log, ...prev]);
    setCustomAmount('');
  }, []);

  const deleteLog = useCallback((id: number) => {
    setLogs(prev => prev.filter(l => l.id !== id));
  }, []);

  const handleCustomAdd = () => {
    const n = parseInt(customAmount);
    if (!n || n <= 0) return;
    addWater(n);
  };

  const handleSaveGoal = () => {
    const n = parseInt(goalInput);
    if (n && n > 0) setDailyGoal(n);
    setShowGoalModal(false);
  };

  const historyBuckets = useMemo(() => {
    if (historyPeriod === 'day') return buildDayBuckets(logs, dailyGoal);
    if (historyPeriod === 'week') return buildWeekBuckets(logs, dailyGoal);
    if (historyPeriod === 'month') return buildMonthBuckets(logs, dailyGoal);
    return buildYearBuckets(logs, dailyGoal);
  }, [logs, dailyGoal, historyPeriod]);

  const maxBucketTotal = useMemo(() => Math.max(...historyBuckets.map(b => b.total), dailyGoal), [historyBuckets, dailyGoal]);

  const progressWidth = fillAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const totalAll = historyBuckets.reduce((s, b) => s + b.total, 0);
  const daysWithData = historyBuckets.filter(b => b.total > 0).length;
  const avgPerDay = daysWithData > 0 ? Math.round(totalAll / daysWithData) : 0;
  const goalDays = historyBuckets.filter(b => b.total >= b.goal / b.days).length;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* ambient blobs */}
      <View style={s.blobBlue} />
      <View style={s.blobCyan} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Hydration</Text>
          <TouchableOpacity onPress={() => { setGoalInput(String(dailyGoal)); setShowGoalModal(true); }}>
            <Text style={s.goalChip}>Goal: {(dailyGoal / 1000).toFixed(1)} L</Text>
          </TouchableOpacity>
        </View>

        {/* Hero card */}
        <View style={s.heroCard}>
          <Animated.View style={[s.heroBlob, { transform: [{ scale: pulseAnim }] }]} />
          <View style={s.heroTop}>
            <View>
              <Text style={s.heroLabel}>Today's Intake</Text>
              <View style={s.heroValueRow}>
                <Text style={s.heroValue}>{(todayIntake / 1000).toFixed(2)}</Text>
                <Text style={s.heroUnit}> L</Text>
              </View>
            </View>
            <View style={s.heroCircle}>
              <Text style={s.heroCirclePct}>{Math.round(actualPercentage)}%</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, { width: progressWidth }, actualPercentage >= 100 && s.progressFillDone]} />
          </View>
          <Text style={s.heroMotivation}>{getMotivationalMessage(actualPercentage)}</Text>
        </View>

        {/* 2×2 stat grid */}
        <View style={s.gridRow}>
          {/* Remaining — teal */}
          <View style={[s.gridCard, s.gridCardTeal]}>
            <View style={[s.gridBlob, s.gridBlobTeal]} />
            <Text style={s.gridCardLabel}>Remaining</Text>
            <Text style={[s.gridCardValue, s.gridValueTeal]}>{remaining}</Text>
            <Text style={s.gridCardUnit}>ml</Text>
          </View>
          {/* Streak — pink */}
          <View style={[s.gridCard, s.gridCardPink]}>
            <View style={[s.gridBlob, s.gridBlobPink]} />
            <Text style={s.gridCardLabel}>Streak</Text>
            <Text style={[s.gridCardValue, s.gridValuePink]}>{streakDays}</Text>
            <Text style={s.gridCardUnit}>days</Text>
          </View>
        </View>
        <View style={s.gridRow}>
          {/* Avg/day — blue */}
          <View style={[s.gridCard, s.gridCardBlue]}>
            <View style={[s.gridBlob, s.gridBlobBlue]} />
            <Text style={s.gridCardLabel}>Avg / Day</Text>
            <Text style={[s.gridCardValue, s.gridValueBlue]}>{(avgPerDay / 1000).toFixed(1)}</Text>
            <Text style={s.gridCardUnit}>L</Text>
          </View>
          {/* Goal days — orange */}
          <View style={[s.gridCard, s.gridCardOrange]}>
            <View style={[s.gridBlob, s.gridBlobOrange]} />
            <Text style={s.gridCardLabel}>Goal Days</Text>
            <Text style={[s.gridCardValue, s.gridValueOrange]}>{goalDays}</Text>
            <Text style={s.gridCardUnit}>total</Text>
          </View>
        </View>

        {/* Quick Add */}
        <Text style={s.sectionTitle}>Quick Add</Text>
        <View style={s.quickRow}>
          {QUICK_AMOUNTS.map(amount => (
            <TouchableOpacity key={amount} style={s.quickBtn} onPress={() => addWater(amount)} activeOpacity={0.7}>
              <Text style={s.quickBtnText}>{amount}</Text>
              <Text style={s.quickBtnUnit}>ml</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom Amount */}
        <View style={s.customRow}>
          <TextInput
            style={s.customInput}
            placeholder="Custom ml…"
            placeholderTextColor="#1A3A50"
            keyboardType="number-pad"
            value={customAmount}
            onChangeText={setCustomAmount}
            onSubmitEditing={handleCustomAdd}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[s.customAddBtn, (!customAmount || parseInt(customAmount) <= 0) && s.customAddBtnDisabled]}
            onPress={handleCustomAdd}
            disabled={!customAmount || parseInt(customAmount) <= 0}
          >
            <Text style={s.customAddBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Today's History */}
        <Text style={s.sectionTitle}>Today's Logs</Text>
        {todayLogs.length === 0 ? (
          <Text style={s.emptyText}>No logs yet today</Text>
        ) : (
          todayLogs.map(log => (
            <View key={log.id} style={s.historyItem}>
              <View style={s.historyDot} />
              <Text style={s.historyAmount}>{log.amount} ml</Text>
              <Text style={s.historyTime}>{formatTime(log.timestamp)}</Text>
              <TouchableOpacity
                onPress={() => deleteLog(log.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={s.historyDelete}>✕</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* History */}
        <Text style={s.sectionTitle}>History</Text>
        <View style={s.periodTabs}>
          {(['day', 'week', 'month', 'year'] as HistoryPeriod[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[s.periodTab, historyPeriod === p && s.periodTabActive]}
              onPress={() => setHistoryPeriod(p)}
            >
              <Text style={[s.periodTabText, historyPeriod === p && s.periodTabTextActive]}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bar chart */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chartScroll} contentContainerStyle={s.chartContent}>
          {historyBuckets.map((bucket, i) => {
            const barPct = maxBucketTotal > 0 ? bucket.total / maxBucketTotal : 0;
            const metGoal = bucket.total >= (bucket.goal / bucket.days);
            const barColor = bucket.total === 0 ? 'rgba(255,255,255,0.04)' : metGoal ? '#00C9B8' : '#3B82F6';
            const isToday = i === 0 && historyPeriod === 'day';
            return (
              <View key={i} style={s.chartBar}>
                <Text style={s.chartBarValue}>
                  {bucket.total > 0 ? `${(bucket.total / 1000).toFixed(1)}L` : ''}
                </Text>
                <View style={s.chartBarTrack}>
                  <View style={[s.chartBarFill, { height: `${Math.max(barPct * 100, bucket.total > 0 ? 4 : 0)}%`, backgroundColor: barColor }]} />
                </View>
                <Text style={[s.chartBarLabel, isToday && { color: '#00C9B8', fontWeight: '700' }]} numberOfLines={2}>
                  {historyPeriod === 'day'
                    ? bucket.label.split(',')[0]
                    : historyPeriod === 'year'
                    ? bucket.label
                    : bucket.label.split(' ')[0] + '\n' + bucket.label.split(' ').slice(1).join(' ')}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        <View style={s.legendRow}>
          <View style={[s.legendDot, { backgroundColor: '#3B82F6' }]} />
          <Text style={s.legendText}>Below goal</Text>
          <View style={[s.legendDot, { backgroundColor: '#00C9B8', marginLeft: 12 }]} />
          <Text style={s.legendText}>Goal met</Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Goal Modal */}
      <Modal visible={showGoalModal} transparent animationType="fade" onRequestClose={() => setShowGoalModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Daily Goal</Text>
            <TextInput
              style={s.modalInput}
              keyboardType="number-pad"
              value={goalInput}
              onChangeText={setGoalInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveGoal}
            />
            <Text style={s.modalUnit}>ml per day</Text>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setShowGoalModal(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalSave} onPress={handleSaveGoal}>
                <Text style={s.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060A10' },
  scroll: { paddingHorizontal: 18, paddingTop: 8 },

  // Ambient background blobs
  blobBlue: {
    position: 'absolute',
    top: -60,
    left: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(59,130,246,0.07)',
  },
  blobCyan: {
    position: 'absolute',
    top: 180,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(0,201,184,0.06)',
  },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, marginTop: 4 },
  title: { fontSize: 30, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1 },
  goalChip: {
    fontSize: 13,
    color: '#3B82F6',
    backgroundColor: 'rgba(59,130,246,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    fontWeight: '600',
    overflow: 'hidden',
  },

  // Hero card
  heroCard: {
    backgroundColor: '#0D1926',
    borderRadius: 24,
    padding: 22,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.15)',
    overflow: 'hidden',
  },
  heroBlob: {
    position: 'absolute',
    bottom: -40,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  heroLabel: { fontSize: 13, color: '#3A6080', fontWeight: '500', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' },
  heroValueRow: { flexDirection: 'row', alignItems: 'flex-end' },
  heroValue: { fontSize: 52, fontWeight: '800', color: '#FFFFFF', letterSpacing: -2, lineHeight: 56 },
  heroUnit: { fontSize: 20, fontWeight: '600', color: '#3A6080', marginBottom: 8 },
  heroCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  heroCirclePct: { fontSize: 16, fontWeight: '700', color: '#7DB8FF' },
  progressTrack: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 3,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  progressFillDone: { backgroundColor: '#00C9B8' },
  heroMotivation: { fontSize: 13, color: '#3A6080', fontWeight: '500' },

  // 2×2 grid
  gridRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  gridCard: {
    flex: 1,
    borderRadius: 22,
    padding: 18,
    overflow: 'hidden',
    borderWidth: 1,
    minHeight: 120,
    justifyContent: 'flex-end',
  },
  gridBlob: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  // Teal card
  gridCardTeal: { backgroundColor: '#061E1C', borderColor: 'rgba(0,201,184,0.15)' },
  gridBlobTeal: { backgroundColor: 'rgba(0,201,184,0.2)' },
  gridValueTeal: { color: '#00C9B8' },
  // Pink card
  gridCardPink: { backgroundColor: '#1A0B18', borderColor: 'rgba(232,77,177,0.15)' },
  gridBlobPink: { backgroundColor: 'rgba(232,77,177,0.22)' },
  gridValuePink: { color: '#E84DB1' },
  // Blue card
  gridCardBlue: { backgroundColor: '#070E1C', borderColor: 'rgba(59,130,246,0.15)' },
  gridBlobBlue: { backgroundColor: 'rgba(59,130,246,0.2)' },
  gridValueBlue: { color: '#3B82F6' },
  // Orange card
  gridCardOrange: { backgroundColor: '#1A0F06', borderColor: 'rgba(249,115,22,0.15)' },
  gridBlobOrange: { backgroundColor: 'rgba(249,115,22,0.22)' },
  gridValueOrange: { color: '#F97316' },

  gridCardLabel: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: '500', marginBottom: 4, letterSpacing: 0.3 },
  gridCardValue: { fontSize: 36, fontWeight: '800', letterSpacing: -1, lineHeight: 40 },
  gridCardUnit: { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: '500', marginTop: 2 },

  // Section title
  sectionTitle: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.35)', marginBottom: 12, marginTop: 8, letterSpacing: 0.5, textTransform: 'uppercase' },

  // Quick add
  quickRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  quickBtn: {
    flex: 1,
    backgroundColor: '#0D1926',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.15)',
  },
  quickBtnText: { fontSize: 18, fontWeight: '700', color: '#7DB8FF' },
  quickBtnUnit: { fontSize: 11, color: '#3A6080', marginTop: 2 },

  // Custom add
  customRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  customInput: {
    flex: 1,
    backgroundColor: '#0D1926',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.15)',
  },
  customAddBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  customAddBtnDisabled: { backgroundColor: 'rgba(59,130,246,0.2)', shadowOpacity: 0 },
  customAddBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // History items
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1926',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.08)',
    gap: 10,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  historyAmount: { flex: 1, fontSize: 15, color: '#C0D8F0', fontWeight: '600' },
  historyTime: { fontSize: 12, color: '#2A4A6A', marginRight: 4 },
  historyDelete: { fontSize: 14, color: '#1A3050' },
  emptyText: { fontSize: 14, color: '#1A3050', textAlign: 'center', paddingVertical: 20 },

  // Period tabs
  periodTabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  periodTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#0D1926',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.1)',
  },
  periodTabActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  periodTabText: { fontSize: 12, fontWeight: '600', color: '#2A4A6A' },
  periodTabTextActive: { color: '#FFFFFF' },

  // Bar chart
  chartScroll: { marginBottom: 8 },
  chartContent: { paddingBottom: 4, gap: 6, alignItems: 'flex-end' },
  chartBar: { width: 52, alignItems: 'center', gap: 4 },
  chartBarValue: { fontSize: 9, color: '#2A4A6A', height: 14, textAlign: 'center' },
  chartBarTrack: {
    width: 36,
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: { width: '100%', borderRadius: 6 },
  chartBarLabel: { fontSize: 10, color: '#2A4A6A', textAlign: 'center' },

  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendText: { fontSize: 11, color: '#2A4A6A' },

  // Goal modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#0D1926',
    borderRadius: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 18, textAlign: 'center' },
  modalInput: {
    backgroundColor: 'rgba(59,130,246,0.06)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
    marginBottom: 8,
  },
  modalUnit: { textAlign: 'center', color: '#2A4A6A', fontSize: 13, marginBottom: 22 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancel: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalCancelText: { color: '#3A6080', fontWeight: '600', fontSize: 15 },
  modalSave: {
    flex: 1,
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  modalSaveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
