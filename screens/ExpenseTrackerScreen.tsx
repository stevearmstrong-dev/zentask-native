import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPENSES_KEY = 'zentask:expenses';
const BUDGET_KEY = 'zentask:daily_budget';
const DEFAULT_BUDGET = 18;

interface Expense {
  id: number;
  amount: number;
  category: string;
  description: string;
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO
}

const CATEGORIES: { key: string; label: string; emoji: string; color: string }[] = [
  { key: 'Food',          label: 'Food',          emoji: '🍔', color: '#F59E0B' },
  { key: 'Transport',     label: 'Transport',     emoji: '🚗', color: '#3B82F6' },
  { key: 'Entertainment', label: 'Entertainment', emoji: '🎮', color: '#8B5CF6' },
  { key: 'Shopping',      label: 'Shopping',      emoji: '🛍️', color: '#EC4899' },
  { key: 'Bills',         label: 'Bills',         emoji: '💡', color: '#EF4444' },
  { key: 'Health',        label: 'Health',        emoji: '💊', color: '#10B981' },
  { key: 'Other',         label: 'Other',         emoji: '💰', color: '#6B7280' },
];

function categoryMeta(key: string) {
  return CATEGORIES.find(c => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1];
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const p = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${p}`;
}

function getMotivation(spent: number, budget: number): string {
  if (spent === 0)                      return '💎 No expenses yet today!';
  const pct = spent / budget;
  if (pct <= 0.25)                      return '✅ Great start! Stay on track.';
  if (pct <= 0.5)                       return '👍 Halfway through your budget.';
  if (pct <= 0.75)                      return '💰 Good progress! Watch your spending.';
  if (pct < 1)                          return '🎯 Almost at your limit! Spend wisely.';
  return '⚠️ Over budget! Try to save tomorrow.';
}

export default function ExpenseTrackerScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  const [loaded, setLoaded] = useState(false);

  // Add form
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Food');

  // Edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('Food');

  // Budget modal
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  // Load
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(EXPENSES_KEY),
      AsyncStorage.getItem(BUDGET_KEY),
    ]).then(([rawExp, rawBudget]) => {
      if (rawExp) setExpenses(JSON.parse(rawExp));
      if (rawBudget) setBudget(Number(rawBudget));
      setLoaded(true);
    }).catch(console.error);
  }, []);

  // Persist expenses
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses)).catch(console.error);
  }, [expenses, loaded]);

  // Persist budget
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(BUDGET_KEY, String(budget)).catch(console.error);
  }, [budget, loaded]);

  const today = todayStr();
  const todayExpenses = expenses.filter(e => e.date === today).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const todayTotal = todayExpenses.reduce((s, e) => s + e.amount, 0);

  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthTotal = expenses
    .filter(e => e.date.startsWith(monthStr))
    .reduce((s, e) => s + e.amount, 0);

  const budgetPct = Math.min((todayTotal / budget) * 100, 100);
  const overBudget = todayTotal > budget;
  const remaining = budget - todayTotal;

  // Category breakdown for today
  const breakdown = CATEGORIES.map(cat => {
    const total = todayExpenses.filter(e => e.category === cat.key).reduce((s, e) => s + e.amount, 0);
    return { ...cat, total };
  }).filter(c => c.total > 0);

  const handleAdd = useCallback(() => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { Alert.alert('Invalid amount'); return; }
    if (!description.trim()) { Alert.alert('Enter a description'); return; }
    const expense: Expense = {
      id: Date.now(),
      amount: amt,
      category,
      description: description.trim(),
      date: today,
      timestamp: new Date().toISOString(),
    };
    setExpenses(prev => [expense, ...prev]);
    setAmount('');
    setDescription('');
    setCategory('Food');
  }, [amount, description, category, today]);

  const handleDelete = useCallback((id: number) => {
    Alert.alert('Delete', 'Remove this expense?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setExpenses(prev => prev.filter(e => e.id !== id)) },
    ]);
  }, []);

  const startEdit = useCallback((exp: Expense) => {
    setEditingId(exp.id);
    setEditAmount(String(exp.amount));
    setEditDescription(exp.description);
    setEditCategory(exp.category);
  }, []);

  const handleSaveEdit = useCallback(() => {
    const amt = parseFloat(editAmount);
    if (isNaN(amt) || amt <= 0) { Alert.alert('Invalid amount'); return; }
    setExpenses(prev => prev.map(e =>
      e.id === editingId
        ? { ...e, amount: amt, description: editDescription.trim(), category: editCategory }
        : e
    ));
    setEditingId(null);
  }, [editingId, editAmount, editDescription, editCategory]);

  const handleSaveBudget = useCallback(() => {
    const val = parseFloat(budgetInput);
    if (isNaN(val) || val <= 0) { Alert.alert('Invalid budget'); return; }
    setBudget(val);
    setShowBudgetModal(false);
  }, [budgetInput]);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>💰 Expense Tracker</Text>
          <Text style={s.subtitle}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        </View>

        {/* Budget summary card */}
        <View style={s.budgetCard}>
          <View style={s.budgetRow}>
            <View>
              <Text style={s.budgetLabel}>Spent Today</Text>
              <Text style={[s.budgetSpent, overBudget && { color: '#FF453A' }]}>${todayTotal.toFixed(2)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.budgetLabel}>Daily Budget</Text>
              <TouchableOpacity onPress={() => { setBudgetInput(String(budget)); setShowBudgetModal(true); }}>
                <Text style={s.budgetAmount}>${budget.toFixed(2)} ✏️</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Progress bar */}
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${budgetPct}%` as any, backgroundColor: overBudget ? '#FF453A' : '#30D158' }]} />
          </View>

          <View style={s.budgetFooter}>
            <Text style={s.budgetRemaining}>
              {overBudget
                ? `$${Math.abs(remaining).toFixed(2)} over budget`
                : `$${remaining.toFixed(2)} remaining`}
            </Text>
            <Text style={s.budgetMonth}>Month: ${monthTotal.toFixed(2)}</Text>
          </View>
          <Text style={s.motivation}>{getMotivation(todayTotal, budget)}</Text>
        </View>

        {/* Category breakdown */}
        {breakdown.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Today's Breakdown</Text>
            <View style={s.breakdownCard}>
              {breakdown.map(cat => {
                const pct = (cat.total / todayTotal) * 100;
                return (
                  <View key={cat.key} style={s.breakdownRow}>
                    <Text style={s.breakdownEmoji}>{cat.emoji}</Text>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={s.breakdownLabelRow}>
                        <Text style={s.breakdownLabel}>{cat.label}</Text>
                        <Text style={[s.breakdownAmount, { color: cat.color }]}>${cat.total.toFixed(2)}</Text>
                        <Text style={s.breakdownPct}>{pct.toFixed(0)}%</Text>
                      </View>
                      <View style={s.miniBar}>
                        <View style={[s.miniBarFill, { width: `${pct}%` as any, backgroundColor: cat.color }]} />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Add expense */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Add Expense</Text>
          <View style={s.addCard}>
            {/* Category picker */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.key}
                  style={[s.catChip, category === cat.key && { borderColor: cat.color, backgroundColor: cat.color + '22' }]}
                  onPress={() => setCategory(cat.key)}
                >
                  <Text style={s.catEmoji}>{cat.emoji}</Text>
                  <Text style={[s.catLabel, category === cat.key && { color: cat.color }]}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={s.inputRow}>
              <View style={s.amountWrap}>
                <Text style={s.dollarSign}>$</Text>
                <TextInput
                  style={s.amountInput}
                  placeholder="0.00"
                  placeholderTextColor="#48484A"
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>
              <TextInput
                style={s.descInput}
                placeholder="Description"
                placeholderTextColor="#48484A"
                value={description}
                onChangeText={setDescription}
              />
            </View>
            <TouchableOpacity style={s.addBtn} onPress={handleAdd}>
              <Text style={s.addBtnText}>+ Add Expense</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Today's expenses */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Today's Expenses</Text>
          {todayExpenses.length === 0 ? (
            <Text style={s.emptyText}>No expenses yet today.</Text>
          ) : (
            todayExpenses.map(exp => {
              const meta = categoryMeta(exp.category);
              const isEditing = editingId === exp.id;
              return (
                <View key={exp.id} style={s.expenseItem}>
                  {isEditing ? (
                    <View style={s.editInner}>
                      {/* Edit category */}
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll}>
                        {CATEGORIES.map(cat => (
                          <TouchableOpacity
                            key={cat.key}
                            style={[s.catChip, editCategory === cat.key && { borderColor: cat.color, backgroundColor: cat.color + '22' }]}
                            onPress={() => setEditCategory(cat.key)}
                          >
                            <Text style={s.catEmoji}>{cat.emoji}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      <View style={s.inputRow}>
                        <View style={s.amountWrap}>
                          <Text style={s.dollarSign}>$</Text>
                          <TextInput
                            style={s.amountInput}
                            keyboardType="decimal-pad"
                            value={editAmount}
                            onChangeText={setEditAmount}
                          />
                        </View>
                        <TextInput
                          style={s.descInput}
                          value={editDescription}
                          onChangeText={setEditDescription}
                        />
                      </View>
                      <View style={s.editActions}>
                        <TouchableOpacity style={s.saveBtn} onPress={handleSaveEdit}>
                          <Text style={s.saveBtnText}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.cancelBtn} onPress={() => setEditingId(null)}>
                          <Text style={s.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={s.expenseInner}>
                      <Text style={[s.expenseEmoji, { color: meta.color }]}>{meta.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.expenseDesc}>{exp.description}</Text>
                        <Text style={s.expenseMeta}>{meta.label} · {formatTime(exp.timestamp)}</Text>
                      </View>
                      <Text style={[s.expenseAmount, { color: meta.color }]}>${exp.amount.toFixed(2)}</Text>
                      <TouchableOpacity onPress={() => startEdit(exp)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={s.actionBtn}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(exp.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={s.actionBtn}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Budget edit modal */}
      <Modal visible={showBudgetModal} transparent animationType="slide" onRequestClose={() => setShowBudgetModal(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowBudgetModal(false)}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Set Daily Budget</Text>
            <View style={s.amountWrap}>
              <Text style={s.dollarSign}>$</Text>
              <TextInput
                style={[s.amountInput, { fontSize: 24, flex: 1 }]}
                keyboardType="decimal-pad"
                value={budgetInput}
                onChangeText={setBudgetInput}
                autoFocus
              />
            </View>
            <TouchableOpacity style={[s.addBtn, { marginTop: 16 }]} onPress={handleSaveBudget}>
              <Text style={s.addBtnText}>Save Budget</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },

  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 13, color: '#636366', marginTop: 4 },

  // Budget card
  budgetCard: {
    marginHorizontal: 20, marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 10,
  },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  budgetLabel: { fontSize: 12, color: '#636366', marginBottom: 2 },
  budgetSpent: { fontSize: 32, fontWeight: '800', color: '#FFFFFF' },
  budgetAmount: { fontSize: 18, fontWeight: '600', color: '#30D158' },
  progressBar: { height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  budgetFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  budgetRemaining: { fontSize: 13, color: '#636366' },
  budgetMonth: { fontSize: 13, color: '#636366' },
  motivation: { fontSize: 14, color: '#EBEBF5', fontWeight: '500', textAlign: 'center' },

  // Breakdown
  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: '#EBEBF5', marginBottom: 10 },
  breakdownCard: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16,
    padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 12,
  },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  breakdownEmoji: { fontSize: 20, width: 28, textAlign: 'center' },
  breakdownLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  breakdownLabel: { fontSize: 13, color: '#EBEBF5', flex: 1 },
  breakdownAmount: { fontSize: 13, fontWeight: '600' },
  breakdownPct: { fontSize: 12, color: '#636366', width: 32, textAlign: 'right' },
  miniBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  miniBarFill: { height: '100%', borderRadius: 2 },

  // Add form
  addCard: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16,
    padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 12,
  },
  catScroll: { marginBottom: 2 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginRight: 8,
  },
  catEmoji: { fontSize: 15 },
  catLabel: { fontSize: 12, color: '#636366', fontWeight: '500' },
  inputRow: { flexDirection: 'row', gap: 10 },
  amountWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10,
    paddingHorizontal: 10, width: 100,
  },
  dollarSign: { fontSize: 16, color: '#636366', marginRight: 2 },
  amountInput: { fontSize: 16, color: '#FFFFFF', flex: 1, paddingVertical: 10 },
  descInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#FFFFFF',
  },
  addBtn: { backgroundColor: '#F59E0B', borderRadius: 12, padding: 14, alignItems: 'center' },
  addBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },

  // Expense items
  expenseItem: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
    marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  expenseInner: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  expenseEmoji: { fontSize: 22, width: 30, textAlign: 'center' },
  expenseDesc: { fontSize: 14, color: '#EBEBF5', fontWeight: '500' },
  expenseMeta: { fontSize: 12, color: '#636366', marginTop: 2 },
  expenseAmount: { fontSize: 16, fontWeight: '700' },
  actionBtn: { fontSize: 16, color: '#48484A', paddingHorizontal: 4 },
  editInner: { padding: 12, gap: 10 },
  editActions: { flexDirection: 'row', gap: 10 },
  saveBtn: { flex: 1, backgroundColor: '#F59E0B', borderRadius: 10, padding: 11, alignItems: 'center' },
  saveBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  cancelBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 11, alignItems: 'center' },
  cancelBtnText: { color: '#636366', fontSize: 14 },

  emptyText: { fontSize: 14, color: '#48484A', textAlign: 'center', paddingVertical: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 16 },
});
