import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Animated,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WATER_LOGS_KEY = 'zentask:water_logs';
const WATER_GOAL_KEY = 'zentask:water_goal';
const DEFAULT_GOAL = 2000;

interface WaterLog {
  id: number;
  amount: number;
  timestamp: string; // ISO string
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
  // Start of week (Monday)
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
  goal: number; // daily goal * days in bucket
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
  // Get Monday of current week
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

    // Count actual days in this week that have any data or up to today
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

function getMotivationalMessage(percentage: number, isOverflowing: boolean): string {
  if (isOverflowing) return '🌊 Overflowing with hydration! Amazing!';
  if (percentage >= 100) return '🎉 Goal achieved! Stay hydrated!';
  if (percentage >= 75) return '💪 Almost there! Keep it up!';
  if (percentage >= 50) return '👍 Halfway to your goal!';
  if (percentage >= 25) return '🌊 Good start! Keep drinking!';
  return '💧 Let\'s start hydrating!';
}

export default function WaterTrackerScreen() {
  const [logs, setLogs] = useState<WaterLog[]>([]);
  const [dailyGoal, setDailyGoal] = useState(DEFAULT_GOAL);
  const [customAmount, setCustomAmount] = useState('');
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>('day');

  const waveAnim = useRef(new Animated.Value(0)).current;
  const fillAnim = useRef(new Animated.Value(0)).current;

  // Load from storage
  useEffect(() => {
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
  }, []);

  // Persist logs
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(WATER_LOGS_KEY, JSON.stringify(logs)).catch(console.error);
  }, [logs, loaded]);

  // Persist goal
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(WATER_GOAL_KEY, String(dailyGoal)).catch(console.error);
  }, [dailyGoal, loaded]);

  const todayLogs = logs.filter(l => l.timestamp.startsWith(getTodayStr()));
  const todayIntake = todayLogs.reduce((sum, l) => sum + l.amount, 0);
  const actualPercentage = (todayIntake / dailyGoal) * 100;
  const displayPercentage = Math.min(actualPercentage, 100);
  const isOverflowing = actualPercentage > 100;
  const remaining = Math.max(dailyGoal - todayIntake, 0);

  // Animate fill level when intake changes
  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: displayPercentage,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [displayPercentage]);

  // Wave animation (continuous)
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const addWater = useCallback((amount: number) => {
    if (amount <= 0) return;
    // Store as local ISO string (not UTC) so date comparisons work correctly in any timezone
    const now = new Date();
    const localISO = `${getTodayStr()}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    const log: WaterLog = {
      id: Date.now(),
      amount,
      timestamp: localISO,
    };
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

  const GLASS_HEIGHT = 220;

  const fillHeight = fillAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [0, GLASS_HEIGHT],
  });

  const waveTranslate = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 8],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>💧 Water Tracker</Text>
          <Text style={styles.subtitle}>Stay hydrated, stay productive</Text>
        </View>

        {/* Glass Visualization */}
        <View style={styles.glassWrapper}>
          <View style={[styles.glass, isOverflowing && styles.glassOverflow]}>
            {/* Fill */}
            <Animated.View style={[styles.fill, { height: fillHeight }, isOverflowing && styles.fillOverflow]}>
              {/* Wave overlay */}
              <Animated.View style={[styles.wave, { transform: [{ translateX: waveTranslate }] }]} />
            </Animated.View>

            {/* Percentage label */}
            <View style={styles.glassOverlay}>
              <Text style={[styles.percentageText, displayPercentage > 45 && styles.percentageTextDark]}>
                {Math.round(actualPercentage)}%
              </Text>
            </View>

            {/* Glass markings */}
            <View style={[styles.marking, { bottom: GLASS_HEIGHT * 0.75 }]} />
            <View style={[styles.marking, { bottom: GLASS_HEIGHT * 0.50 }]} />
            <View style={[styles.marking, { bottom: GLASS_HEIGHT * 0.25 }]} />
          </View>

          {isOverflowing && (
            <View style={styles.puddle} />
          )}
        </View>

        {/* Motivational message */}
        <Text style={styles.motivation}>{getMotivationalMessage(actualPercentage, isOverflowing)}</Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{todayIntake}</Text>
            <Text style={styles.statUnit}>ml</Text>
            <Text style={styles.statLabel}>Today's Intake</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#1877F2' }]}>{dailyGoal}</Text>
            <Text style={styles.statUnit}>ml</Text>
            <Text style={styles.statLabel}>Daily Goal</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, remaining === 0 ? { color: '#30D158' } : { color: '#FF9F0A' }]}>{remaining}</Text>
            <Text style={styles.statUnit}>ml</Text>
            <Text style={styles.statLabel}>Remaining</Text>
          </View>
        </View>

        {/* Quick Add */}
        <Text style={styles.sectionTitle}>Quick Add</Text>
        <View style={styles.quickRow}>
          {QUICK_AMOUNTS.map(amount => (
            <TouchableOpacity key={amount} style={styles.quickBtn} onPress={() => addWater(amount)} activeOpacity={0.75}>
              <Text style={styles.quickBtnIcon}>💧</Text>
              <Text style={styles.quickBtnText}>{amount} ml</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom Amount */}
        <Text style={styles.sectionTitle}>Custom Amount</Text>
        <View style={styles.customRow}>
          <TextInput
            style={styles.customInput}
            placeholder="Enter ml…"
            placeholderTextColor="#48484A"
            keyboardType="number-pad"
            value={customAmount}
            onChangeText={setCustomAmount}
            onSubmitEditing={handleCustomAdd}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.customAddBtn, (!customAmount || parseInt(customAmount) <= 0) && styles.customAddBtnDisabled]}
            onPress={handleCustomAdd}
            disabled={!customAmount || parseInt(customAmount) <= 0}
          >
            <Text style={styles.customAddBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Change Goal */}
        <TouchableOpacity style={styles.goalBtn} onPress={() => { setGoalInput(String(dailyGoal)); setShowGoalModal(true); }}>
          <Text style={styles.goalBtnText}>⚙️  Change Daily Goal</Text>
        </TouchableOpacity>

        {/* Today's History */}
        <Text style={styles.sectionTitle}>Today's History</Text>
        {todayLogs.length === 0 ? (
          <Text style={styles.emptyText}>No water logged today yet!</Text>
        ) : (
          todayLogs.map(log => (
            <View key={log.id} style={styles.historyItem}>
              <Text style={styles.historyAmount}>💧 {log.amount} ml</Text>
              <Text style={styles.historyTime}>{formatTime(log.timestamp)}</Text>
              <TouchableOpacity
                onPress={() => Alert.alert('Delete', 'Remove this entry?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteLog(log.id) },
                ])}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.historyDelete}>✕</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* History */}
        <Text style={styles.sectionTitle}>History</Text>

        {/* Period tabs */}
        <View style={styles.periodTabs}>
          {(['day', 'week', 'month', 'year'] as HistoryPeriod[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.periodTab, historyPeriod === p && styles.periodTabActive]}
              onPress={() => setHistoryPeriod(p)}
            >
              <Text style={[styles.periodTabText, historyPeriod === p && styles.periodTabTextActive]}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary stat for selected period */}
        {(() => {
          const totalAll = historyBuckets.reduce((s, b) => s + b.total, 0);
          const daysWithData = historyBuckets.filter(b => b.total > 0).length;
          const avg = daysWithData > 0 ? Math.round(totalAll / daysWithData) : 0;
          const goalDays = historyBuckets.filter(b => b.total >= b.goal / b.days).length;
          return (
            <View style={styles.historySummary}>
              <View style={styles.historyStat}>
                <Text style={styles.historyStatValue}>{(totalAll / 1000).toFixed(1)}L</Text>
                <Text style={styles.historyStatLabel}>Total</Text>
              </View>
              <View style={styles.historyStat}>
                <Text style={styles.historyStatValue}>{(avg / 1000).toFixed(1)}L</Text>
                <Text style={styles.historyStatLabel}>Avg/Day</Text>
              </View>
              <View style={styles.historyStat}>
                <Text style={[styles.historyStatValue, { color: '#30D158' }]}>{goalDays}</Text>
                <Text style={styles.historyStatLabel}>Goal Days</Text>
              </View>
            </View>
          );
        })()}

        {/* Bar chart */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll} contentContainerStyle={styles.chartContent}>
          {historyBuckets.map((bucket, i) => {
            const barPct = maxBucketTotal > 0 ? bucket.total / maxBucketTotal : 0;
            const metGoal = bucket.total >= (bucket.goal / bucket.days);
            const barColor = bucket.total === 0 ? 'rgba(255,255,255,0.06)' : metGoal ? '#30D158' : '#1877F2';
            const isToday = i === 0 && historyPeriod === 'day';
            return (
              <View key={i} style={styles.chartBar}>
                <Text style={styles.chartBarValue}>
                  {bucket.total > 0 ? `${(bucket.total / 1000).toFixed(1)}L` : ''}
                </Text>
                <View style={styles.chartBarTrack}>
                  <View style={[styles.chartBarFill, { height: `${Math.max(barPct * 100, bucket.total > 0 ? 4 : 0)}%`, backgroundColor: barColor }]} />
                </View>
                <Text style={[styles.chartBarLabel, isToday && { color: '#1877F2', fontWeight: '700' }]} numberOfLines={2}>
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

        {/* Goal line legend */}
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: '#1877F2' }]} />
          <Text style={styles.legendText}>Below goal</Text>
          <View style={[styles.legendDot, { backgroundColor: '#30D158', marginLeft: 12 }]} />
          <Text style={styles.legendText}>Goal met</Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Goal Edit Modal */}
      <Modal visible={showGoalModal} transparent animationType="fade" onRequestClose={() => setShowGoalModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set Daily Goal</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              value={goalInput}
              onChangeText={setGoalInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveGoal}
            />
            <Text style={styles.modalUnit}>ml per day</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowGoalModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleSaveGoal}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const GLASS_HEIGHT = 220;
const GLASS_WIDTH = 140;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 14, color: '#636366', marginTop: 4 },

  // Glass
  glassWrapper: { alignItems: 'center', marginBottom: 8 },
  glass: {
    width: GLASS_WIDTH,
    height: GLASS_HEIGHT,
    borderWidth: 3,
    borderColor: 'rgba(24,119,242,0.5)',
    borderRadius: 12,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  glassOverflow: { borderColor: '#1877F2' },
  fill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1877F2',
    opacity: 0.75,
  },
  fillOverflow: { backgroundColor: '#30D158' },
  wave: {
    position: 'absolute',
    top: -6,
    left: -20,
    right: -20,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 6,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageText: { fontSize: 28, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  percentageTextDark: { color: '#fff' },
  marking: {
    position: 'absolute',
    left: 0,
    width: 12,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  puddle: {
    width: GLASS_WIDTH + 20,
    height: 10,
    backgroundColor: 'rgba(24,119,242,0.3)',
    borderRadius: 10,
    marginTop: 4,
  },

  // Motivation
  motivation: {
    textAlign: 'center',
    fontSize: 15,
    color: '#EBEBF5',
    marginBottom: 20,
    marginTop: 8,
    fontWeight: '500',
  },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statValue: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  statUnit: { fontSize: 11, color: '#636366', marginTop: 1 },
  statLabel: { fontSize: 11, color: '#636366', marginTop: 4, textAlign: 'center' },

  // Section titles
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#EBEBF5', marginBottom: 12 },

  // Quick add
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  quickBtn: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(24,119,242,0.15)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(24,119,242,0.3)',
    gap: 4,
  },
  quickBtnIcon: { fontSize: 20 },
  quickBtnText: { fontSize: 14, color: '#1877F2', fontWeight: '600' },

  // Custom add
  customRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  customInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  customAddBtn: {
    backgroundColor: '#1877F2',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  customAddBtnDisabled: { backgroundColor: 'rgba(24,119,242,0.3)' },
  customAddBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Goal button
  goalBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  goalBtnText: { color: '#636366', fontSize: 14, fontWeight: '500' },

  // History
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  historyAmount: { flex: 1, fontSize: 15, color: '#EBEBF5', fontWeight: '500' },
  historyTime: { fontSize: 13, color: '#636366', marginRight: 12 },
  historyDelete: { fontSize: 16, color: '#48484A' },
  emptyText: { fontSize: 14, color: '#48484A', textAlign: 'center', paddingVertical: 20 },

  // Goal modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 16, textAlign: 'center' },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 8,
  },
  modalUnit: { textAlign: 'center', color: '#636366', fontSize: 14, marginBottom: 20 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancel: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  modalCancelText: { color: '#636366', fontWeight: '600', fontSize: 15 },
  modalSave: {
    flex: 1,
    backgroundColor: '#1877F2',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  modalSaveText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // History
  periodTabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  periodTabActive: { backgroundColor: '#1877F2', borderColor: '#1877F2' },
  periodTabText: { fontSize: 13, fontWeight: '600', color: '#636366' },
  periodTabTextActive: { color: '#FFFFFF' },

  historySummary: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  historyStat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  historyStatValue: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  historyStatLabel: { fontSize: 11, color: '#636366', marginTop: 2 },

  chartScroll: { marginBottom: 8 },
  chartContent: { paddingBottom: 4, gap: 6, alignItems: 'flex-end' },
  chartBar: { width: 52, alignItems: 'center', gap: 4 },
  chartBarValue: { fontSize: 9, color: '#636366', height: 14, textAlign: 'center' },
  chartBarTrack: {
    width: 36,
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: { width: '100%', borderRadius: 6 },
  chartBarLabel: { fontSize: 10, color: '#8E8E93', textAlign: 'center' },

  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: '#636366' },
});
