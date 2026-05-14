import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
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
    setMeals(prev => prev.filter(m => m.id !== id));
  };

  // Group by date, sorted newest first
  const groupedDates = Array.from(new Set(meals.map(m => m.date))).sort((a, b) => b.localeCompare(a));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Ambient glow */}
      <View style={styles.glowBlob} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Meal Tracker</Text>
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
                placeholderTextColor="#3A5A60"
                value={mealName}
                onChangeText={setMealName}
                autoFocus
                returnKeyType="next"
              />
              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder="Notes (optional)"
                placeholderTextColor="#3A5A60"
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
              <Text style={[styles.statValue, { color: '#4ADE80' }]}>{currentStreak}</Text>
              <Text style={styles.statLabel}>Current{'\n'}Streak</Text>
            </View>
            <View style={[styles.statCard, styles.statCardHighlight]}>
              <Text style={[styles.statValue, { color: '#00E5CC' }]}>{longestStreak}</Text>
              <Text style={styles.statLabel}>Longest{'\n'}Streak</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#60A5FA' }]}>{daysThisMonth}</Text>
              <Text style={styles.statLabel}>This{'\n'}Month</Text>
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
  container: { flex: 1, backgroundColor: '#080E12' },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  glowBlob: {
    position: 'absolute',
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(0,229,204,0.08)',
    top: -80, alignSelf: 'center',
  },

  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#3A5A60', marginTop: 4 },

  // Today section
  todaySection: { marginBottom: 16 },
  todaySectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  todaySectionTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Today card (completed)
  todayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1C22',
    borderRadius: 20,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,229,204,0.2)',
    gap: 14,
    shadowColor: '#00E5CC',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  todayCheck: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#00E5CC',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00E5CC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  todayCheckText: { color: '#000', fontSize: 20, fontWeight: '800' },
  todayInfo: { flex: 1 },
  todayMealName: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  todayNotes: { fontSize: 13, color: '#3A5A60', marginTop: 3 },
  editBtn: {
    backgroundColor: 'rgba(0,229,204,0.1)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(0,229,204,0.2)',
  },
  editBtnText: { color: '#00E5CC', fontSize: 13, fontWeight: '600' },

  // Today empty
  todayEmpty: {
    backgroundColor: '#0D1C22',
    borderRadius: 20,
    padding: 28,
    marginBottom: 16,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  todayEmptyIcon: { fontSize: 36 },
  todayEmptyText: { fontSize: 15, color: '#3A5A60' },
  logBtn: {
    backgroundColor: '#00E5CC',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
    shadowColor: '#00E5CC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  logBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },

  // Form
  form: {
    backgroundColor: '#0D1C22',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,229,204,0.15)',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  input: {
    backgroundColor: '#0A1820',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,229,204,0.2)',
  },
  notesInput: { minHeight: 80, paddingTop: 13 },
  formBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cancelBtnText: { color: '#3A5A60', fontWeight: '600', fontSize: 15 },
  saveBtn: {
    flex: 1,
    backgroundColor: '#00E5CC',
    borderRadius: 12,
    padding: 13,
    alignItems: 'center',
    shadowColor: '#00E5CC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 5,
  },
  saveBtnDisabled: { backgroundColor: 'rgba(0,229,204,0.2)', shadowOpacity: 0 },
  saveBtnText: { color: '#000', fontWeight: '800', fontSize: 15 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: '#0D1C22',
    borderRadius: 20,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  statCardHighlight: {
    borderColor: 'rgba(0,229,204,0.25)',
    backgroundColor: '#0D1C22',
  },
  statValue: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: '#3A5A60', marginTop: 4, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.3 },

  // Motivation
  motivation: {
    textAlign: 'center',
    fontSize: 14,
    color: '#4ADE80',
    fontWeight: '600',
    marginBottom: 24,
    paddingHorizontal: 20,
  },

  // History
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyText: { fontSize: 14, color: '#3A5A60', textAlign: 'center', paddingVertical: 20 },
  dateGroup: { marginBottom: 16 },
  dateHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00E5CC',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1C22',
    borderRadius: 14,
    padding: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  historyInfo: { flex: 1 },
  historyMealName: { fontSize: 15, color: '#CCDDDD', fontWeight: '500' },
  historyNotes: { fontSize: 12, color: '#3A5A60', marginTop: 3 },
  deleteText: { fontSize: 16, color: '#3A5A60' },
});
