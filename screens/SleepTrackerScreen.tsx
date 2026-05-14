import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User } from '@supabase/supabase-js';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ARC_SIZE = Math.min(SCREEN_WIDTH - 80, 280);
const ARC_RADIUS = (ARC_SIZE / 2) - 18;
const SEGMENTS = 60; // number of dots around the ring

// Purple theme palette
const P = {
  bg:         '#0D0B1E',
  bgCard:     '#16133A',
  surface:    'rgba(124,58,237,0.12)',
  surfaceDim: 'rgba(124,58,237,0.06)',
  border:     'rgba(139,92,246,0.22)',
  borderDim:  'rgba(139,92,246,0.12)',
  accent:     '#8B5CF6',
  accentBright:'#A78BFA',
  accentDark: '#6D28D9',
  text:       '#FFFFFF',
  textSub:    '#C4B5FD',
  textMuted:  '#6D5FA0',
  success:    '#34D399',
  danger:     '#F87171',
  warn:       '#FBBF24',
};

function getKeys(userEmail: string) {
  const ns = userEmail || 'guest';
  return {
    SLEEP_LOGS_KEY: `zentask:sleep_logs:${ns}`,
    SLEEP_GOAL_KEY: `zentask:sleep_goal:${ns}`,
  };
}

const DEFAULT_GOAL = 8;

interface SleepLog {
  id: string;
  date: string;
  bedtime: string;
  wakeTime: string;
  duration: number;
  quality: number;
}

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function calcDuration(bedtime: string, wakeTime: string): number {
  const [bh, bm] = bedtime.split(':').map(Number);
  const [wh, wm] = wakeTime.split(':').map(Number);
  let bedMins = bh * 60 + bm;
  let wakeMins = wh * 60 + wm;
  if (wakeMins <= bedMins) wakeMins += 24 * 60;
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

function formatDisplay24(hhmm: string): string {
  return hhmm; // keep 24h for the hero display like the reference
}

function formatDisplayDate(dateStr: string): string {
  const today = getTodayStr();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  if (dateStr === today) return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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

// Segmented dot ring arc — pure RN, no SVG dependency
function SleepArc({ durationMins, goalMins }: { durationMins: number; goalMins: number }) {
  const pct = goalMins > 0 ? Math.min(durationMins / goalMins, 1) : 0;
  const filledCount = Math.round(pct * SEGMENTS);
  const cx = ARC_SIZE / 2;
  const cy = ARC_SIZE / 2;
  const startDeg = -210; // start top-left, sweep clockwise ~300°

  return (
    <View style={{ width: ARC_SIZE, height: ARC_SIZE }}>
      {Array.from({ length: SEGMENTS }).map((_, i) => {
        const angleDeg = startDeg + (i / SEGMENTS) * 300;
        const angleRad = (angleDeg * Math.PI) / 180;
        const x = cx + ARC_RADIUS * Math.cos(angleRad);
        const y = cy + ARC_RADIUS * Math.sin(angleRad);
        const filled = i < filledCount;
        // Gradient: early segments darker purple, later brighter
        const t = i / SEGMENTS;
        const dotColor = filled
          ? `rgba(${Math.round(109 + t * 80)}, ${Math.round(40 + t * 60)}, 246, 1)`
          : 'rgba(139,92,246,0.15)';
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: filled ? 6 : 4,
              height: filled ? 6 : 4,
              borderRadius: 3,
              backgroundColor: dotColor,
              left: x - (filled ? 3 : 2),
              top: y - (filled ? 3 : 2),
            }}
          />
        );
      })}
      {/* Moon icon at start */}
      <View style={[s.arcEndDot, { left: cx + ARC_RADIUS * Math.cos((startDeg * Math.PI) / 180) - 16, top: cy + ARC_RADIUS * Math.sin((startDeg * Math.PI) / 180) - 16 }]}>
        <Text style={{ fontSize: 18 }}>🌙</Text>
      </View>
      {/* Alarm icon at end of fill */}
      {durationMins > 0 && (
        <View style={[s.arcEndDot, (() => {
          const endDeg = startDeg + pct * 300;
          const endRad = (endDeg * Math.PI) / 180;
          return { left: cx + ARC_RADIUS * Math.cos(endRad) - 16, top: cy + ARC_RADIUS * Math.sin(endRad) - 16, backgroundColor: P.accent };
        })()]}>
          <Text style={{ fontSize: 16 }}>⏰</Text>
        </View>
      )}
    </View>
  );
}

function Stars({ rating, onPress }: { rating: number; onPress?: (r: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <TouchableOpacity key={s} onPress={() => onPress?.(s)} disabled={!onPress} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
          <Text style={{ fontSize: 18, color: s <= rating ? P.warn : P.textMuted }}>★</Text>
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

  const [formBedtime, setFormBedtime] = useState('22:00');
  const [formWakeTime, setFormWakeTime] = useState('06:00');
  const [formQuality, setFormQuality] = useState(3);
  const [pickerTarget, setPickerTarget] = useState<'bedtime' | 'waketime' | 'goal' | null>(null);
  const [pickerDate, setPickerDate] = useState(new Date());

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

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(SLEEP_LOGS_KEY, JSON.stringify(logs)).catch(console.error);
  }, [logs, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(SLEEP_GOAL_KEY, String(sleepGoal)).catch(console.error);
  }, [sleepGoal, loaded]);

  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  const last7 = sorted.slice(0, 7);
  const last30 = sorted.slice(0, 30);

  const avg7 = last7.length > 0 ? last7.reduce((s, l) => s + l.duration, 0) / last7.length / 60 : 0;
  const avg30 = last30.length > 0 ? last30.reduce((s, l) => s + l.duration, 0) / last30.length / 60 : 0;
  const avgQuality = logs.length > 0 ? logs.reduce((s, l) => s + l.quality, 0) / logs.length : 0;
  const sleepDebt = last7.reduce((debt, l) => debt + (sleepGoal * 60 - l.duration), 0) / 60;

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
  const heroLog = todayLog ?? sorted[0] ?? null;
  const heroDuration = heroLog ? heroLog.duration : 0;
  const goalMins = sleepGoal * 60;

  const openPicker = (target: 'bedtime' | 'waketime' | 'goal') => {
    if (target === 'bedtime') setPickerDate(timeStringToDate(formBedtime));
    else if (target === 'waketime') setPickerDate(timeStringToDate(formWakeTime));
    else {
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
    setLogs(prev => prev.filter(l => l.id !== id));
  };

  const formDuration = calcDuration(formBedtime, formWakeTime);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Sleep</Text>
            <Text style={s.subtitle}>Track your rest & recovery</Text>
          </View>
          <Text style={s.moonIcon}>🌙</Text>
        </View>

        {/* Hero: bedtime / wake row */}
        {heroLog ? (
          <View style={s.heroTimeRow}>
            <View style={s.heroTimeBlock}>
              <Text style={s.heroTimeLabel}>🌙  Bedtime</Text>
              <Text style={s.heroTime}>{formatDisplay24(heroLog.bedtime)}</Text>
            </View>
            <View style={s.heroTimeDivider} />
            <View style={s.heroTimeBlock}>
              <Text style={s.heroTimeLabel}>🌅  Wake Up</Text>
              <Text style={s.heroTime}>{formatDisplay24(heroLog.wakeTime)}</Text>
            </View>
          </View>
        ) : (
          <View style={s.heroTimeRow}>
            <Text style={s.heroEmptyHint}>Log your first sleep below ↓</Text>
          </View>
        )}

        {/* Arc visual */}
        <View style={s.arcWrapper}>
          <SleepArc durationMins={heroDuration} goalMins={goalMins} />
          <View style={s.arcCenter}>
            <Text style={s.arcLabel}>Sleep Duration</Text>
            <Text style={s.arcDuration}>{heroDuration > 0 ? formatDuration(heroDuration) : '--'}</Text>
            <Text style={s.arcGoal}>Goal: {sleepGoal}h</Text>
          </View>
          {/* Decorative stars */}
          <Text style={[s.star, { top: 10, right: 40 }]}>✦</Text>
          <Text style={[s.star, { top: 60, right: 10 }]}>✦</Text>
          <Text style={[s.star, { bottom: 30, right: 20 }]}>✦</Text>
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          <TouchableOpacity style={s.statPill} onPress={() => openPicker('goal')} activeOpacity={0.75}>
            <Text style={s.statPillLabel}>Goal</Text>
            <Text style={s.statPillValue}>{sleepGoal}h</Text>
          </TouchableOpacity>
          <View style={s.statPill}>
            <Text style={s.statPillLabel}>7-Day Avg</Text>
            <Text style={[s.statPillValue, { color: avg7 >= sleepGoal ? P.success : P.danger }]}>{avg7 > 0 ? avg7.toFixed(1) + 'h' : '--'}</Text>
          </View>
          <View style={s.statPill}>
            <Text style={s.statPillLabel}>Streak</Text>
            <Text style={[s.statPillValue, { color: P.warn }]}>{streak}d</Text>
          </View>
          <View style={s.statPill}>
            <Text style={s.statPillLabel}>Debt</Text>
            <Text style={[s.statPillValue, { color: sleepDebt > 0 ? P.danger : P.success }]}>
              {sleepDebt > 0 ? '+' : ''}{Math.abs(sleepDebt).toFixed(1)}h
            </Text>
          </View>
        </View>

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
                  <Text style={s.timeBtnIcon}>🌙</Text>
                  <Text style={s.timeBtnText}>{formatDisplay24(formBedtime)}</Text>
                </TouchableOpacity>
              </View>
              <View style={s.formField}>
                <Text style={s.formLabel}>Wake Time</Text>
                <TouchableOpacity style={s.timeBtn} onPress={() => openPicker('waketime')}>
                  <Text style={s.timeBtnIcon}>🌅</Text>
                  <Text style={s.timeBtnText}>{formatDisplay24(formWakeTime)}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={s.durationPreviewRow}>
              <Text style={s.durationPreviewLabel}>Duration</Text>
              <Text style={s.durationPreviewValue}>{formatDuration(formDuration)}</Text>
            </View>

            <Text style={s.formLabel}>Sleep Quality</Text>
            <Stars rating={formQuality} onPress={setFormQuality} />

            <View style={s.formBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowForm(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
                <Text style={s.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Trends */}
        <Text style={s.sectionTitle}>Trends</Text>
        <View style={s.trendsGrid}>
          {[
            { label: '30-Day Avg', value: avg30 > 0 ? avg30.toFixed(1) + 'h' : '--' },
            { label: 'Avg Quality', value: avgQuality > 0 ? avgQuality.toFixed(1) + ' / 5' : '--' },
            { label: 'Total Nights', value: String(logs.length) },
            { label: 'Consistency', value: `${last7.length}/7 days` },
          ].map(t => (
            <View key={t.label} style={s.trendCard}>
              <Text style={s.trendLabel}>{t.label}</Text>
              <Text style={s.trendValue}>{t.value}</Text>
            </View>
          ))}
        </View>

        {/* History */}
        <Text style={s.sectionTitle}>History</Text>
        {logs.length === 0 ? (
          <Text style={s.emptyText}>No sleep logs yet — start tracking tonight.</Text>
        ) : (
          sorted.map(log => {
            const meetsGoal = log.duration >= goalMins;
            return (
              <View key={log.id} style={[s.historyItem, meetsGoal && s.historyItemGood]}>
                <View style={s.historyTop}>
                  <Text style={s.historyDate}>{formatDisplayDate(log.date)}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[s.durationBadge, { backgroundColor: meetsGoal ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)' }]}>
                      <Text style={[s.durationBadgeText, { color: meetsGoal ? P.success : P.danger }]}>{formatDuration(log.duration)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDelete(log.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={s.deleteText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={s.historyTime}>🌙 {formatTime12(log.bedtime)}  →  🌅 {formatTime12(log.wakeTime)}</Text>
                <Stars rating={log.quality} />
              </View>
            );
          })
        )}

        {/* Tips */}
        <View style={s.tipsCard}>
          <Text style={s.tipsTitle}>Sleep Tips</Text>
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
  container: { flex: 1, backgroundColor: P.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 32, fontWeight: '800', color: P.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: P.textMuted, marginTop: 2 },
  moonIcon: { fontSize: 32, marginTop: 4 },

  // Hero time display
  heroTimeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: P.surface, borderRadius: 20, borderWidth: 1, borderColor: P.border,
    padding: 18, marginBottom: 20, gap: 16,
  },
  heroTimeBlock: { flex: 1, alignItems: 'center', gap: 4 },
  heroTimeLabel: { fontSize: 12, color: P.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroTime: { fontSize: 34, fontWeight: '800', color: P.text, letterSpacing: 1 },
  heroTimeDivider: { width: 1, height: 48, backgroundColor: P.border },
  heroEmptyHint: { fontSize: 14, color: P.textMuted, textAlign: 'center' },

  // Arc
  arcWrapper: { alignItems: 'center', justifyContent: 'center', marginBottom: 20, position: 'relative' },
  arcCenter: { position: 'absolute', alignItems: 'center', gap: 2, pointerEvents: 'none' },
  arcEndDot: {
    position: 'absolute', width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#1E1458', alignItems: 'center', justifyContent: 'center',
  },
  arcLabel: { fontSize: 12, color: P.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  arcDuration: { fontSize: 36, fontWeight: '800', color: P.text },
  arcGoal: { fontSize: 12, color: P.textSub },
  star: { position: 'absolute', fontSize: 14, color: P.accentBright, opacity: 0.6 },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statPill: {
    flex: 1, backgroundColor: P.surface, borderRadius: 14,
    padding: 10, alignItems: 'center', borderWidth: 1, borderColor: P.border,
  },
  statPillLabel: { fontSize: 10, color: P.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 },
  statPillValue: { fontSize: 16, fontWeight: '800', color: P.text },

  // Log button
  logBtn: {
    backgroundColor: P.accent, borderRadius: 16, padding: 16,
    alignItems: 'center', marginBottom: 20,
    shadowColor: P.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12,
  },
  logBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Form
  form: {
    backgroundColor: P.bgCard, borderRadius: 20, padding: 18,
    marginBottom: 24, borderWidth: 1, borderColor: P.border, gap: 14,
  },
  formTitle: { fontSize: 18, fontWeight: '700', color: P.text },
  formRow: { flexDirection: 'row', gap: 12 },
  formField: { flex: 1, gap: 6 },
  formLabel: { fontSize: 12, color: P.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  timeBtn: {
    backgroundColor: P.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: P.border, alignItems: 'center', gap: 4,
  },
  timeBtnIcon: { fontSize: 22 },
  timeBtnText: { color: P.text, fontSize: 20, fontWeight: '700' },
  durationPreviewRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(139,92,246,0.1)', borderRadius: 12, padding: 12,
  },
  durationPreviewLabel: { fontSize: 13, color: P.textSub },
  durationPreviewValue: { fontSize: 16, fontWeight: '700', color: P.accentBright },
  formBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, backgroundColor: P.surfaceDim, borderRadius: 12, padding: 13, alignItems: 'center', borderWidth: 1, borderColor: P.borderDim },
  cancelBtnText: { color: P.textMuted, fontWeight: '600', fontSize: 15 },
  saveBtn: { flex: 1, backgroundColor: P.accent, borderRadius: 12, padding: 13, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Trends
  sectionTitle: { fontSize: 18, fontWeight: '700', color: P.text, marginBottom: 12, letterSpacing: -0.3 },
  trendsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  trendCard: {
    width: '47.5%', backgroundColor: P.surface,
    borderRadius: 16, padding: 14, borderWidth: 1, borderColor: P.border,
  },
  trendLabel: { fontSize: 11, color: P.textMuted, marginBottom: 6, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  trendValue: { fontSize: 20, fontWeight: '700', color: P.text },

  // History
  emptyText: { fontSize: 14, color: P.textMuted, textAlign: 'center', paddingVertical: 24 },
  historyItem: {
    backgroundColor: P.surfaceDim, borderRadius: 16, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: P.borderDim, gap: 8,
  },
  historyItemGood: { borderColor: 'rgba(52,211,153,0.25)', backgroundColor: 'rgba(52,211,153,0.05)' },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyDate: { fontSize: 14, fontWeight: '600', color: P.text },
  deleteText: { color: P.textMuted, fontSize: 15 },
  historyTime: { fontSize: 13, color: P.textSub },
  durationBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  durationBadgeText: { fontSize: 12, fontWeight: '700' },

  // Tips
  tipsCard: {
    backgroundColor: P.surfaceDim, borderRadius: 18, padding: 16,
    marginTop: 8, marginBottom: 8, borderWidth: 1, borderColor: P.borderDim, gap: 8,
  },
  tipsTitle: { fontSize: 12, fontWeight: '700', color: P.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  tipText: { fontSize: 13, color: P.textSub, lineHeight: 18 },
  tipBold: { color: P.text, fontWeight: '600' },

  // Picker modal
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  pickerCard: {
    backgroundColor: '#1A1535', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 36, borderWidth: 1, borderColor: P.border,
  },
  pickerTitle: { fontSize: 17, fontWeight: '700', color: P.text, textAlign: 'center', marginBottom: 8 },
  pickerDone: { backgroundColor: P.accent, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 8 },
  pickerDoneText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
