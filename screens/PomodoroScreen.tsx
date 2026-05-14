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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { getTodaySessions, incrementSessions } from '../utils/pomodoroSessions';
import { User } from '@supabase/supabase-js';

type PomodoroMode = 'work' | 'shortBreak' | 'longBreak';

interface Props {
  user?: User | null;
}

const MODE_CONFIG: Record<PomodoroMode, { label: string; color: string; glow: string; defaultMin: number }> = {
  work:       { label: 'Focus',        color: '#00E5CC', glow: 'rgba(0,229,204,0.35)',  defaultMin: 25 },
  shortBreak: { label: 'Short Break',  color: '#4ADE80', glow: 'rgba(74,222,128,0.35)', defaultMin: 5  },
  longBreak:  { label: 'Long Break',   color: '#60A5FA', glow: 'rgba(96,165,250,0.35)', defaultMin: 15 },
};

const RING_SIZE = 240;
const STROKE = 12;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function PomodoroScreen({ user }: Props) {
  const userEmail = user?.email;
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
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useFocusEffect(useCallback(() => {
    getTodaySessions(userEmail).then(setSessions);
  }, [userEmail]));

  const totalSeconds = useCallback(() => {
    if (mode === 'work') return workMin * 60;
    if (mode === 'shortBreak') return shortMin * 60;
    return longMin * 60;
  }, [mode, workMin, shortMin, longMin]);

  useEffect(() => {
    const total = totalSeconds();
    const progress = total > 0 ? (total - timeLeft) / total : 0;
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [timeLeft, totalSeconds, progressAnim]);

  // Pulse glow when active
  useEffect(() => {
    if (isActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      Animated.timing(pulseAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [isActive, pulseAnim]);

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
      incrementSessions(userEmail).then(next => {
        setSessions(next);
        switchMode(next % 4 === 0 ? 'longBreak' : 'shortBreak');
      });
    } else {
      switchMode('work');
    }
  }, [mode, switchMode, userEmail]);

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

  const { color, glow } = MODE_CONFIG[mode];
  const total = totalSeconds();
  const pct = total > 0 ? ((total - timeLeft) / total) * 100 : 0;

  // Session dots — up to 8 slots
  const sessionSlots = Array.from({ length: Math.max(8, sessions) }, (_, i) => i < sessions);

  const handleSaveSettings = (w: number, s: number, l: number) => {
    setWorkMin(w);
    setShortMin(s);
    setLongMin(l);
    switchMode(mode, { work: w, short: s, long: l });
    setShowSettings(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Ambient glow blob */}
      <Animated.View style={[styles.glowBlob, { backgroundColor: glow, transform: [{ scale: pulseAnim }] }]} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Pomodoro</Text>
            <Text style={styles.subtitle}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
          </View>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowSettings(true)}>
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* Mode tabs */}
        <View style={styles.modeRow}>
          {(Object.keys(MODE_CONFIG) as PomodoroMode[]).map(m => (
            <TouchableOpacity
              key={m}
              style={[styles.modeTab, mode === m && { backgroundColor: MODE_CONFIG[m].color + '1A', borderColor: MODE_CONFIG[m].color }]}
              onPress={() => switchMode(m)}
              activeOpacity={0.75}
            >
              <Text style={[styles.modeTabText, mode === m && { color: MODE_CONFIG[m].color, fontWeight: '700' }]}>
                {m === 'work' ? 'Focus' : m === 'shortBreak' ? 'Short' : 'Long'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Ring timer card */}
        <View style={styles.ringCard}>
          <Text style={[styles.modeLabel, { color }]}>{MODE_CONFIG[mode].label}</Text>

          <Animated.View style={[styles.ringOuter, { transform: [{ scale: pulseAnim }] }]}>
            {/* Glow halo */}
            <View style={[styles.ringHalo, { backgroundColor: glow }]} />

            {/* Track ring */}
            <View style={[styles.ringTrack, { width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2, borderColor: color + '20' }]} />

            {/* Progress overlay — simple border trick, top arc */}
            <Animated.View
              style={[
                styles.ringProgress,
                {
                  width: RING_SIZE,
                  height: RING_SIZE,
                  borderRadius: RING_SIZE / 2,
                  borderColor: color,
                  shadowColor: color,
                  opacity: progressAnim.interpolate({ inputRange: [0, 0.02, 1], outputRange: [0.25, 1, 1] }),
                },
              ]}
            />

            {/* Center content */}
            <View style={styles.ringCenter}>
              <Text style={[styles.timerText, { color }]}>{formatTime(timeLeft)}</Text>
              <Text style={styles.timerStatus}>{isActive ? 'Running' : 'Paused'}</Text>
              <Text style={styles.timerPct}>{Math.round(pct)}%</Text>
            </View>
          </Animated.View>

          {/* Controls inside card */}
          <View style={styles.controls}>
            <TouchableOpacity style={styles.resetBtn} onPress={reset} activeOpacity={0.8}>
              <Ionicons name="refresh" size={18} color="#6B8A90" />
              <Text style={styles.resetBtnLabel}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mainBtn, { backgroundColor: color, shadowColor: color }]}
              onPress={toggle}
              activeOpacity={0.85}
            >
              <Text style={styles.mainBtnText}>{isActive ? '⏸  Pause' : '▶  Start'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.resetBtn} onPress={() => switchMode(mode === 'work' ? 'shortBreak' : 'work')} activeOpacity={0.8}>
              <Ionicons name="play-skip-forward" size={18} color="#FFFFFF" />
              <Text style={styles.resetBtnLabel}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color }]}>{workMin}</Text>
            <Text style={styles.statLabel}>Focus{'\n'}mins</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#4ADE80' }]}>{sessions}</Text>
            <Text style={styles.statLabel}>Sessions{'\n'}today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#60A5FA' }]}>{shortMin}</Text>
            <Text style={styles.statLabel}>Break{'\n'}mins</Text>
          </View>
        </View>

        {/* Sessions progress card */}
        <View style={styles.sessionCard}>
          <View style={styles.sessionCardHeader}>
            <Text style={styles.sessionCardTitle}>Today's Sessions</Text>
            <Text style={[styles.sessionCardCount, { color }]}>{sessions} completed</Text>
          </View>

          {/* Progress bar */}
          <View style={styles.sessionProgressTrack}>
            <Animated.View
              style={[
                styles.sessionProgressFill,
                {
                  width: `${Math.min((sessions / 8) * 100, 100)}%` as any,
                  backgroundColor: color,
                  shadowColor: color,
                },
              ]}
            />
          </View>
          <Text style={styles.sessionProgressLabel}>{sessions} of 8 daily goal</Text>

          {/* Dot indicators */}
          <View style={styles.dotsRow}>
            {Array.from({ length: 8 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.sessionDot,
                  i < sessions
                    ? { backgroundColor: color, shadowColor: color, shadowOpacity: 0.6, shadowRadius: 4, elevation: 3 }
                    : { backgroundColor: 'rgba(255,255,255,0.08)' },
                ]}
              />
            ))}
            {sessions > 8 && <Text style={styles.moreText}>+{sessions - 8}</Text>}
          </View>
        </View>

      </ScrollView>

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
      <View style={ss.container}>
        <View style={ss.header}>
          <TouchableOpacity onPress={onClose}><Text style={ss.cancel}>Cancel</Text></TouchableOpacity>
          <Text style={ss.title}>Timer Settings</Text>
          <TouchableOpacity onPress={() => onSave(Number(w) || 25, Number(s) || 5, Number(l) || 15)}>
            <Text style={ss.save}>Save</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={ss.body}>
          {[
            { label: 'Focus Duration (min)', value: w, set: setW },
            { label: 'Short Break (min)',    value: s, set: setS },
            { label: 'Long Break (min)',     value: l, set: setL },
          ].map(row => (
            <View key={row.label} style={ss.row}>
              <Text style={ss.rowLabel}>{row.label}</Text>
              <TextInput
                style={ss.input}
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
  container: { flex: 1, backgroundColor: '#080E12' },
  scroll: { paddingBottom: 40 },

  // Ambient glow
  glowBlob: {
    position: 'absolute',
    width: 320, height: 320, borderRadius: 160,
    top: -80, alignSelf: 'center',
    opacity: 0.18,
  },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#3A5A60', marginTop: 2 },
  settingsBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  settingsIcon: { fontSize: 18, color: '#6B8A90' },

  // Mode tabs
  modeRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 20 },
  modeTab: {
    flex: 1, paddingVertical: 10, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)',
  },
  modeTabText: { fontSize: 13, color: '#3A5A60', fontWeight: '500' },

  // Ring card — neumorphic dark card from reference
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

  ringOuter: { alignItems: 'center', justifyContent: 'center', width: RING_SIZE, height: RING_SIZE, marginBottom: 28 },
  ringHalo: {
    position: 'absolute',
    width: RING_SIZE + 40, height: RING_SIZE + 40,
    borderRadius: (RING_SIZE + 40) / 2,
    opacity: 0.15,
  },
  ringTrack: {
    position: 'absolute',
    borderWidth: STROKE,
  },
  ringProgress: {
    position: 'absolute',
    borderWidth: STROKE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 6,
  },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  timerText: { fontSize: 58, fontWeight: '200', letterSpacing: 3 },
  timerStatus: { fontSize: 12, color: '#3A5A60', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 },
  timerPct: { fontSize: 13, color: '#3A5A60', marginTop: 2 },

  // Controls
  controls: { flexDirection: 'row', alignItems: 'center', gap: 16, width: '100%', justifyContent: 'center' },
  mainBtn: {
    flex: 1, borderRadius: 18, paddingVertical: 16,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  mainBtnText: { color: '#000', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  resetBtn: {
    width: 60, height: 60, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    gap: 2,
  },
  resetBtnText: { fontSize: 18, color: '#6B8A90' },
  resetBtnLabel: { fontSize: 9, color: '#3A5A60', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Stats row
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: '#0D1C22', borderRadius: 20, padding: 16,
    alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  statValue: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: '#3A5A60', textAlign: 'center', marginTop: 4, lineHeight: 15 },

  // Session card
  sessionCard: {
    marginHorizontal: 20,
    backgroundColor: '#0D1C22', borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 5,
  },
  sessionCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sessionCardTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.5 },
  sessionCardCount: { fontSize: 13, fontWeight: '700' },
  sessionProgressTrack: {
    height: 8, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 4,
    overflow: 'hidden', marginBottom: 6,
  },
  sessionProgressFill: {
    height: '100%', borderRadius: 4,
    shadowOffset: { width: 0, height: 0 }, shadowRadius: 6, elevation: 3,
  },
  sessionProgressLabel: { fontSize: 11, color: '#3A5A60', marginBottom: 14 },
  dotsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  sessionDot: { width: 28, height: 28, borderRadius: 8 },
  moreText: { fontSize: 13, color: '#3A5A60', fontWeight: '600', alignSelf: 'center' },
});

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080E12' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  cancel: { fontSize: 17, color: '#3A5A60' },
  save: { fontSize: 17, fontWeight: '700', color: '#00E5CC' },
  body: { flex: 1, padding: 20 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#0D1C22', borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  rowLabel: { fontSize: 15, color: '#CCDDDD' },
  input: {
    backgroundColor: 'rgba(0,229,204,0.08)', borderRadius: 10, padding: 10,
    fontSize: 18, color: '#00E5CC', width: 64, textAlign: 'center',
    borderWidth: 1, borderColor: 'rgba(0,229,204,0.2)', fontWeight: '700',
  },
});
