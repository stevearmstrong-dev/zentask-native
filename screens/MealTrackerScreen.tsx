import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@supabase/supabase-js';

function getKeys(userEmail: string) {
  const ns = userEmail || 'guest';
  return { MEALS_KEY: `zentask:meal_logs:${ns}` };
}

interface MealEntry {
  id: number;
  date: string;       // YYYY-MM-DD
  mealName: string;
  notes?: string;
  timestamp: string;  // ISO string
}

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDisplayDate(dateStr: string): string {
  const today = getTodayStr();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (dateStr === today) return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';

  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function calcCurrentStreak(meals: MealEntry[]): number {
  if (meals.length === 0) return 0;
  const uniqueDates = Array.from(new Set(meals.map(m => m.date))).sort((a, b) => b.localeCompare(a));
  const today = getTodayStr();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Must have today or yesterday to have an active streak
  if (!uniqueDates.includes(today) && !uniqueDates.includes(yesterdayStr)) return 0;

  let streak = 0;
  const check = new Date();
  if (!uniqueDates.includes(today)) check.setDate(check.getDate() - 1);

  while (true) {
    const str = check.toISOString().split('T')[0];
    if (uniqueDates.includes(str)) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function calcLongestStreak(meals: MealEntry[], currentStreak: number): number {
  if (meals.length === 0) return 0;
  const uniqueDates = Array.from(new Set(meals.map(m => m.date))).sort();
  let max = 1;
  let cur = 1;

  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i - 1]);
    const curr = new Date(uniqueDates[i]);
    const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diff === 1) {
      cur++;
    } else {
      max = Math.max(max, cur);
      cur = 1;
    }
  }
  return Math.max(max, cur, currentStreak);
}

function getMotivationalMessage(streak: number): string {
  if (streak === 0) return '🍳 Start cooking today!';
  if (streak === 1) return '🌟 Great start! Keep it up!';
  if (streak < 7) return '🔥 Building a healthy habit!';
  if (streak === 7) return '⭐ One week of cooking! Amazing!';
  if (streak < 30) return '💪 You\'re crushing it! Keep cooking!';
  if (streak === 30) return '🏆 30 days! Master chef in the making!';
  if (streak < 90) return '👨‍🍳 Cooking legend! Keep going!';
  return '🎖️ Ultimate home chef! Incredible!';
}

interface Props { user?: User | null; }

export default function MealTrackerScreen({ user }: Props) {
  const userEmail = user?.email || '';
  const { MEALS_KEY } = useMemo(() => getKeys(userEmail), [userEmail]);

  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [mealName, setMealName] = useState('');
  const [notes, setNotes] = useState('');

  // Load from storage
  useEffect(() => {
    setLoaded(false);
    setMeals([]);
    AsyncStorage.getItem(MEALS_KEY).then(raw => {
      if (raw) setMeals(JSON.parse(raw));
      setLoaded(true);
    }).catch(console.error);
  }, [MEALS_KEY]);

  // Persist
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(MEALS_KEY, JSON.stringify(meals)).catch(console.error);
  }, [meals, loaded]);

  const today = getTodayStr();
  const todayMeals = meals.filter(m => m.date === today);
  const [editingId, setEditingId] = useState<number | null>(null);
  const currentStreak = calcCurrentStreak(meals);
  const longestStreak = calcLongestStreak(meals, currentStreak);
  const daysThisMonth = new Set(meals.filter(m => m.date.startsWith(today.slice(0, 7))).map(m => m.date)).size;

  const openForm = (prefill?: MealEntry) => {
    setMealName(prefill?.mealName ?? '');
    setNotes(prefill?.notes ?? '');
    setEditingId(prefill?.id ?? null);
    setShowForm(true);
  };

  const handleSave = useCallback(() => {
    if (!mealName.trim()) return;

    if (editingId !== null) {
      // Update existing
      setMeals(prev => prev.map(m =>
        m.id === editingId
          ? { ...m, mealName: mealName.trim(), notes: notes.trim() }
          : m
      ));
    } else {
      // Add new
      const entry: MealEntry = {
        id: Date.now(),
        date: today,
        mealName: mealName.trim(),
        notes: notes.trim(),
        timestamp: new Date().toISOString(),
      };
      setMeals(prev => [entry, ...prev]);
    }

    setMealName('');
    setNotes('');
    setEditingId(null);
    setShowForm(false);
  }, [mealName, notes, today, editingId]);

  const handleDelete = (id: number) => {
    Alert.alert('Delete Meal', 'Remove this meal entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setMeals(prev => prev.filter(m => m.id !== id)) },
    ]);
  };

  // Group by date, sorted newest first
  const groupedDates = Array.from(new Set(meals.map(m => m.date))).sort((a, b) => b.localeCompare(a));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>🍳 Meal Tracker</Text>
            <Text style={styles.subtitle}>Cook one meal a day, build a healthy habit</Text>
          </View>

          {/* Today's meals */}
          <View style={styles.todaySection}>
            <View style={styles.todaySectionHeader}>
              <Text style={styles.todaySectionTitle}>Today's Meals ({todayMeals.length})</Text>
              <TouchableOpacity style={styles.logBtn} onPress={() => { setEditingId(null); setMealName(''); setNotes(''); setShowForm(s => !s); }}>
                <Text style={styles.logBtnText}>{showForm && editingId === null ? 'Cancel' : '+ Log Meal'}</Text>
              </TouchableOpacity>
            </View>
            {todayMeals.length === 0 && !showForm && (
              <View style={styles.todayEmpty}>
                <Text style={styles.todayEmptyIcon}>🍳</Text>
                <Text style={styles.todayEmptyText}>No meals logged today yet</Text>
              </View>
            )}
            {todayMeals.map(meal => (
              <View key={meal.id} style={styles.todayCard}>
                <View style={styles.todayCheck}>
                  <Text style={styles.todayCheckText}>✓</Text>
                </View>
                <View style={styles.todayInfo}>
                  <Text style={styles.todayMealName}>{meal.mealName}</Text>
                  {meal.notes ? <Text style={styles.todayNotes}>{meal.notes}</Text> : null}
                </View>
                <TouchableOpacity style={styles.editBtn} onPress={() => openForm(meal)}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Add / Edit form */}
          {showForm && (
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="What did you cook?"
                placeholderTextColor="#48484A"
                value={mealName}
                onChangeText={setMealName}
                autoFocus
                returnKeyType="next"
              />
              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder="Notes (optional)"
                placeholderTextColor="#48484A"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <View style={styles.formBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, !mealName.trim() && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={!mealName.trim()}
                >
                  <Text style={styles.saveBtnText}>{editingId !== null ? 'Update' : 'Save Meal'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#FF9F0A' }]}>{currentStreak}</Text>
              <Text style={styles.statLabel}>Current Streak</Text>
            </View>
            <View style={[styles.statCard, styles.statCardHighlight]}>
              <Text style={[styles.statValue, { color: '#30D158' }]}>{longestStreak}</Text>
              <Text style={styles.statLabel}>Longest Streak</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{daysThisMonth}</Text>
              <Text style={styles.statLabel}>This Month</Text>
            </View>
          </View>

          {/* Motivational message */}
          <Text style={styles.motivation}>{getMotivationalMessage(currentStreak)}</Text>

          {/* History */}
          <Text style={styles.sectionTitle}>Cooking History</Text>
          {meals.length === 0 ? (
            <Text style={styles.emptyText}>No meals logged yet. Start cooking!</Text>
          ) : (
            groupedDates.map(date => (
              <View key={date} style={styles.dateGroup}>
                <Text style={styles.dateHeader}>{formatDisplayDate(date)}</Text>
                {meals.filter(m => m.date === date).map(meal => (
                  <View key={meal.id} style={styles.historyItem}>
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyMealName}>{meal.mealName}</Text>
                      {meal.notes ? <Text style={styles.historyNotes}>{meal.notes}</Text> : null}
                    </View>
                    <TouchableOpacity onPress={() => handleDelete(meal.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.deleteText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ))
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 14, color: '#636366', marginTop: 4 },

  // Today section
  todaySection: { marginBottom: 16 },
  todaySectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  todaySectionTitle: { fontSize: 17, fontWeight: '600', color: '#EBEBF5' },

  // Today card (completed)
  todayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(48,209,88,0.1)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(48,209,88,0.3)',
    gap: 14,
  },
  todayCheck: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#30D158',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCheckText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  todayInfo: { flex: 1 },
  todayMealName: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  todayNotes: { fontSize: 13, color: '#636366', marginTop: 3 },
  editBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  editBtnText: { color: '#EBEBF5', fontSize: 13, fontWeight: '600' },

  // Today empty
  todayEmpty: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  todayEmptyIcon: { fontSize: 36 },
  todayEmptyText: { fontSize: 15, color: '#636366' },
  logBtn: {
    backgroundColor: '#1877F2',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 4,
  },
  logBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Form
  form: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 10,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  notesInput: { minHeight: 80, paddingTop: 12 },
  formBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 13,
    alignItems: 'center',
  },
  cancelBtnText: { color: '#636366', fontWeight: '600', fontSize: 15 },
  saveBtn: {
    flex: 1,
    backgroundColor: '#1877F2',
    borderRadius: 12,
    padding: 13,
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: 'rgba(24,119,242,0.3)' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statCardHighlight: {
    borderColor: 'rgba(48,209,88,0.3)',
    backgroundColor: 'rgba(48,209,88,0.08)',
  },
  statValue: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
  statLabel: { fontSize: 11, color: '#636366', marginTop: 4, textAlign: 'center' },

  // Motivation
  motivation: {
    textAlign: 'center',
    fontSize: 15,
    color: '#EBEBF5',
    fontWeight: '500',
    marginBottom: 24,
  },

  // History
  sectionTitle: { fontSize: 17, fontWeight: '600', color: '#EBEBF5', marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#48484A', textAlign: 'center', paddingVertical: 20 },
  dateGroup: { marginBottom: 16 },
  dateHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636366',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  historyInfo: { flex: 1 },
  historyMealName: { fontSize: 15, color: '#EBEBF5', fontWeight: '500' },
  historyNotes: { fontSize: 12, color: '#636366', marginTop: 3 },
  deleteText: { fontSize: 16, color: '#48484A' },
});
