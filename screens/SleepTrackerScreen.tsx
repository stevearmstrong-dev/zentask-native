import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User } from '@supabase/supabase-js';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

function getKeys(userEmail: string) {
  const ns = userEmail || 'guest';
  return {
    SLEEP_LOGS_KEY: `zentask:sleep_logs:${ns}`,
    SLEEP_GOAL_KEY: `zentask:sleep_goal:${ns}`,
  };
}

const DEFAULT_GOAL = 8; // hours

interface SleepLog {
  id: string;
  date: string;     // YYYY-MM-DD
  bedtime: string;  // HH:MM
  wakeTime: string; // HH:MM
  duration: number; // minutes
  quality: number;  // 1-5
}

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function calcDuration(bedtime: string, wakeTime: string): number {
  const [bh, bm] = bedtime.split(':').map(Number);
  const [wh, wm] = wakeTime.split(':').map(Number);
  let bedMins = bh * 60 + bm;
  let wakeMins = wh * 60 + wm;
  if (wakeMins <= bedMins) wakeMins += 24 * 60; // overnight
  return wakeMins - bedMins;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDisplayDate(dateStr: string): string {
  const today = getTodayStr();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  if (dateStr === today) return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function timeStringToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function Stars({ rating, onPress }: { rating: number; onPress?: (r: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <TouchableOpacity key={s} onPress={() => onPress?.(s)} disabled={!onPress} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
          <Text style={{ fontSize: 20, color: s <= rating ? '#FF9F0A' : '#48484A' }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

interface Props { user?: User | null; }

export default function SleepTrackerScreen({ user }: Props) {
  const userEmail = user?.email || '';
  const { SLEEP_LOGS_KEY, SLEEP_GOAL_KEY } = useMemo(() => getKeys(userEmail), [userEmail]);

  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [sleepGoal, setSleepGoal] = useState(DEFAULT_GOAL);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formBedtime, setFormBedtime] = useState('22:00');
  const [formWakeTime, setFormWakeTime] = useState('06:00');
  const [formQuality, setFormQuality] = useState(3);
  const [pickerTarget, setPickerTarget] = useState<'bedtime' | 'waketime' | 'goal' | null>(null);
  const [pickerDate, setPickerDate] = useState(new Date());

  // Load
  useEffect(() => {
    setLoaded(false);
    setLogs([]);
    setSleepGoal(DEFAULT_GOAL);
    Promise.all([
      AsyncStorage.getItem(SLEEP_LOGS_KEY),
      AsyncStorage.getItem(SLEEP_GOAL_KEY),
    ]).then(([rawLogs, rawGoal]) => {
      if (rawLogs) setLogs(JSON.parse(rawLogs));
      if (rawGoal) setSleepGoal(parseFloat(rawGoal));
      setLoaded(true);
    }).catch(console.error);
  }, [SLEEP_LOGS_KEY, SLEEP_GOAL_KEY]);

  // Persist
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(SLEEP_LOGS_KEY, JSON.stringify(logs)).catch(console.error);
  }, [logs, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(SLEEP_GOAL_KEY, String(sleepGoal)).catch(console.error);
  }, [sleepGoal, loaded]);

  // Stats
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  const last7 = sorted.slice(0, 7);
  const last30 = sorted.slice(0, 30);

  const avg7 = last7.length > 0 ? last7.reduce((s, l) => s + l.duration, 0) / last7.length / 60 : 0;
  const avg30 = last30.length > 0 ? last30.reduce((s, l) => s + l.duration, 0) / last30.length / 60 : 0;
  const avgQuality = logs.length > 0 ? logs.reduce((s, l) => s + l.quality, 0) / logs.length : 0;

  const sleepDebt = last7.reduce((debt, l) => debt + (sleepGoal * 60 - l.duration), 0) / 60;

  // Streak: consecutive days from today meeting goal
  let streak = 0;
  for (let i = 0; i < sorted.length; i++) {
    const expected = new Date();
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().split('T')[0];
    if (sorted[i].date !== expectedStr) break;
    if (sorted[i].duration >= sleepGoal * 60) streak++;
    else break;
  }

  const todayLog = logs.find(l => l.date === getTodayStr());

  const openPicker = (target: 'bedtime' | 'waketime' | 'goal') => {
    if (target === 'bedtime') setPickerDate(timeStringToDate(formBedtime));
    else if (target === 'waketime') setPickerDate(timeStringToDate(formWakeTime));
    else {
      // Goal picker: encode hours as a time (e.g. 8h = 08:00)
      const d = new Date();
      d.setHours(Math.floor(sleepGoal), (sleepGoal % 1) * 60, 0, 0);
      setPickerDate(d);
    }
    setPickerTarget(target);
  };

  const handlePickerChange = (_: any, selected?: Date) => {
    if (!selected) { setPickerTarget(null); return; }
    if (pickerTarget === 'bedtime') setFormBedtime(dateToTimeString(selected));
    else if (pickerTarget === 'waketime') setFormWakeTime(dateToTimeString(selected));
    else if (pickerTarget === 'goal') {
      const hours = selected.getHours() + selected.getMinutes() / 60;
      setSleepGoal(Math.max(1, Math.min(12, parseFloat(hours.toFixed(1)))));
    }
    setPickerTarget(null);
  };

  const handleSave = useCallback(() => {
    const duration = calcDuration(formBedtime, formWakeTime);
    const today = getTodayStr();
    const newLog: SleepLog = {
      id: Date.now().toString(),
      date: today,
      bedtime: formBedtime,
      wakeTime: formWakeTime,
      duration,
      quality: formQuality,
    };
    setLogs(prev => [newLog, ...prev.filter(l => l.date !== today)].sort((a, b) => b.date.localeCompare(a.date)));
    setShowForm(false);
    setFormBedtime('22:00');
    setFormWakeTime('06:00');
    setFormQuality(3);
  }, [formBedtime, formWakeTime, formQuality]);

  const handleDelete = (id: string) => {
    Alert.alert('Delete', 'Remove this sleep log?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setLogs(prev => prev.filter(l => l.id !== id)) },
    ]);
  };

  const duration = calcDuration(formBedtime, formWakeTime);
  const goalMins = sleepGoal * 60;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>😴 Sleep Tracker</Text>
          <Text style={s.subtitle}>Track your sleep to optimise recovery</Text>
        </View>

        {/* Stats grid */}
        <View style={s.statsGrid}>
          {/* Goal */}
          <TouchableOpacity style={s.statCard} onPress={() => openPicker('goal')} activeOpacity={0.75}>
            <Text style={s.statLabel}>Sleep Goal</Text>
            <Text style={s.statValue}>{sleepGoal}h</Text>
            <Text style={s.statUnit}>tap to change</Text>
          </TouchableOpacity>

          {/* 7-day avg */}
          <View style={s.statCard}>
            <Text style={s.statLabel}>7-Day Average</Text>
            <Text style={[s.statValue, { color: avg7 >= sleepGoal ? '#30D158' : '#FF453A' }]}>{avg7.toFixed(1)}h</Text>
            <Text style={[s.statUnit, { color: avg7 >= sleepGoal ? '#30D158' : '#FF453A' }]}>{avg7 >= sleepGoal ? '✓ On track' : '⚠ Below goal'}</Text>
          </View>

          {/* Streak */}
          <View style={s.statCard}>
            <Text style={s.statLabel}>Goal Streak</Text>
            <Text style={[s.statValue, { color: '#FF9F0A' }]}>{streak}</Text>
            <Text style={s.statUnit}>days</Text>
          </View>

          {/* Sleep debt */}
          <View style={s.statCard}>
            <Text style={s.statLabel}>Sleep Debt</Text>
            <Text style={[s.statValue, { color: sleepDebt > 0 ? '#FF453A' : '#30D158' }]}>
              {sleepDebt > 0 ? '+' : ''}{sleepDebt.toFixed(1)}h
            </Text>
            <Text style={s.statUnit}>last 7 days</Text>
          </View>
        </View>

        {/* Today's log */}
        {todayLog ? (
          <View style={s.todayCard}>
            <Text style={s.todayTitle}>💤 Last Night's Sleep</Text>
            <View style={s.todayRow}>
              <Text style={s.todayLabel}>Duration</Text>
              <Text style={[s.todayValue, { color: todayLog.duration >= goalMins ? '#30D158' : '#FF453A' }]}>
                {formatDuration(todayLog.duration)}
              </Text>
            </View>
            <View style={s.todayRow}>
              <Text style={s.todayLabel}>Bedtime → Wake</Text>
              <Text style={s.todayValue}>{formatTime12(todayLog.bedtime)} → {formatTime12(todayLog.wakeTime)}</Text>
            </View>
            <View style={s.todayRow}>
              <Text style={s.todayLabel}>Quality</Text>
              <Stars rating={todayLog.quality} />
            </View>
          </View>
        ) : null}

        {/* Log button */}
        {!showForm && (
          <TouchableOpacity style={s.logBtn} onPress={() => setShowForm(true)}>
            <Text style={s.logBtnText}>+ Log Sleep</Text>
          </TouchableOpacity>
        )}

        {/* Form */}
        {showForm && (
          <View style={s.form}>
            <Text style={s.formTitle}>Log Sleep</Text>

            <View style={s.formRow}>
              <View style={s.formField}>
                <Text style={s.formLabel}>Bedtime</Text>
                <TouchableOpacity style={s.timeBtn} onPress={() => openPicker('bedtime')}>
                  <Text style={s.timeBtnText}>🌙 {formatTime12(formBedtime)}</Text>
                </TouchableOpacity>
              </View>
              <View style={s.formField}>
                <Text style={s.formLabel}>Wake Time</Text>
                <TouchableOpacity style={s.timeBtn} onPress={() => openPicker('waketime')}>
                  <Text style={s.timeBtnText}>🌅 {formatTime12(formWakeTime)}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={s.durationPreview}>Duration: {formatDuration(duration)}</Text>

            <Text style={s.formLabel}>Sleep Quality</Text>
            <Stars rating={formQuality} onPress={setFormQuality} />

            <View style={s.formBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowForm(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
                <Text style={s.saveBtnText}>Save Log</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Trends */}
        <Text style={s.sectionTitle}>📊 Trends</Text>
        <View style={s.trendsGrid}>
          <View style={s.trendCard}>
            <Text style={s.trendLabel}>30-Day Average</Text>
            <Text style={s.trendValue}>{avg30.toFixed(1)}h</Text>
          </View>
          <View style={s.trendCard}>
            <Text style={s.trendLabel}>Avg Quality</Text>
            <Text style={s.trendValue}>{avgQuality.toFixed(1)} / 5</Text>
          </View>
          <View style={s.trendCard}>
            <Text style={s.trendLabel}>Total Nights</Text>
            <Text style={s.trendValue}>{logs.length}</Text>
          </View>
          <View style={s.trendCard}>
            <Text style={s.trendLabel}>Consistency</Text>
            <Text style={s.trendValue}>{last7.length}/7 days</Text>
          </View>
        </View>

        {/* History */}
        <Text style={s.sectionTitle}>📅 History</Text>
        {logs.length === 0 ? (
          <Text style={s.emptyText}>No sleep logs yet. Start tracking!</Text>
        ) : (
          sorted.map(log => {
            const meetsGoal = log.duration >= goalMins;
            return (
              <View key={log.id} style={[s.historyItem, meetsGoal && s.historyItemGood]}>
                <View style={s.historyTop}>
                  <Text style={s.historyDate}>{formatDisplayDate(log.date)}</Text>
                  <TouchableOpacity onPress={() => handleDelete(log.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={s.deleteText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.historyDetails}>
                  <Text style={s.historyTime}>🌙 {formatTime12(log.bedtime)} → 🌅 {formatTime12(log.wakeTime)}</Text>
                  <View style={[s.durationBadge, { backgroundColor: meetsGoal ? 'rgba(48,209,88,0.15)' : 'rgba(255,69,58,0.15)' }]}>
                    <Text style={[s.durationBadgeText, { color: meetsGoal ? '#30D158' : '#FF453A' }]}>{formatDuration(log.duration)}</Text>
                  </View>
                </View>
                <Stars rating={log.quality} />
              </View>
            );
          })
        )}

        {/* Tips */}
        <View style={s.tipsCard}>
          <Text style={s.tipsTitle}>💡 Sleep Tips</Text>
          {[
            { bold: 'Consistency:', text: 'Same bedtime and wake time every day' },
            { bold: 'Wind down:', text: 'Avoid screens 1 hour before bed' },
            { bold: 'Environment:', text: 'Cool, dark, and quiet bedroom' },
            { bold: 'Caffeine:', text: 'No caffeine after 2 PM' },
            { bold: 'Exercise:', text: 'Regular activity improves sleep quality' },
          ].map(tip => (
            <Text key={tip.bold} style={s.tipText}>
              <Text style={s.tipBold}>{tip.bold}</Text>{' '}{tip.text}
            </Text>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Time/Goal Picker Modal */}
      {pickerTarget !== null && (
        <Modal transparent animationType="fade" onRequestClose={() => setPickerTarget(null)}>
          <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={() => setPickerTarget(null)}>
            <View style={s.pickerCard}>
              <Text style={s.pickerTitle}>
                {pickerTarget === 'bedtime' ? '🌙 Bedtime' : pickerTarget === 'waketime' ? '🌅 Wake Time' : '🎯 Sleep Goal'}
              </Text>
              <DateTimePicker
                value={pickerDate}
                mode="time"
                display="spinner"
                onChange={handlePickerChange}
                textColor="#FFFFFF"
                themeVariant="dark"
                minuteInterval={pickerTarget === 'goal' ? 30 : 5}
              />
              <TouchableOpacity style={s.pickerDone} onPress={() => setPickerTarget(null)}>
                <Text style={s.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 14, color: '#636366', marginTop: 4 },

  // Stats grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    width: '47.5%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statLabel: { fontSize: 12, color: '#636366', marginBottom: 4 },
  statValue: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
  statUnit: { fontSize: 11, color: '#636366', marginTop: 2 },

  // Today card
  todayCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 10,
  },
  todayTitle: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginBottom: 4 },
  todayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  todayLabel: { fontSize: 14, color: '#636366' },
  todayValue: { fontSize: 14, color: '#EBEBF5', fontWeight: '500' },

  // Log button
  logBtn: {
    backgroundColor: '#1877F2',
    borderRadius: 16,
    padding: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  logBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Form
  form: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 12,
  },
  formTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  formRow: { flexDirection: 'row', gap: 10 },
  formField: { flex: 1, gap: 6 },
  formLabel: { fontSize: 13, color: '#636366', marginBottom: 4 },
  timeBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  timeBtnText: { color: '#EBEBF5', fontSize: 14, fontWeight: '500', textAlign: 'center' },
  durationPreview: { fontSize: 14, color: '#1877F2', fontWeight: '600', textAlign: 'center' },
  formBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 13, alignItems: 'center' },
  cancelBtnText: { color: '#636366', fontWeight: '600', fontSize: 15 },
  saveBtn: { flex: 1, backgroundColor: '#1877F2', borderRadius: 12, padding: 13, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Trends
  sectionTitle: { fontSize: 17, fontWeight: '600', color: '#EBEBF5', marginBottom: 12 },
  trendsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  trendCard: {
    width: '47.5%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  trendLabel: { fontSize: 12, color: '#636366', marginBottom: 6 },
  trendValue: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },

  // History
  emptyText: { fontSize: 14, color: '#48484A', textAlign: 'center', paddingVertical: 20 },
  historyItem: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  historyItemGood: { borderColor: 'rgba(48,209,88,0.25)', backgroundColor: 'rgba(48,209,88,0.06)' },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyDate: { fontSize: 14, fontWeight: '600', color: '#EBEBF5' },
  deleteText: { color: '#48484A', fontSize: 16 },
  historyDetails: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyTime: { flex: 1, fontSize: 13, color: '#636366' },
  durationBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  durationBadgeText: { fontSize: 13, fontWeight: '700' },

  // Tips
  tipsCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  tipsTitle: { fontSize: 14, fontWeight: '700', color: '#636366', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  tipText: { fontSize: 13, color: '#636366', lineHeight: 18 },
  tipBold: { color: '#EBEBF5', fontWeight: '600' },

  // Picker modal
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  pickerCard: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  pickerTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginBottom: 8 },
  pickerDone: { backgroundColor: '#1877F2', borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 8 },
  pickerDoneText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
