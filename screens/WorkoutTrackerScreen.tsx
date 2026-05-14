import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User } from '@supabase/supabase-js';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

function getKeys(userEmail: string) {
  const ns = userEmail || 'guest';
  return {
    WEEK_KEY: `zentask:workout_week:${ns}`,
    HISTORY_KEY: `zentask:workout_history:${ns}`,
  };
}

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  completed: boolean;
  videoUrl?: string;
}

interface WorkoutDay {
  day: string;
  type: 'home' | 'gym' | 'rest';
  completed: boolean;
  exercises: Exercise[];
}

interface WorkoutLog {
  date: string;
  dayType: string;
  exercises: Exercise[];
}

// Body-scan inspired: gym = warm amber glow, home = cyan, rest = muted
const DAY_COLORS = { gym: '#F59E0B', home: '#00D4C8', rest: '#2A4A50' };
const DAY_LABELS = { gym: 'Gym', home: 'Home', rest: 'Rest' };

function createWeeklyPlan(week: number): WorkoutDay[] {
  const base = 20;
  const wm = (week - 1) * 2.5;
  return [
    {
      day: 'Monday', type: 'home', completed: false,
      exercises: [
        { id: 'm1', name: 'Push-ups',               sets: 3, reps: 12 + week, weight: 0,        completed: false, videoUrl: 'https://www.youtube.com/watch?v=IODxDxX7oi4' },
        { id: 'm2', name: 'Dumbbell Chest Press',   sets: 3, reps: 10,        weight: base + wm, completed: false, videoUrl: 'https://www.youtube.com/watch?v=VmB1G1K7v94' },
        { id: 'm3', name: 'Dumbbell Shoulder Press', sets: 3, reps: 10,       weight: base + wm, completed: false, videoUrl: 'https://www.youtube.com/watch?v=qEwKCR5JCog' },
        { id: 'm4', name: 'Tricep Dips',            sets: 3, reps: 12 + week, weight: 0,         completed: false, videoUrl: 'https://www.youtube.com/watch?v=0326dy_-CzM' },
        { id: 'm5', name: 'Ab Roller',              sets: 3, reps: 10 + week, weight: 0,         completed: false, videoUrl: 'https://www.youtube.com/watch?v=EhLQDlaXiQM' },
      ],
    },
    { day: 'Tuesday',  type: 'rest', completed: true, exercises: [] },
    {
      day: 'Wednesday', type: 'gym', completed: false,
      exercises: [
        { id: 'w1', name: 'Barbell Squat',     sets: 4, reps: 8,  weight: 135 + week * 10, completed: false, videoUrl: 'https://www.youtube.com/watch?v=ultWZbUMPL8' },
        { id: 'w2', name: 'Leg Press',         sets: 3, reps: 12, weight: 200 + week * 20, completed: false, videoUrl: 'https://www.youtube.com/watch?v=IZxyjW7MPJQ' },
        { id: 'w3', name: 'Romanian Deadlift', sets: 3, reps: 10, weight: 95  + week * 10, completed: false, videoUrl: 'https://www.youtube.com/watch?v=2SHsk9AzdjA' },
        { id: 'w4', name: 'Leg Curls',         sets: 3, reps: 12, weight: 50  + week * 5,  completed: false, videoUrl: 'https://www.youtube.com/watch?v=ELOCsoDSmrg' },
        { id: 'w5', name: 'Calf Raises',       sets: 4, reps: 15, weight: 100 + week * 10, completed: false, videoUrl: 'https://www.youtube.com/watch?v=gwLzBJYoWlI' },
      ],
    },
    {
      day: 'Thursday', type: 'home', completed: false,
      exercises: [
        { id: 't1', name: 'Pull-ups',              sets: 3, reps: 8  + week, weight: 0,        completed: false, videoUrl: 'https://www.youtube.com/watch?v=eGo4IYlbE5g' },
        { id: 't2', name: 'Dumbbell Rows',         sets: 3, reps: 10,        weight: base + wm, completed: false, videoUrl: 'https://www.youtube.com/watch?v=pYcpY20QaE8' },
        { id: 't3', name: 'Dumbbell Bicep Curls',  sets: 3, reps: 12,        weight: base + wm, completed: false, videoUrl: 'https://www.youtube.com/watch?v=ykJmrZ5v0Oo' },
        { id: 't4', name: 'Dumbbell Hammer Curls', sets: 3, reps: 12,        weight: base + wm, completed: false, videoUrl: 'https://www.youtube.com/watch?v=TwD-YGVP4Bk' },
        { id: 't5', name: 'Ab Roller',             sets: 3, reps: 10 + week, weight: 0,         completed: false, videoUrl: 'https://www.youtube.com/watch?v=EhLQDlaXiQM' },
      ],
    },
    { day: 'Friday', type: 'rest', completed: true, exercises: [] },
    {
      day: 'Saturday', type: 'gym', completed: false,
      exercises: [
        { id: 's1', name: 'Barbell Bench Press',    sets: 4, reps: 8,  weight: 135 + week * 10, completed: false, videoUrl: 'https://www.youtube.com/watch?v=rT7DgCr-3pg' },
        { id: 's2', name: 'Incline Dumbbell Press', sets: 3, reps: 10, weight: 45  + week * 5,  completed: false, videoUrl: 'https://www.youtube.com/watch?v=8iPEnn-ltC8' },
        { id: 's3', name: 'Cable Flyes',            sets: 3, reps: 12, weight: 30  + week * 5,  completed: false, videoUrl: 'https://www.youtube.com/watch?v=Iwe6AmxVf7o' },
        { id: 's4', name: 'Lat Pulldown',           sets: 3, reps: 10, weight: 100 + week * 10, completed: false, videoUrl: 'https://www.youtube.com/watch?v=CAwf7n6Luuc' },
        { id: 's5', name: 'Cable Rows',             sets: 3, reps: 12, weight: 80  + week * 10, completed: false, videoUrl: 'https://www.youtube.com/watch?v=GZbfZ033f74' },
      ],
    },
    { day: 'Sunday', type: 'rest', completed: true, exercises: [] },
  ];
}

interface Props { user?: User | null; }

export default function WorkoutTrackerScreen({ user }: Props) {
  const userEmail = user?.email || '';
  const { WEEK_KEY, HISTORY_KEY } = useMemo(() => getKeys(userEmail), [userEmail]);

  const [week, setWeek] = useState(1);
  const [plan, setPlan] = useState<WorkoutDay[]>([]);
  const [history, setHistory] = useState<WorkoutLog[]>([]);
  const [selectedDay, setSelectedDay] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setWeek(1);
    setHistory([]);
    setPlan([]);
    Promise.all([
      AsyncStorage.getItem(WEEK_KEY),
      AsyncStorage.getItem(HISTORY_KEY),
    ]).then(([rawWeek, rawHistory]) => {
      const w = rawWeek ? parseInt(rawWeek) : 1;
      setWeek(w);
      if (rawHistory) setHistory(JSON.parse(rawHistory));
      setPlan(createWeeklyPlan(w));
      setLoaded(true);
    }).catch(console.error);
  }, [WEEK_KEY, HISTORY_KEY]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(WEEK_KEY, String(week)).catch(console.error);
  }, [week, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history)).catch(console.error);
  }, [history, loaded]);

  const toggleExercise = useCallback((exId: string) => {
    setPlan(prev => prev.map((day, i) =>
      i !== selectedDay ? day : {
        ...day,
        exercises: day.exercises.map(ex =>
          ex.id === exId ? { ...ex, completed: !ex.completed } : ex
        ),
      }
    ));
  }, [selectedDay]);

  const updateExercise = useCallback((exId: string, field: 'sets' | 'reps' | 'weight', value: string) => {
    const n = parseInt(value) || 0;
    setPlan(prev => prev.map((day, i) =>
      i !== selectedDay ? day : {
        ...day,
        exercises: day.exercises.map(ex =>
          ex.id === exId ? { ...ex, [field]: n } : ex
        ),
      }
    ));
  }, [selectedDay]);

  const completeDay = useCallback(() => {
    const day = plan[selectedDay];
    if (day.type === 'rest') return;
    const allDone = day.exercises.every(ex => ex.completed);
    if (!allDone) {
      Alert.alert('Not done yet', 'Please complete all exercises before finishing the workout.');
      return;
    }
    const log: WorkoutLog = {
      date: new Date().toISOString(),
      dayType: `${day.day} — ${day.type === 'gym' ? 'Gym' : 'Home'}`,
      exercises: day.exercises.map(ex => ({ ...ex })),
    };
    setHistory(prev => [log, ...prev]);
    setPlan(prev => prev.map((d, i) => i === selectedDay ? { ...d, completed: true } : d));
    Alert.alert('Workout Complete!', 'Great job! Keep it up.');
  }, [plan, selectedDay]);

  const handleNextWeek = useCallback(() => {
    const allDone = plan.filter(d => d.type !== 'rest').every(d => d.completed);
    if (!allDone) {
      Alert.alert('Not finished', 'Complete all workout days before moving to the next week.');
      return;
    }
    Alert.alert('Move to Week ' + (week + 1), 'Ready for the next week?', [
      { text: 'Cancel', style: 'cancel' },
      { text: "Let's Go", onPress: () => { const nw = week + 1; setWeek(nw); setPlan(createWeeklyPlan(nw)); } },
    ]);
  }, [plan, week]);

  const handleResetWeek = useCallback(() => {
    Alert.alert('Reset Week', 'This will reset all progress for this week.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => setPlan(createWeeklyPlan(week)) },
    ]);
  }, [week]);

  const currentDay = plan[selectedDay];
  const workoutDays = plan.filter(d => d.type !== 'rest');
  const completedCount = workoutDays.filter(d => d.completed).length;
  const progressPct = workoutDays.length > 0 ? (completedCount / workoutDays.length) * 100 : 0;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Ambient teal glow — body-scan inspired */}
      <View style={s.glowBlob} />
      <View style={s.glowBlobBottom} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Workout</Text>
            <Text style={s.subtitle}>Progressive Overload · Week {week}</Text>
          </View>
          <TouchableOpacity style={s.historyToggle} onPress={() => setShowHistory(v => !v)} activeOpacity={0.8}>
            <Text style={s.historyToggleText}>{showHistory ? 'Plan' : 'Log'}</Text>
          </TouchableOpacity>
        </View>

        {/* Stats — body-scan metric cards */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: '#F59E0B' }]}>W{week}</Text>
            <Text style={s.statLabel}>Current{'\n'}Week</Text>
          </View>
          <View style={[s.statCard, s.statCardCenter]}>
            <Text style={[s.statValue, { color: '#00D4C8' }]}>{completedCount}/{workoutDays.length}</Text>
            <Text style={s.statLabel}>Sessions{'\n'}Done</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: '#4ADE80' }]}>{history.length}</Text>
            <Text style={s.statLabel}>Total{'\n'}Logged</Text>
          </View>
        </View>

        {/* Weekly progress bar */}
        <View style={s.progressCard}>
          <View style={s.progressCardTop}>
            <Text style={s.progressCardLabel}>WEEKLY PROGRESS</Text>
            <Text style={s.progressCardPct}>{Math.round(progressPct)}%</Text>
          </View>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${progressPct}%` as any }]} />
          </View>
          <View style={s.weekActions}>
            <TouchableOpacity style={s.weekBtn} onPress={handleResetWeek} activeOpacity={0.8}>
              <Text style={s.weekBtnText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.weekBtn, s.weekBtnPrimary]} onPress={handleNextWeek} activeOpacity={0.85}>
              <Text style={s.weekBtnPrimaryText}>Next Week →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* History panel */}
        {showHistory && (
          <View style={s.historyPanel}>
            <Text style={s.sectionTitle}>Workout Log</Text>
            {history.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyText}>No workouts logged yet</Text>
                <Text style={s.emptySubtext}>Complete a session to see it here</Text>
              </View>
            ) : (
              history.map((log, i) => (
                <View key={i} style={s.historyCard}>
                  <View style={s.historyCardHeader}>
                    <View style={s.historyDot} />
                    <Text style={s.historyDate}>
                      {new Date(log.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                    <Text style={s.historyType}>{log.dayType}</Text>
                  </View>
                  <View style={s.historyExercises}>
                    {log.exercises.map(ex => (
                      <Text key={ex.id} style={s.historyExercise}>
                        {ex.name}: {ex.sets}×{ex.reps}{ex.weight ? ` @ ${ex.weight}lbs` : ''}
                      </Text>
                    ))}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Day selector — scan-style pill row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.daySelector} contentContainerStyle={s.daySelectorContent}>
          {plan.map((day, i) => {
            const color = DAY_COLORS[day.type];
            const isActive = selectedDay === i;
            const isDone = day.completed && day.type !== 'rest';
            return (
              <TouchableOpacity
                key={i}
                style={[
                  s.dayPill,
                  isActive && { borderColor: color, backgroundColor: color + '18', shadowColor: color },
                  isDone && !isActive && s.dayPillDone,
                ]}
                onPress={() => setSelectedDay(i)}
                activeOpacity={0.75}
              >
                <Text style={[s.dayPillLabel, isActive && { color }]}>
                  {day.day.slice(0, 3).toUpperCase()}
                </Text>
                <View style={[s.dayPillBadge, { backgroundColor: color + '33' }]}>
                  <Text style={[s.dayPillBadgeText, { color }]}>{DAY_LABELS[day.type]}</Text>
                </View>
                {isDone && (
                  <View style={s.dayPillCheckWrap}>
                    <Text style={s.dayPillCheck}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Current day panel */}
        {currentDay && (
          <View style={s.dayPanel}>
            {/* Day panel header */}
            <View style={s.dayPanelHeader}>
              <View style={[s.dayTypeBadge, { backgroundColor: DAY_COLORS[currentDay.type] + '22', borderColor: DAY_COLORS[currentDay.type] + '55' }]}>
                <Text style={[s.dayTypeBadgeText, { color: DAY_COLORS[currentDay.type] }]}>
                  {currentDay.day} · {currentDay.type === 'gym' ? 'Gym Day' : currentDay.type === 'home' ? 'Home Workout' : 'Rest Day'}
                </Text>
              </View>
              {currentDay.type !== 'rest' && !currentDay.completed && (
                <TouchableOpacity style={s.finishBtn} onPress={completeDay} activeOpacity={0.85}>
                  <Text style={s.finishBtnText}>Finish</Text>
                </TouchableOpacity>
              )}
              {currentDay.completed && currentDay.type !== 'rest' && (
                <View style={s.doneBadge}>
                  <Text style={s.doneBadgeText}>✓ Done</Text>
                </View>
              )}
            </View>

            {currentDay.type === 'rest' ? (
              <View style={s.restCard}>
                <Text style={s.restTitle}>Recovery Day</Text>
                <Text style={s.restSubtitle}>Your muscles repair and grow stronger today.</Text>
                <View style={s.restTips}>
                  {['Stay hydrated', 'Eat protein-rich foods', 'Get 7–9 hours of sleep', 'Light stretching or yoga'].map(tip => (
                    <View key={tip} style={s.restTipRow}>
                      <View style={s.restTipDot} />
                      <Text style={s.restTip}>{tip}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={s.exerciseList}>
                {currentDay.exercises.map((ex, idx) => (
                  <ExerciseCard
                    key={ex.id}
                    exercise={ex}
                    index={idx + 1}
                    disabled={currentDay.completed}
                    onToggle={() => toggleExercise(ex.id)}
                    onUpdate={(field, val) => updateExercise(ex.id, field, val)}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Progressive overload info */}
        <View style={s.infoCard}>
          <Text style={s.infoTitle}>Progressive Overload</Text>
          <View style={s.infoRow}>
            <View style={[s.infoTag, { backgroundColor: 'rgba(0,212,200,0.12)' }]}>
              <Text style={[s.infoTagText, { color: '#00D4C8' }]}>Home</Text>
            </View>
            <Text style={s.infoText}>Dumbbells +2.5lbs/week · Reps +1/week</Text>
          </View>
          <View style={s.infoRow}>
            <View style={[s.infoTag, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
              <Text style={[s.infoTagText, { color: '#F59E0B' }]}>Gym</Text>
            </View>
            <Text style={s.infoText}>Compounds +10lbs/week · Accessories +5lbs/week</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ExerciseCard({ exercise, index, disabled, onToggle, onUpdate }: {
  exercise: Exercise;
  index: number;
  disabled: boolean;
  onToggle: () => void;
  onUpdate: (field: 'sets' | 'reps' | 'weight', val: string) => void;
}) {
  return (
    <View style={[ex.card, exercise.completed && ex.cardDone]}>
      <View style={ex.header}>
        <TouchableOpacity
          style={[ex.checkbox, exercise.completed && ex.checkboxDone]}
          onPress={onToggle}
          disabled={disabled}
          activeOpacity={0.8}
        >
          {exercise.completed && <Text style={ex.checkmark}>✓</Text>}
        </TouchableOpacity>
        <View style={ex.nameWrap}>
          <Text style={ex.indexLabel}>{String(index).padStart(2, '0')}</Text>
          <Text style={[ex.name, exercise.completed && ex.nameDone]} numberOfLines={1}>
            {exercise.name}
          </Text>
        </View>
        {exercise.videoUrl && (
          <TouchableOpacity onPress={() => Linking.openURL(exercise.videoUrl!)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={ex.videoLink}>▶</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={ex.inputs}>
        {[
          { label: 'Sets', field: 'sets' as const, value: exercise.sets },
          { label: 'Reps', field: 'reps' as const, value: exercise.reps },
          ...(exercise.weight !== undefined ? [{ label: 'lbs', field: 'weight' as const, value: exercise.weight }] : []),
        ].map(item => (
          <View key={item.field} style={ex.inputGroup}>
            <Text style={ex.inputLabel}>{item.label}</Text>
            <TextInput
              style={ex.input}
              value={String(item.value)}
              onChangeText={v => onUpdate(item.field, v)}
              keyboardType="number-pad"
              editable={!disabled}
              selectTextOnFocus
            />
          </View>
        ))}
      </View>

      <Text style={ex.summary}>
        {exercise.sets} sets × {exercise.reps} reps{exercise.weight ? ` @ ${exercise.weight} lbs` : ' · bodyweight'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060D12' },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  // Ambient glows
  glowBlob: {
    position: 'absolute', width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(0,212,200,0.07)',
    top: -60, alignSelf: 'center',
  },
  glowBlobBottom: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(245,158,11,0.05)',
    bottom: 100, right: -60,
  },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10, paddingBottom: 20,
  },
  title: { fontSize: 30, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#2A6A70', marginTop: 3 },
  historyToggle: {
    backgroundColor: 'rgba(0,212,200,0.1)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 9,
    borderWidth: 1, borderColor: 'rgba(0,212,200,0.2)',
  },
  historyToggleText: { color: '#00D4C8', fontSize: 13, fontWeight: '700' },

  // Stat cards — body scanner metric style
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: '#0C1E26',
    borderRadius: 20, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(0,212,200,0.1)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  statCardCenter: { borderColor: 'rgba(0,212,200,0.25)', shadowColor: '#00D4C8', shadowOpacity: 0.15 },
  statValue: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: '#2A6A70', marginTop: 4, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.3 },

  // Progress card
  progressCard: {
    backgroundColor: '#0C1E26', borderRadius: 22, padding: 18, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(0,212,200,0.12)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 5,
  },
  progressCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  progressCardLabel: { fontSize: 11, fontWeight: '700', color: '#2A6A70', letterSpacing: 1.5, textTransform: 'uppercase' },
  progressCardPct: { fontSize: 13, fontWeight: '700', color: '#00D4C8' },
  progressTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 16 },
  progressFill: {
    height: '100%', borderRadius: 3,
    backgroundColor: '#00D4C8',
    shadowColor: '#00D4C8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 6, elevation: 3,
  },
  weekActions: { flexDirection: 'row', gap: 10 },
  weekBtn: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
    paddingVertical: 11, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  weekBtnText: { color: '#2A6A70', fontSize: 13, fontWeight: '600' },
  weekBtnPrimary: {
    flex: 2, backgroundColor: '#00D4C8', borderColor: '#00D4C8',
    shadowColor: '#00D4C8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 5,
  },
  weekBtnPrimaryText: { color: '#000', fontSize: 14, fontWeight: '800' },

  // History
  historyPanel: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  emptyBox: { alignItems: 'center', paddingVertical: 28, backgroundColor: '#0C1E26', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(0,212,200,0.08)' },
  emptyText: { fontSize: 15, color: '#CCDDDD', fontWeight: '600' },
  emptySubtext: { fontSize: 13, color: '#2A6A70', marginTop: 4 },
  historyCard: {
    backgroundColor: '#0C1E26', borderRadius: 16, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,212,200,0.1)',
  },
  historyCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  historyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00D4C8', shadowColor: '#00D4C8', shadowOpacity: 0.6, shadowRadius: 4, elevation: 2 },
  historyDate: { fontSize: 13, fontWeight: '700', color: '#CCDDDD' },
  historyType: { fontSize: 12, color: '#2A6A70', marginLeft: 'auto' as any },
  historyExercises: { gap: 3 },
  historyExercise: { fontSize: 12, color: '#2A6A70' },

  // Day selector
  daySelector: { marginBottom: 16 },
  daySelectorContent: { gap: 8, paddingRight: 4 },
  dayPill: {
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,212,200,0.1)',
    backgroundColor: '#0C1E26', gap: 5, minWidth: 68,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0, shadowRadius: 8, elevation: 0,
  },
  dayPillDone: { borderColor: 'rgba(74,222,128,0.3)', backgroundColor: 'rgba(74,222,128,0.06)' },
  dayPillLabel: { fontSize: 11, fontWeight: '800', color: '#2A6A70', letterSpacing: 1 },
  dayPillBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  dayPillBadgeText: { fontSize: 10, fontWeight: '700' },
  dayPillCheckWrap: { position: 'absolute', top: -4, right: -4, backgroundColor: '#4ADE80', borderRadius: 8, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  dayPillCheck: { fontSize: 9, color: '#000', fontWeight: '800' },

  // Day panel
  dayPanel: {
    backgroundColor: '#0C1E26', borderRadius: 22, padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(0,212,200,0.1)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
  },
  dayPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  dayTypeBadge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  dayTypeBadgeText: { fontSize: 12, fontWeight: '700' },
  finishBtn: {
    backgroundColor: '#00D4C8', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8,
    shadowColor: '#00D4C8', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.45, shadowRadius: 8, elevation: 4,
  },
  finishBtnText: { color: '#000', fontWeight: '800', fontSize: 13 },
  doneBadge: { backgroundColor: 'rgba(74,222,128,0.12)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)' },
  doneBadgeText: { color: '#4ADE80', fontWeight: '700', fontSize: 13 },

  exerciseList: { gap: 10 },

  // Rest card
  restCard: { gap: 10 },
  restTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  restSubtitle: { fontSize: 14, color: '#2A6A70', marginBottom: 4 },
  restTips: { gap: 8 },
  restTipRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  restTipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00D4C8' },
  restTip: { fontSize: 14, color: '#CCDDDD' },

  // Info card
  infoCard: {
    backgroundColor: '#0C1E26', borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: 'rgba(0,212,200,0.08)', gap: 10,
  },
  infoTitle: { fontSize: 11, fontWeight: '700', color: '#2A6A70', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoTag: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  infoTagText: { fontSize: 11, fontWeight: '700' },
  infoText: { fontSize: 12, color: '#2A6A70', flex: 1 },
});

const ex = StyleSheet.create({
  card: {
    backgroundColor: '#0A1820', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(0,212,200,0.08)', gap: 12,
  },
  cardDone: { borderColor: 'rgba(74,222,128,0.2)', backgroundColor: 'rgba(74,222,128,0.03)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 26, height: 26, borderRadius: 8, borderWidth: 2,
    borderColor: 'rgba(0,212,200,0.3)', alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: '#00D4C8', borderColor: '#00D4C8', shadowColor: '#00D4C8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 6, elevation: 3 },
  checkmark: { color: '#000', fontSize: 13, fontWeight: '800' },
  nameWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  indexLabel: { fontSize: 11, color: '#2A6A70', fontWeight: '700', width: 22 },
  name: { flex: 1, fontSize: 14, color: '#CCDDDD', fontWeight: '600' },
  nameDone: { color: '#2A6A70', textDecorationLine: 'line-through' },
  videoLink: { fontSize: 13, color: '#00D4C8', fontWeight: '700' },
  inputs: { flexDirection: 'row', gap: 10 },
  inputGroup: { flex: 1, gap: 5 },
  inputLabel: { fontSize: 10, color: '#2A6A70', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: 'rgba(0,212,200,0.07)', borderRadius: 10, paddingVertical: 9,
    fontSize: 16, fontWeight: '800', color: '#FFFFFF', textAlign: 'center',
    borderWidth: 1, borderColor: 'rgba(0,212,200,0.15)',
  },
  summary: { fontSize: 11, color: '#2A6A70', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
});
