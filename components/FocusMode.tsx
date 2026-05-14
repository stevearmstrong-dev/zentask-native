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
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Task } from '../types';
import { incrementSessions } from '../utils/pomodoroSessions';
import { Colors, Spacing, Typography, BorderRadius, getPriorityColor } from '../constants/theme';

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
  userEmail?: string;
}

export default function FocusMode({ visible, task, onClose, onComplete, onUpdateTime, userEmail }: Props) {
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isTracking) stopTimer();
    else startTimer();
  }, [isTracking, startTimer, stopTimer]);

  const resetTimer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
          const completedWork = pomodoroModeRef.current === 'work';
          const next = completedWork ? 'break' : 'work';
          pomodoroModeRef.current = next;
          setPomodoroMode(next);
          if (completedWork) incrementSessions(userEmail);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (pomodoroRunning) stopPomodoro();
    else startPomodoro();
  }, [pomodoroRunning, startPomodoro, stopPomodoro]);

  const resetPomodoro = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pomodoroRef.current && clearInterval(pomodoroRef.current);
    setPomodoroRunning(false);
    setPomodoroTime(WORK_SECS);
    setPomodoroMode('work');
    pomodoroModeRef.current = 'work';
  }, []);

  // --- Switch mode ---
  const switchMode = useCallback((next: 'timer' | 'pomodoro') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    timerRef.current && clearInterval(timerRef.current);
    pomodoroRef.current && clearInterval(pomodoroRef.current);
    save({ pomodoroTime, pomodoroMode });
    onClose();
  }, [save, pomodoroTime, pomodoroMode, onClose]);

  const handleComplete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    timerRef.current && clearInterval(timerRef.current);
    pomodoroRef.current && clearInterval(pomodoroRef.current);
    save({ pomodoroTime, pomodoroMode });
    if (task) onComplete(task.id as number);
    onClose();
  }, [save, pomodoroTime, pomodoroMode, task, onComplete, onClose]);

  if (!task) return null;

  const priorityColor = getPriorityColor(task.priority || 'medium');
  const pomodoroProgress = mode === 'pomodoro'
    ? 1 - pomodoroTime / (pomodoroMode === 'work' ? WORK_SECS : BREAK_SECS)
    : 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>

        {/* Top bar */}
        <View style={s.topBar}>
          <TouchableOpacity onPress={handleClose} style={s.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.7}>
            <Ionicons name="close" size={20} color={Colors.text.tertiary} />
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
          <View style={s.dueDateRow}>
            <Ionicons name="calendar-outline" size={14} color={Colors.text.tertiary} />
            <Text style={s.dueDate}>
              {new Date(task.dueDate + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric',
              })}
              {task.dueTime ? ` at ${task.dueTime}` : ''}
            </Text>
          </View>
        )}

        {/* Mode toggle */}
        <View style={s.modeToggle}>
          <TouchableOpacity
            style={[s.modeBtn, mode === 'timer' && s.modeBtnActive]}
            onPress={() => switchMode('timer')}
            activeOpacity={0.7}
          >
            <Ionicons name="timer-outline" size={18} color={mode === 'timer' ? Colors.text.primary : Colors.text.tertiary} />
            <Text style={[s.modeBtnText, mode === 'timer' && s.modeBtnTextActive]}>Timer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.modeBtn, mode === 'pomodoro' && s.modeBtnActive]}
            onPress={() => switchMode('pomodoro')}
            activeOpacity={0.7}
          >
            <Ionicons name="alarm-outline" size={18} color={mode === 'pomodoro' ? Colors.text.primary : Colors.text.tertiary} />
            <Text style={[s.modeBtnText, mode === 'pomodoro' && s.modeBtnTextActive]}>Pomodoro</Text>
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
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isTracking ? "pause" : "play"}
                    size={20}
                    color={Colors.text.primary}
                  />
                  <Text style={s.timerBtnText}>{isTracking ? 'Pause' : timeSpent > 0 ? 'Resume' : 'Start'}</Text>
                </TouchableOpacity>
                {timeSpent > 0 && !isTracking && (
                  <TouchableOpacity style={s.resetBtn} onPress={resetTimer} activeOpacity={0.8}>
                    <Ionicons name="refresh" size={18} color={Colors.text.tertiary} />
                    <Text style={s.resetBtnText}>Reset</Text>
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
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={pomodoroRunning ? "pause" : "play"}
                    size={20}
                    color={Colors.text.primary}
                  />
                  <Text style={s.timerBtnText}>{pomodoroRunning ? 'Pause' : pomodoroTime < WORK_SECS || pomodoroMode === 'break' ? 'Resume' : 'Start'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.resetBtn} onPress={resetPomodoro} activeOpacity={0.8}>
                  <Ionicons name="refresh" size={18} color={Colors.text.tertiary} />
                  <Text style={s.resetBtnText}>Reset</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Complete button */}
        <TouchableOpacity style={s.completeBtn} onPress={handleComplete} activeOpacity={0.8}>
          <Ionicons name="checkmark-circle" size={24} color={Colors.text.inverse} />
          <Text style={s.completeBtnText}>Mark Complete</Text>
        </TouchableOpacity>

        {/* Hint */}
        <View style={s.hintRow}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.text.disabled} />
          <Text style={s.hint}>Tap close button to save and exit</Text>
        </View>

      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
    paddingHorizontal: Spacing.xxl
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    marginBottom: Spacing.xxl
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface.elevated,
    alignItems: 'center',
    justifyContent: 'center'
  },
  focusLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.tertiary,
    letterSpacing: Typography.letterSpacing.wider
  },

  tagsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg
  },
  priorityBadge: {
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderWidth: 1
  },
  priorityText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: Typography.letterSpacing.wide
  },
  categoryBadge: {
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    backgroundColor: Colors.surface.elevated
  },
  categoryText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
    fontWeight: Typography.fontWeight.medium
  },

  taskTitle: {
    fontSize: Typography.fontSize.huge,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.text.primary,
    lineHeight: 34,
    marginBottom: Spacing.md
  },
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 28
  },
  dueDate: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary
  },

  modeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surface.base,
    borderRadius: BorderRadius.xl,
    padding: 4,
    marginBottom: Spacing.huge
  },
  modeBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  modeBtnActive: { backgroundColor: Colors.surface.hover },
  modeBtnText: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.tertiary,
    fontWeight: Typography.fontWeight.semibold
  },
  modeBtnTextActive: { color: Colors.text.primary },

  timerSection: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.md
  },
  timerDisplay: {
    fontSize: Typography.fontSize.display,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.text.primary,
    fontVariant: ['tabular-nums']
  },
  timerSubLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.disabled
  },

  pomodoroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm
  },
  pomodoroDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  pomodoroModeLabel: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.secondary
  },
  pomodoroBar: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.surface.elevated,
    borderRadius: 3,
    overflow: 'hidden'
  },
  pomodoroBarFill: {
    height: '100%',
    borderRadius: 3
  },

  timerActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm
  },
  timerBtn: {
    backgroundColor: Colors.interactive.primary,
    borderRadius: BorderRadius.xxl,
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  timerBtnPause: { backgroundColor: Colors.surface.hover },
  timerBtnText: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary
  },
  resetBtn: {
    backgroundColor: Colors.surface.elevated,
    borderRadius: BorderRadius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  resetBtnText: {
    fontSize: Typography.fontSize.xl,
    color: Colors.text.tertiary
  },

  completeBtn: {
    backgroundColor: Colors.semantic.success,
    borderRadius: BorderRadius.xxxl,
    padding: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  completeBtnText: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.text.inverse
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  hint: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.disabled,
    textAlign: 'center'
  },
});
