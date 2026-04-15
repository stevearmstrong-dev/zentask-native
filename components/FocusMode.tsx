import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Task } from '../types';

const PRIORITY_COLOR: Record<string, string> = {
  high: '#FF453A', medium: '#FF9F0A', low: '#30D158',
};

const WORK_SECS  = 25 * 60;
const BREAK_SECS = 5  * 60;

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

interface Props {
  visible: boolean;
  task: Task | null;
  onClose: () => void;
  onComplete: (id: number) => void;
  onUpdateTime: (id: number, data: Partial<Task>) => void;
}

export default function FocusMode({ visible, task, onClose, onComplete, onUpdateTime }: Props) {
  const [mode, setMode] = useState<'timer' | 'pomodoro'>('timer');

  // Time tracking
  const [timeSpent, setTimeSpent]       = useState(0);
  const [isTracking, setIsTracking]     = useState(false);
  const timeSpentRef                    = useRef(0);
  const timerRef                        = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pomodoro
  const [pomodoroTime, setPomodoroTime]   = useState(WORK_SECS);
  const [pomodoroMode, setPomodoroMode]   = useState<'work' | 'break'>('work');
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const pomodoroModeRef                   = useRef<'work' | 'break'>('work');
  const pomodoroRef                       = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulse animation for running timer
  const pulse = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef<Animated.CompositeAnimation | null>(null);

  // Sync refs
  useEffect(() => { timeSpentRef.current = timeSpent; }, [timeSpent]);
  useEffect(() => { pomodoroModeRef.current = pomodoroMode; }, [pomodoroMode]);

  // Restore task state when modal opens
  useEffect(() => {
    if (!visible || !task) return;
    setTimeSpent(task.timeSpent ?? 0);
    timeSpentRef.current = task.timeSpent ?? 0;
    setPomodoroTime(task.pomodoroTime ?? WORK_SECS);
    setPomodoroMode(task.pomodoroMode ?? 'work');
    pomodoroModeRef.current = task.pomodoroMode ?? 'work';
    setIsTracking(false);
    setPomodoroRunning(false);
    setMode('timer');
  }, [visible, task?.id]);

  // Pulse animation while any timer runs
  useEffect(() => {
    const running = isTracking || pomodoroRunning;
    if (running) {
      pulseAnim.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.06, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,    duration: 600, useNativeDriver: true }),
        ])
      );
      pulseAnim.current.start();
    } else {
      pulseAnim.current?.stop();
      pulse.setValue(1);
    }
    return () => pulseAnim.current?.stop();
  }, [isTracking, pomodoroRunning]);

  // Cleanup on unmount / close
  useEffect(() => {
    if (!visible) {
      timerRef.current && clearInterval(timerRef.current);
      pomodoroRef.current && clearInterval(pomodoroRef.current);
      setIsTracking(false);
      setPomodoroRunning(false);
    }
  }, [visible]);

  // Save helper
  const save = useCallback((extra?: Partial<Task>) => {
    if (!task) return;
    onUpdateTime(task.id as number, {
      timeSpent: timeSpentRef.current,
      isTracking: false,
      trackingStartTime: null,
      ...extra,
    });
  }, [task, onUpdateTime]);

  // --- Time tracking ---
  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      timeSpentRef.current += 1;
      setTimeSpent(timeSpentRef.current);
    }, 1000);
    setIsTracking(true);
  }, []);

  const stopTimer = useCallback(() => {
    timerRef.current && clearInterval(timerRef.current);
    setIsTracking(false);
    save();
  }, [save]);

  const toggleTracking = useCallback(() => {
    if (isTracking) stopTimer();
    else startTimer();
  }, [isTracking, startTimer, stopTimer]);

  const resetTimer = useCallback(() => {
    timerRef.current && clearInterval(timerRef.current);
    setIsTracking(false);
    setTimeSpent(0);
    timeSpentRef.current = 0;
    save({ timeSpent: 0 });
  }, [save]);

  // --- Pomodoro ---
  const startPomodoro = useCallback(() => {
    pomodoroRef.current = setInterval(() => {
      setPomodoroTime(prev => {
        if (prev <= 1) {
          // Switch modes
          const next = pomodoroModeRef.current === 'work' ? 'break' : 'work';
          pomodoroModeRef.current = next;
          setPomodoroMode(next);
          return next === 'work' ? WORK_SECS : BREAK_SECS;
        }
        // Only add to timeSpent during work sessions
        if (pomodoroModeRef.current === 'work') {
          timeSpentRef.current += 1;
          setTimeSpent(timeSpentRef.current);
        }
        return prev - 1;
      });
    }, 1000);
    setPomodoroRunning(true);
  }, []);

  const stopPomodoro = useCallback(() => {
    pomodoroRef.current && clearInterval(pomodoroRef.current);
    setPomodoroRunning(false);
    save({ pomodoroTime, pomodoroMode });
  }, [save, pomodoroTime, pomodoroMode]);

  const togglePomodoro = useCallback(() => {
    if (pomodoroRunning) stopPomodoro();
    else startPomodoro();
  }, [pomodoroRunning, startPomodoro, stopPomodoro]);

  const resetPomodoro = useCallback(() => {
    pomodoroRef.current && clearInterval(pomodoroRef.current);
    setPomodoroRunning(false);
    setPomodoroTime(WORK_SECS);
    setPomodoroMode('work');
    pomodoroModeRef.current = 'work';
  }, []);

  // --- Switch mode ---
  const switchMode = useCallback((next: 'timer' | 'pomodoro') => {
    // Stop whatever is running
    timerRef.current && clearInterval(timerRef.current);
    pomodoroRef.current && clearInterval(pomodoroRef.current);
    setIsTracking(false);
    setPomodoroRunning(false);

    if (next === 'pomodoro') {
      // Carry over elapsed time — subtract from the 25-min work session
      const remaining = Math.max(0, WORK_SECS - timeSpentRef.current);
      setPomodoroTime(remaining);
      setPomodoroMode('work');
      pomodoroModeRef.current = 'work';
    }

    setMode(next);
  }, []);

  // --- Close / complete ---
  const handleClose = useCallback(() => {
    timerRef.current && clearInterval(timerRef.current);
    pomodoroRef.current && clearInterval(pomodoroRef.current);
    save({ pomodoroTime, pomodoroMode });
    onClose();
  }, [save, pomodoroTime, pomodoroMode, onClose]);

  const handleComplete = useCallback(() => {
    timerRef.current && clearInterval(timerRef.current);
    pomodoroRef.current && clearInterval(pomodoroRef.current);
    save({ pomodoroTime, pomodoroMode });
    if (task) onComplete(task.id as number);
    onClose();
  }, [save, pomodoroTime, pomodoroMode, task, onComplete, onClose]);

  if (!task) return null;

  const priorityColor = PRIORITY_COLOR[task.priority] ?? '#636366';
  const pomodoroProgress = mode === 'pomodoro'
    ? 1 - pomodoroTime / (pomodoroMode === 'work' ? WORK_SECS : BREAK_SECS)
    : 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>

        {/* Top bar */}
        <View style={s.topBar}>
          <TouchableOpacity onPress={handleClose} style={s.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={s.focusLabel}>FOCUS MODE</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Priority + category */}
        <View style={s.tagsRow}>
          <View style={[s.priorityBadge, { backgroundColor: priorityColor + '22', borderColor: priorityColor + '55' }]}>
            <Text style={[s.priorityText, { color: priorityColor }]}>{task.priority.toUpperCase()}</Text>
          </View>
          {task.category ? (
            <View style={s.categoryBadge}>
              <Text style={s.categoryText}>{task.category}</Text>
            </View>
          ) : null}
        </View>

        {/* Task title */}
        <Text style={s.taskTitle} numberOfLines={4}>{task.text}</Text>

        {/* Due date */}
        {task.dueDate && (
          <Text style={s.dueDate}>
            📅 {new Date(task.dueDate + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
            {task.dueTime ? ` at ${task.dueTime}` : ''}
          </Text>
        )}

        {/* Mode toggle */}
        <View style={s.modeToggle}>
          <TouchableOpacity
            style={[s.modeBtn, mode === 'timer' && s.modeBtnActive]}
            onPress={() => switchMode('timer')}
          >
            <Text style={[s.modeBtnText, mode === 'timer' && s.modeBtnTextActive]}>⏱️ Timer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.modeBtn, mode === 'pomodoro' && s.modeBtnActive]}
            onPress={() => switchMode('pomodoro')}
          >
            <Text style={[s.modeBtnText, mode === 'pomodoro' && s.modeBtnTextActive]}>🍅 Pomodoro</Text>
          </TouchableOpacity>
        </View>

        {/* Timer display */}
        <View style={s.timerSection}>
          {mode === 'timer' ? (
            <>
              <Animated.Text style={[s.timerDisplay, { transform: [{ scale: pulse }] }, isTracking && { color: '#30D158' }]}>
                {formatTime(timeSpent)}
              </Animated.Text>
              <Text style={s.timerSubLabel}>time spent</Text>
              <View style={s.timerActions}>
                <TouchableOpacity
                  style={[s.timerBtn, isTracking && s.timerBtnPause]}
                  onPress={toggleTracking}
                >
                  <Text style={s.timerBtnText}>{isTracking ? '⏸ Pause' : timeSpent > 0 ? '▶ Resume' : '▶ Start'}</Text>
                </TouchableOpacity>
                {timeSpent > 0 && !isTracking && (
                  <TouchableOpacity style={s.resetBtn} onPress={resetTimer}>
                    <Text style={s.resetBtnText}>↺ Reset</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : (
            <>
              <View style={s.pomodoroLabelRow}>
                <View style={[s.pomodoroDot, { backgroundColor: pomodoroMode === 'work' ? '#FF453A' : '#30D158' }]} />
                <Text style={s.pomodoroModeLabel}>{pomodoroMode === 'work' ? 'Work Session' : 'Break Time'}</Text>
              </View>
              <Animated.Text style={[s.timerDisplay, { transform: [{ scale: pulse }] },
                pomodoroRunning && { color: pomodoroMode === 'work' ? '#FF453A' : '#30D158' }]}>
                {formatTime(pomodoroTime)}
              </Animated.Text>
              {/* Progress bar */}
              <View style={s.pomodoroBar}>
                <View style={[s.pomodoroBarFill, {
                  width: `${pomodoroProgress * 100}%` as any,
                  backgroundColor: pomodoroMode === 'work' ? '#FF453A' : '#30D158',
                }]} />
              </View>
              <Text style={s.timerSubLabel}>
                {pomodoroMode === 'work' ? '25 min work' : '5 min break'} · {formatTime(timeSpent)} total
              </Text>
              <View style={s.timerActions}>
                <TouchableOpacity
                  style={[s.timerBtn, pomodoroRunning && s.timerBtnPause]}
                  onPress={togglePomodoro}
                >
                  <Text style={s.timerBtnText}>{pomodoroRunning ? '⏸ Pause' : pomodoroTime < WORK_SECS || pomodoroMode === 'break' ? '▶ Resume' : '▶ Start'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.resetBtn} onPress={resetPomodoro}>
                  <Text style={s.resetBtnText}>↺ Reset</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Complete button */}
        <TouchableOpacity style={s.completeBtn} onPress={handleComplete}>
          <Text style={s.completeBtnText}>✓ Mark Complete</Text>
        </TouchableOpacity>

        {/* Hint */}
        <Text style={s.hint}>Tap × to save and exit</Text>

      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F', paddingHorizontal: 24 },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, marginBottom: 24 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 18, color: '#636366' },
  focusLabel: { fontSize: 12, fontWeight: '700', color: '#636366', letterSpacing: 2 },

  tagsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  priorityBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  priorityText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  categoryBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.08)' },
  categoryText: { fontSize: 11, color: '#636366', fontWeight: '500' },

  taskTitle: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', lineHeight: 34, marginBottom: 12 },
  dueDate: { fontSize: 13, color: '#636366', marginBottom: 28 },

  modeToggle: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 4, marginBottom: 40 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  modeBtnActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  modeBtnText: { fontSize: 15, color: '#636366', fontWeight: '600' },
  modeBtnTextActive: { color: '#FFFFFF' },

  timerSection: { flex: 1, alignItems: 'center', gap: 12 },
  timerDisplay: { fontSize: 72, fontWeight: '800', color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  timerSubLabel: { fontSize: 13, color: '#48484A' },

  pomodoroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pomodoroDot: { width: 8, height: 8, borderRadius: 4 },
  pomodoroModeLabel: { fontSize: 15, fontWeight: '600', color: '#EBEBF5' },
  pomodoroBar: { width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  pomodoroBarFill: { height: '100%', borderRadius: 3 },

  timerActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  timerBtn: {
    backgroundColor: '#1877F2', borderRadius: 16,
    paddingHorizontal: 32, paddingVertical: 16,
  },
  timerBtnPause: { backgroundColor: 'rgba(255,255,255,0.12)' },
  timerBtnText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  resetBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16,
    paddingHorizontal: 20, paddingVertical: 16,
  },
  resetBtnText: { fontSize: 17, color: '#636366' },

  completeBtn: {
    backgroundColor: '#30D158', borderRadius: 18,
    padding: 18, alignItems: 'center', marginBottom: 12,
  },
  completeBtnText: { fontSize: 17, fontWeight: '800', color: '#000' },
  hint: { fontSize: 12, color: '#48484A', textAlign: 'center', marginBottom: 8 },
});
