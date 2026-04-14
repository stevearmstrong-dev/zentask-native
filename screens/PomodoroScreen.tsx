import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

type PomodoroMode = 'work' | 'shortBreak' | 'longBreak';

const MODE_CONFIG: Record<PomodoroMode, { label: string; color: string; defaultMin: number }> = {
  work:       { label: 'Focus Time',   color: '#1877F2', defaultMin: 25 },
  shortBreak: { label: 'Short Break',  color: '#30D158', defaultMin: 5  },
  longBreak:  { label: 'Long Break',   color: '#FF9F0A', defaultMin: 15 },
};

const RING_SIZE = 260;
const STROKE = 10;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function PomodoroScreen() {
  const [mode, setMode] = useState<PomodoroMode>('work');
  const [workMin, setWorkMin] = useState(25);
  const [shortMin, setShortMin] = useState(5);
  const [longMin, setLongMin] = useState(15);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const totalSeconds = useCallback(() => {
    if (mode === 'work') return workMin * 60;
    if (mode === 'shortBreak') return shortMin * 60;
    return longMin * 60;
  }, [mode, workMin, shortMin, longMin]);

  // Sync animated ring with timeLeft
  useEffect(() => {
    const total = totalSeconds();
    const progress = total > 0 ? (total - timeLeft) / total : 0;
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [timeLeft, totalSeconds, progressAnim]);

  const switchMode = useCallback((newMode: PomodoroMode, durations?: { work: number; short: number; long: number }) => {
    setIsActive(false);
    setMode(newMode);
    const w = durations?.work ?? workMin;
    const s = durations?.short ?? shortMin;
    const l = durations?.long ?? longMin;
    if (newMode === 'work') setTimeLeft(w * 60);
    else if (newMode === 'shortBreak') setTimeLeft(s * 60);
    else setTimeLeft(l * 60);
  }, [workMin, shortMin, longMin]);

  const handleComplete = useCallback(() => {
    setIsActive(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (mode === 'work') {
      setSessions(prev => {
        const next = prev + 1;
        switchMode(next % 4 === 0 ? 'longBreak' : 'shortBreak');
        return next;
      });
    } else {
      switchMode('work');
    }
  }, [mode, switchMode]);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      intervalRef.current = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && isActive) {
      handleComplete();
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isActive, timeLeft, handleComplete]);

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsActive(prev => !prev);
  };

  const reset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsActive(false);
    setTimeLeft(totalSeconds());
  };

  const color = MODE_CONFIG[mode].color;

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, 0],
  });

  const handleSaveSettings = (w: number, s: number, l: number) => {
    setWorkMin(w);
    setShortMin(s);
    setLongMin(l);
    switchMode(mode, { work: w, short: s, long: l });
    setShowSettings(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>🍅 Pomodoro</Text>
        <TouchableOpacity onPress={() => setShowSettings(true)}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Mode label */}
      <Text style={[styles.modeLabel, { color }]}>{MODE_CONFIG[mode].label}</Text>

      {/* Ring timer */}
      <View style={styles.ringContainer}>
        {/* Background ring */}
        <View style={[styles.ringBg, { borderColor: color + '22', width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2, borderWidth: STROKE }]} />

        {/* Animated foreground ring using border trick */}
        <Animated.View
          style={[
            styles.ringFg,
            {
              width: RING_SIZE,
              height: RING_SIZE,
              borderRadius: RING_SIZE / 2,
              borderWidth: STROKE,
              borderColor: color,
              opacity: progressAnim.interpolate({ inputRange: [0, 0.01, 1], outputRange: [0.3, 1, 1] }),
            },
          ]}
        />

        {/* Timer text in center */}
        <View style={styles.ringCenter}>
          <Text style={[styles.timerText, { color }]}>{formatTime(timeLeft)}</Text>
          <Text style={styles.timerSubtext}>{isActive ? 'running' : 'paused'}</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.resetBtn} onPress={reset}>
          <Text style={styles.resetBtnText}>↻ Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.mainBtn, { backgroundColor: color }]} onPress={toggle}>
          <Text style={styles.mainBtnText}>{isActive ? '⏸ Pause' : '▶ Start'}</Text>
        </TouchableOpacity>
      </View>

      {/* Mode selector */}
      <View style={styles.modeRow}>
        {(Object.keys(MODE_CONFIG) as PomodoroMode[]).map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.modeTab, mode === m && { backgroundColor: MODE_CONFIG[m].color + '22', borderColor: MODE_CONFIG[m].color }]}
            onPress={() => switchMode(m)}
          >
            <Text style={[styles.modeTabText, mode === m && { color: MODE_CONFIG[m].color, fontWeight: '600' }]}>
              {m === 'work' ? 'Work' : m === 'shortBreak' ? 'Short' : 'Long'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sessions */}
      <View style={styles.sessionsCard}>
        <Text style={styles.sessionsLabel}>Sessions Today</Text>
        <View style={styles.dotsRow}>
          {Array.from({ length: Math.min(sessions, 8) }).map((_, i) => (
            <Text key={i} style={styles.dot}>🍅</Text>
          ))}
          {sessions === 0 && <Text style={styles.noDots}>No sessions yet — start focusing!</Text>}
          {sessions > 8 && <Text style={styles.moreText}>+{sessions - 8}</Text>}
        </View>
        <Text style={styles.sessionsCount}>{sessions} completed</Text>
      </View>

      {/* Settings Modal */}
      <SettingsModal
        visible={showSettings}
        workMin={workMin}
        shortMin={shortMin}
        longMin={longMin}
        onSave={handleSaveSettings}
        onClose={() => setShowSettings(false)}
      />
    </SafeAreaView>
  );
}

// Settings modal
function SettingsModal({ visible, workMin, shortMin, longMin, onSave, onClose }: {
  visible: boolean;
  workMin: number; shortMin: number; longMin: number;
  onSave: (w: number, s: number, l: number) => void;
  onClose: () => void;
}) {
  const [w, setW] = useState(String(workMin));
  const [s, setS] = useState(String(shortMin));
  const [l, setL] = useState(String(longMin));

  useEffect(() => {
    setW(String(workMin));
    setS(String(shortMin));
    setL(String(longMin));
  }, [workMin, shortMin, longMin]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={settingsStyles.container}>
        <View style={settingsStyles.header}>
          <TouchableOpacity onPress={onClose}><Text style={settingsStyles.cancel}>Cancel</Text></TouchableOpacity>
          <Text style={settingsStyles.title}>Timer Settings</Text>
          <TouchableOpacity onPress={() => onSave(Number(w) || 25, Number(s) || 5, Number(l) || 15)}>
            <Text style={settingsStyles.save}>Save</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={settingsStyles.body}>
          {[
            { label: 'Work Duration (min)', value: w, set: setW, max: 60 },
            { label: 'Short Break (min)',   value: s, set: setS, max: 30 },
            { label: 'Long Break (min)',    value: l, set: setL, max: 60 },
          ].map(row => (
            <View key={row.label} style={settingsStyles.row}>
              <Text style={settingsStyles.rowLabel}>{row.label}</Text>
              <TextInput
                style={settingsStyles.input}
                value={row.value}
                onChangeText={row.set}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  settingsIcon: { fontSize: 22 },
  modeLabel: { fontSize: 17, fontWeight: '600', textAlign: 'center', marginBottom: 24 },
  ringContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 32, height: RING_SIZE },
  ringBg: { position: 'absolute' },
  ringFg: { position: 'absolute' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  timerText: { fontSize: 64, fontWeight: '200', letterSpacing: 2 },
  timerSubtext: { fontSize: 13, color: '#636366', marginTop: 4 },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 28, paddingHorizontal: 20 },
  mainBtn: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center' },
  mainBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  resetBtn: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', width: 110 },
  resetBtnText: { color: '#EBEBF5', fontSize: 16, fontWeight: '500' },
  modeRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 28 },
  modeTab: { flex: 1, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  modeTabText: { fontSize: 13, color: '#636366', fontWeight: '500' },
  sessionsCard: { marginHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  sessionsLabel: { fontSize: 13, color: '#636366', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  dotsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8, minHeight: 30, alignItems: 'center' },
  dot: { fontSize: 22 },
  noDots: { fontSize: 14, color: '#48484A' },
  moreText: { fontSize: 14, color: '#636366', fontWeight: '600' },
  sessionsCount: { fontSize: 15, color: '#EBEBF5', fontWeight: '500' },
});

const settingsStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1C1E' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  title: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  cancel: { fontSize: 17, color: '#636366' },
  save: { fontSize: 17, fontWeight: '600', color: '#1877F2' },
  body: { flex: 1, padding: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  rowLabel: { fontSize: 15, color: '#EBEBF5' },
  input: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 8, fontSize: 16, color: '#FFFFFF', width: 60, textAlign: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
});
