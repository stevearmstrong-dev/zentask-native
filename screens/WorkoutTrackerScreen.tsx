import React, { useState, useEffect, useCallback } from 'react';
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

const WEEK_KEY = 'zentask:workout_week';
const HISTORY_KEY = 'zentask:workout_history';

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

const DAY_ICONS = { gym: '🏋️', home: '🏠', rest: '😴' };
const DAY_COLORS = { gym: '#FF9F0A', home: '#1877F2', rest: '#636366' };

function createWeeklyPlan(week: number): WorkoutDay[] {
  const base = 20;
  const wm = (week - 1) * 2.5;

  return [
    {
      day: 'Monday', type: 'home', completed: false,
      exercises: [
        { id: 'm1', name: 'Push-ups',              sets: 3, reps: 12 + week, weight: 0,          completed: false, videoUrl: 'https://www.youtube.com/watch?v=IODxDxX7oi4' },
        { id: 'm2', name: 'Dumbbell Chest Press',  sets: 3, reps: 10,        weight: base + wm,   completed: false, videoUrl: 'https://www.youtube.com/watch?v=VmB1G1K7v94' },
        { id: 'm3', name: 'Dumbbell Shoulder Press',sets: 3, reps: 10,       weight: base + wm,   completed: false, videoUrl: 'https://www.youtube.com/watch?v=qEwKCR5JCog' },
        { id: 'm4', name: 'Tricep Dips',           sets: 3, reps: 12 + week, weight: 0,           completed: false, videoUrl: 'https://www.youtube.com/watch?v=0326dy_-CzM' },
        { id: 'm5', name: 'Ab Roller',             sets: 3, reps: 10 + week, weight: 0,           completed: false, videoUrl: 'https://www.youtube.com/watch?v=EhLQDlaXiQM' },
      ],
    },
    { day: 'Tuesday',  type: 'rest', completed: true, exercises: [] },
    {
      day: 'Wednesday', type: 'gym', completed: false,
      exercises: [
        { id: 'w1', name: 'Barbell Squat',       sets: 4, reps: 8,  weight: 135 + week * 10, completed: false, videoUrl: 'https://www.youtube.com/watch?v=ultWZbUMPL8' },
        { id: 'w2', name: 'Leg Press',           sets: 3, reps: 12, weight: 200 + week * 20, completed: false, videoUrl: 'https://www.youtube.com/watch?v=IZxyjW7MPJQ' },
        { id: 'w3', name: 'Romanian Deadlift',   sets: 3, reps: 10, weight: 95  + week * 10, completed: false, videoUrl: 'https://www.youtube.com/watch?v=2SHsk9AzdjA' },
        { id: 'w4', name: 'Leg Curls',           sets: 3, reps: 12, weight: 50  + week * 5,  completed: false, videoUrl: 'https://www.youtube.com/watch?v=ELOCsoDSmrg' },
        { id: 'w5', name: 'Calf Raises',         sets: 4, reps: 15, weight: 100 + week * 10, completed: false, videoUrl: 'https://www.youtube.com/watch?v=gwLzBJYoWlI' },
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

export default function WorkoutTrackerScreen() {
  const [week, setWeek] = useState(1);
  const [plan, setPlan] = useState<WorkoutDay[]>([]);
  const [history, setHistory] = useState<WorkoutLog[]>([]);
  const [selectedDay, setSelectedDay] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load
  useEffect(() => {
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
  }, []);

  // Persist week + history
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
    Alert.alert('🎉 Workout Complete!', 'Great job! Keep it up.');
  }, [plan, selectedDay]);

  const handleNextWeek = useCallback(() => {
    const allDone = plan.filter(d => d.type !== 'rest').every(d => d.completed);
    if (!allDone) {
      Alert.alert('Not finished', 'Complete all workout days before moving to the next week.');
      return;
    }
    Alert.alert('Move to Week ' + (week + 1), 'Ready for the next week?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Let\'s Go', onPress: () => {
          const nextWeek = week + 1;
          setWeek(nextWeek);
          setPlan(createWeeklyPlan(nextWeek));
        },
      },
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

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>💪 Workout Tracker</Text>
          <Text style={s.subtitle}>Progressive overload — Week {week}</Text>
        </View>

        {/* Week stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: '#FF9F0A' }]}>Week {week}</Text>
            <Text style={s.statLabel}>Current</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statValue}>{completedCount}/{workoutDays.length}</Text>
            <Text style={s.statLabel}>Completed</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: '#30D158' }]}>{history.length}</Text>
            <Text style={s.statLabel}>Total Logged</Text>
          </View>
        </View>

        {/* Week actions */}
        <View style={s.actionsRow}>
          <TouchableOpacity style={s.actionBtn} onPress={handleResetWeek}>
            <Text style={s.actionBtnText}>🔄 Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, s.actionBtnPrimary]} onPress={handleNextWeek}>
            <Text style={[s.actionBtnText, { color: '#fff' }]}>Next Week ➡️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={() => setShowHistory(v => !v)}>
            <Text style={s.actionBtnText}>{showHistory ? '📋 Plan' : '📊 History'}</Text>
          </TouchableOpacity>
        </View>

        {/* History panel */}
        {showHistory && (
          <View style={s.historyPanel}>
            <Text style={s.sectionTitle}>Workout History</Text>
            {history.length === 0 ? (
              <Text style={s.emptyText}>No workouts logged yet.</Text>
            ) : (
              history.map((log, i) => (
                <View key={i} style={s.historyCard}>
                  <View style={s.historyCardHeader}>
                    <Text style={s.historyDate}>
                      {new Date(log.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                    <Text style={s.historyType}>{log.dayType}</Text>
                  </View>
                  {log.exercises.map(ex => (
                    <Text key={ex.id} style={s.historyExercise}>
                      {ex.name}: {ex.sets}×{ex.reps}{ex.weight ? ` @ ${ex.weight}lbs` : ''}
                    </Text>
                  ))}
                </View>
              ))
            )}
          </View>
        )}

        {/* Day selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.daySelector} contentContainerStyle={s.daySelectorContent}>
          {plan.map((day, i) => (
            <TouchableOpacity
              key={i}
              style={[
                s.dayPill,
                selectedDay === i && { borderColor: DAY_COLORS[day.type], backgroundColor: DAY_COLORS[day.type] + '22' },
                day.completed && day.type !== 'rest' && s.dayPillDone,
              ]}
              onPress={() => setSelectedDay(i)}
            >
              <Text style={s.dayPillIcon}>{DAY_ICONS[day.type]}</Text>
              <Text style={[s.dayPillName, selectedDay === i && { color: DAY_COLORS[day.type] }]}>
                {day.day.slice(0, 3)}
              </Text>
              {day.completed && day.type !== 'rest' && (
                <Text style={s.dayPillCheck}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Current day */}
        {currentDay && (
          <View style={s.dayPanel}>
            <View style={s.dayPanelHeader}>
              <Text style={s.dayPanelTitle}>
                {DAY_ICONS[currentDay.type]} {currentDay.day} — {currentDay.type === 'gym' ? 'Gym Day' : currentDay.type === 'home' ? 'Home Workout' : 'Rest Day'}
              </Text>
              {currentDay.type !== 'rest' && !currentDay.completed && (
                <TouchableOpacity style={s.doneBtn} onPress={completeDay}>
                  <Text style={s.doneBtnText}>Finish</Text>
                </TouchableOpacity>
              )}
              {currentDay.completed && currentDay.type !== 'rest' && (
                <View style={s.completedBadge}>
                  <Text style={s.completedBadgeText}>✓ Done</Text>
                </View>
              )}
            </View>

            {currentDay.type === 'rest' ? (
              <View style={s.restCard}>
                <Text style={s.restTitle}>Rest & Recovery Day</Text>
                <Text style={s.restText}>Your muscles need time to grow. Take it easy today.</Text>
                {['💧 Stay hydrated', '🥗 Eat protein-rich foods', '😴 Get 7–9 hours of sleep', '🧘 Light stretching or yoga'].map(tip => (
                  <Text key={tip} style={s.restTip}>{tip}</Text>
                ))}
              </View>
            ) : (
              currentDay.exercises.map(ex => (
                <ExerciseCard
                  key={ex.id}
                  exercise={ex}
                  disabled={currentDay.completed}
                  onToggle={() => toggleExercise(ex.id)}
                  onUpdate={(field, val) => updateExercise(ex.id, field, val)}
                />
              ))
            )}
          </View>
        )}

        {/* Progressive overload info */}
        <View style={s.infoCard}>
          <Text style={s.infoTitle}>📈 Progressive Overload</Text>
          <Text style={s.infoText}><Text style={s.infoBold}>Home:</Text> Dumbbell weight +2.5lbs/week, bodyweight reps +1/week</Text>
          <Text style={s.infoText}><Text style={s.infoBold}>Gym:</Text> Compound lifts +10lbs/week, accessories +5lbs/week</Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ExerciseCard({ exercise, disabled, onToggle, onUpdate }: {
  exercise: Exercise;
  disabled: boolean;
  onToggle: () => void;
  onUpdate: (field: 'sets' | 'reps' | 'weight', val: string) => void;
}) {
  return (
    <View style={[ex_s.card, exercise.completed && ex_s.cardDone]}>
      <View style={ex_s.header}>
        <TouchableOpacity
          style={[ex_s.checkbox, exercise.completed && ex_s.checkboxDone]}
          onPress={onToggle}
          disabled={disabled}
        >
          {exercise.completed && <Text style={ex_s.checkmark}>✓</Text>}
        </TouchableOpacity>
        <Text style={[ex_s.name, exercise.completed && ex_s.nameDone]} numberOfLines={1}>
          {exercise.name}
        </Text>
        {exercise.videoUrl && (
          <TouchableOpacity onPress={() => Linking.openURL(exercise.videoUrl!)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={ex_s.videoLink}>📺</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={ex_s.inputs}>
        <View style={ex_s.inputGroup}>
          <Text style={ex_s.inputLabel}>Sets</Text>
          <TextInput
            style={ex_s.input}
            value={String(exercise.sets)}
            onChangeText={v => onUpdate('sets', v)}
            keyboardType="number-pad"
            editable={!disabled}
            selectTextOnFocus
          />
        </View>
        <View style={ex_s.inputGroup}>
          <Text style={ex_s.inputLabel}>Reps</Text>
          <TextInput
            style={ex_s.input}
            value={String(exercise.reps)}
            onChangeText={v => onUpdate('reps', v)}
            keyboardType="number-pad"
            editable={!disabled}
            selectTextOnFocus
          />
        </View>
        {exercise.weight !== undefined && (
          <View style={ex_s.inputGroup}>
            <Text style={ex_s.inputLabel}>lbs</Text>
            <TextInput
              style={ex_s.input}
              value={String(exercise.weight)}
              onChangeText={v => onUpdate('weight', v)}
              keyboardType="number-pad"
              editable={!disabled}
              selectTextOnFocus
            />
          </View>
        )}
      </View>

      <Text style={ex_s.summary}>
        {exercise.sets} × {exercise.reps} {exercise.weight ? `@ ${exercise.weight}lbs` : '(bodyweight)'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  header: { marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 14, color: '#636366', marginTop: 4 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  statValue: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  statLabel: { fontSize: 11, color: '#636366', marginTop: 2 },

  actionsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  actionBtn: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    padding: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  actionBtnPrimary: { backgroundColor: '#1877F2', borderColor: '#1877F2' },
  actionBtnText: { color: '#EBEBF5', fontSize: 13, fontWeight: '600' },

  historyPanel: { marginBottom: 16 },
  historyCard: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 6,
  },
  historyCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyDate: { fontSize: 14, fontWeight: '600', color: '#EBEBF5' },
  historyType: { fontSize: 12, color: '#636366' },
  historyExercise: { fontSize: 12, color: '#636366' },

  daySelector: { marginBottom: 16 },
  daySelectorContent: { gap: 8, paddingRight: 4 },
  dayPill: {
    alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.06)', gap: 2,
  },
  dayPillDone: { borderColor: 'rgba(48,209,88,0.4)', backgroundColor: 'rgba(48,209,88,0.08)' },
  dayPillIcon: { fontSize: 16 },
  dayPillName: { fontSize: 12, color: '#636366', fontWeight: '600' },
  dayPillCheck: { fontSize: 10, color: '#30D158', fontWeight: '700' },

  dayPanel: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18,
    padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 10,
  },
  dayPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  dayPanelTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  doneBtn: { backgroundColor: '#30D158', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  completedBadge: { backgroundColor: 'rgba(48,209,88,0.15)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(48,209,88,0.3)' },
  completedBadgeText: { color: '#30D158', fontWeight: '700', fontSize: 13 },

  restCard: { gap: 8 },
  restTitle: { fontSize: 16, fontWeight: '600', color: '#EBEBF5' },
  restText: { fontSize: 14, color: '#636366' },
  restTip: { fontSize: 14, color: '#636366' },

  sectionTitle: { fontSize: 17, fontWeight: '600', color: '#EBEBF5', marginBottom: 10 },
  emptyText: { fontSize: 14, color: '#48484A', textAlign: 'center', paddingVertical: 16 },

  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 6,
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#636366', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  infoText: { fontSize: 13, color: '#636366', lineHeight: 18 },
  infoBold: { color: '#EBEBF5', fontWeight: '600' },
});

const ex_s = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 10,
  },
  cardDone: { borderColor: 'rgba(48,209,88,0.25)', backgroundColor: 'rgba(48,209,88,0.05)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: '#30D158', borderColor: '#30D158' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  name: { flex: 1, fontSize: 15, color: '#EBEBF5', fontWeight: '500' },
  nameDone: { color: '#636366', textDecorationLine: 'line-through' },
  videoLink: { fontSize: 18 },
  inputs: { flexDirection: 'row', gap: 10 },
  inputGroup: { flex: 1, gap: 4 },
  inputLabel: { fontSize: 11, color: '#636366', textAlign: 'center' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 8,
    fontSize: 16, fontWeight: '700', color: '#FFFFFF', textAlign: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  summary: { fontSize: 12, color: '#636366', textAlign: 'center' },
});
