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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_BUDGET = 18;

function getKeys(userEmail: string) {
  const ns = userEmail || 'guest';
  return {
    EXPENSES_KEY: `zentask:expenses:${ns}`,
    BUDGET_KEY: `zentask:daily_budget:${ns}`,
  };
}

interface Expense {
  id: number;
  amount: number;
  category: string;
  description: string;
  date: string;
  timestamp: string;
}

const CATEGORIES: { key: string; label: string; emoji: string; color: string }[] = [
  { key: 'Food',          label: 'Food',          emoji: '🍔', color: '#FF6B5B' },
  { key: 'Transport',     label: 'Transport',     emoji: '🚗', color: '#FF8C69' },
  { key: 'Entertainment', label: 'Entertainment', emoji: '🎮', color: '#FF5C8D' },
  { key: 'Shopping',      label: 'Shopping',      emoji: '🛍️', color: '#FF6B5B' },
  { key: 'Bills',         label: 'Bills',         emoji: '💡', color: '#FF8C69' },
  { key: 'Health',        label: 'Health',        emoji: '💊', color: '#4CAF82' },
  { key: 'Other',         label: 'Other',         emoji: '💰', color: '#9E9E9E' },
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

interface Props { user?: User | null; }

export default function ExpenseTrackerScreen({ user }: Props) {
  const userEmail = user?.email || '';
  const { EXPENSES_KEY, BUDGET_KEY } = useMemo(() => getKeys(userEmail), [userEmail]);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  const [loaded, setLoaded] = useState(false);

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Food');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('Food');

  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setExpenses([]);
    setBudget(DEFAULT_BUDGET);
    Promise.all([
      AsyncStorage.getItem(EXPENSES_KEY),
      AsyncStorage.getItem(BUDGET_KEY),
    ]).then(([rawExp, rawBudget]) => {
      if (rawExp) setExpenses(JSON.parse(rawExp));
      if (rawBudget) setBudget(Number(rawBudget));
      setLoaded(true);
    }).catch(console.error);
  }, [EXPENSES_KEY, BUDGET_KEY]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses)).catch(console.error);
  }, [expenses, loaded]);

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
    setShowAddModal(false);
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

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Expenses</Text>
            <Text style={s.subtitle}>{dateLabel}</Text>
          </View>
          <TouchableOpacity
            style={s.addFab}
            onPress={() => setShowAddModal(true)}
            activeOpacity={0.85}
          >
            <Text style={s.addFabText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Balance card — inspired by the credit card hero */}
        <View style={s.heroCard}>
          {/* Decorative circles */}
          <View style={s.heroCircle1} />
          <View style={s.heroCircle2} />

          <View style={s.heroTop}>
            <Text style={s.heroLabel}>SPENT TODAY</Text>
            <TouchableOpacity onPress={() => { setBudgetInput(String(budget)); setShowBudgetModal(true); }}>
              <Text style={s.heroBudgetLabel}>Budget: ${budget.toFixed(0)} ✏️</Text>
            </TouchableOpacity>
          </View>

          <Text style={[s.heroAmount, overBudget && { color: '#FF453A' }]}>
            ${todayTotal.toFixed(2)}
          </Text>

          <View style={s.heroProgressRow}>
            <View style={s.heroProgressBar}>
              <View style={[s.heroProgressFill, {
                width: `${budgetPct}%` as any,
                backgroundColor: overBudget ? '#FF453A' : '#FF6B5B',
              }]} />
            </View>
            <Text style={s.heroProgressPct}>{Math.round(budgetPct)}%</Text>
          </View>

          <View style={s.heroFooter}>
            <View style={s.heroStat}>
              <Text style={s.heroStatLabel}>Remaining</Text>
              <Text style={[s.heroStatValue, overBudget && { color: '#FF453A' }]}>
                {overBudget ? `-$${Math.abs(remaining).toFixed(2)}` : `$${remaining.toFixed(2)}`}
              </Text>
            </View>
            <View style={s.heroStatDivider} />
            <View style={s.heroStat}>
              <Text style={s.heroStatLabel}>This Month</Text>
              <Text style={s.heroStatValue}>${monthTotal.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Summary chips — expense / income style from the reference */}
        <View style={s.summaryRow}>
          <View style={[s.summaryChip, s.summaryChipRed]}>
            <View style={s.summaryArrow}>
              <Text style={s.summaryArrowText}>↑</Text>
            </View>
            <View>
              <Text style={s.summaryChipLabel}>Expense</Text>
              <Text style={s.summaryChipValue}>${todayTotal.toFixed(2)}</Text>
            </View>
          </View>
          <View style={[s.summaryChip, s.summaryChipDark]}>
            <View style={[s.summaryArrow, s.summaryArrowDown]}>
              <Text style={s.summaryArrowText}>↓</Text>
            </View>
            <View>
              <Text style={s.summaryChipLabel}>Budget Left</Text>
              <Text style={s.summaryChipValue}>${Math.max(remaining, 0).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Category breakdown */}
        {breakdown.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Today's Breakdown</Text>
            </View>
            <View style={s.breakdownCard}>
              {breakdown.map(cat => {
                const pct = (cat.total / todayTotal) * 100;
                return (
                  <View key={cat.key} style={s.breakdownRow}>
                    <View style={[s.breakdownIconWrap, { backgroundColor: cat.color + '22' }]}>
                      <Text style={s.breakdownEmoji}>{cat.emoji}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 5 }}>
                      <View style={s.breakdownLabelRow}>
                        <Text style={s.breakdownLabel}>{cat.label}</Text>
                        <Text style={[s.breakdownAmount, { color: cat.color }]}>${cat.total.toFixed(2)}</Text>
                      </View>
                      <View style={s.miniBar}>
                        <View style={[s.miniBarFill, { width: `${pct}%` as any, backgroundColor: cat.color }]} />
                      </View>
                    </View>
                    <Text style={s.breakdownPct}>{pct.toFixed(0)}%</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Transaction list */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Transactions</Text>
            <Text style={s.seeAll}>{todayExpenses.length} today</Text>
          </View>

          {todayExpenses.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyText}>No expenses yet today</Text>
              <Text style={s.emptySubtext}>Tap + to add your first expense</Text>
            </View>
          ) : (
            todayExpenses.map(exp => {
              const meta = categoryMeta(exp.category);
              const isEditing = editingId === exp.id;
              return (
                <View key={exp.id} style={s.txItem}>
                  {isEditing ? (
                    <View style={s.editInner}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 8 }}>
                          {CATEGORIES.map(cat => (
                            <TouchableOpacity
                              key={cat.key}
                              style={[s.catChip, editCategory === cat.key && { borderColor: cat.color, backgroundColor: cat.color + '22' }]}
                              onPress={() => setEditCategory(cat.key)}
                            >
                              <Text style={s.catEmoji}>{cat.emoji}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
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
                          placeholderTextColor="#555"
                        />
                      </View>
                      <View style={s.editActions}>
                        <TouchableOpacity style={s.saveBtn} onPress={handleSaveEdit}>
                          <Text style={s.saveBtnText}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.cancelEditBtn} onPress={() => setEditingId(null)}>
                          <Text style={s.cancelEditBtnText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={s.txInner}>
                      <View style={[s.txIconWrap, { backgroundColor: meta.color + '22' }]}>
                        <Text style={s.txEmoji}>{meta.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.txDesc}>{exp.description}</Text>
                        <Text style={s.txMeta}>{meta.label} · {formatTime(exp.timestamp)}</Text>
                      </View>
                      <Text style={[s.txAmount, { color: '#FF6B5B' }]}>-${exp.amount.toFixed(2)}</Text>
                      <TouchableOpacity onPress={() => startEdit(exp)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={s.txAction}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(exp.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={s.txActionDel}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add Expense Modal */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowAddModal(false)}>
          <View style={s.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={s.modalTitle}>Add Expense</Text>

            <Text style={s.modalLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
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
              </View>
            </ScrollView>

            <Text style={s.modalLabel}>Amount</Text>
            <View style={[s.amountWrap, { width: '100%', marginBottom: 12 }]}>
              <Text style={s.dollarSign}>$</Text>
              <TextInput
                style={[s.amountInput, { flex: 1, fontSize: 20 }]}
                placeholder="0.00"
                placeholderTextColor="#444"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                autoFocus
              />
            </View>

            <Text style={s.modalLabel}>Description</Text>
            <TextInput
              style={[s.descInput, { width: '100%', marginBottom: 20 }]}
              placeholder="What did you spend on?"
              placeholderTextColor="#444"
              value={description}
              onChangeText={setDescription}
            />

            <TouchableOpacity style={s.modalAddBtn} onPress={handleAdd}>
              <Text style={s.modalAddBtnText}>Add Expense</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Budget modal */}
      <Modal visible={showBudgetModal} transparent animationType="slide" onRequestClose={() => setShowBudgetModal(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowBudgetModal(false)}>
          <View style={s.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={s.modalTitle}>Set Daily Budget</Text>
            <View style={[s.amountWrap, { width: '100%', marginBottom: 20 }]}>
              <Text style={s.dollarSign}>$</Text>
              <TextInput
                style={[s.amountInput, { fontSize: 24, flex: 1 }]}
                keyboardType="decimal-pad"
                value={budgetInput}
                onChangeText={setBudgetInput}
                autoFocus
              />
            </View>
            <TouchableOpacity style={s.modalAddBtn} onPress={handleSaveBudget}>
              <Text style={s.modalAddBtnText}>Save Budget</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111318' },

  // Header
  header: {
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#5A5A72', marginTop: 2 },
  addFab: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FF6B5B',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF6B5B', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  addFabText: { fontSize: 24, color: '#FFFFFF', fontWeight: '300', lineHeight: 28 },

  // Hero card
  heroCard: {
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: '#1E1E2A',
    borderRadius: 24, padding: 22,
    borderWidth: 1, borderColor: 'rgba(255,107,91,0.15)',
    overflow: 'hidden',
    shadowColor: '#FF6B5B', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 6,
  },
  heroCircle1: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,107,91,0.07)',
    top: -50, right: -40,
  },
  heroCircle2: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,107,91,0.05)',
    top: 20, right: 30,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  heroLabel: { fontSize: 11, fontWeight: '700', color: '#5A5A72', letterSpacing: 1.5, textTransform: 'uppercase' },
  heroBudgetLabel: { fontSize: 12, color: '#FF6B5B', fontWeight: '600' },
  heroAmount: { fontSize: 44, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1, marginBottom: 14 },
  heroProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  heroProgressBar: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  heroProgressFill: { height: '100%', borderRadius: 3 },
  heroProgressPct: { fontSize: 12, fontWeight: '600', color: '#5A5A72', width: 34, textAlign: 'right' },
  heroFooter: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatLabel: { fontSize: 11, color: '#5A5A72', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  heroStatValue: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  heroStatDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.08)' },

  // Summary chips
  summaryRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 24 },
  summaryChip: {
    flex: 1, borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  summaryChipRed: { backgroundColor: '#FF6B5B', shadowColor: '#FF6B5B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },
  summaryChipDark: { backgroundColor: '#1E1E2A', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  summaryArrow: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  summaryArrowDown: { backgroundColor: 'rgba(255,255,255,0.1)' },
  summaryArrowText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  summaryChipLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryChipValue: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },

  // Section
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  seeAll: { fontSize: 13, color: '#5A5A72' },

  // Breakdown
  breakdownCard: {
    backgroundColor: '#1E1E2A', borderRadius: 18,
    padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 14,
  },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  breakdownIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  breakdownEmoji: { fontSize: 18 },
  breakdownLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  breakdownLabel: { fontSize: 13, color: '#CCCCDD', fontWeight: '500' },
  breakdownAmount: { fontSize: 13, fontWeight: '700' },
  breakdownPct: { fontSize: 12, color: '#5A5A72', width: 34, textAlign: 'right' },
  miniBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginTop: 2 },
  miniBarFill: { height: '100%', borderRadius: 2 },

  // Transaction items
  txItem: {
    backgroundColor: '#1E1E2A', borderRadius: 16,
    marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  txInner: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  txIconWrap: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  txEmoji: { fontSize: 20 },
  txDesc: { fontSize: 15, color: '#FFFFFF', fontWeight: '600' },
  txMeta: { fontSize: 12, color: '#5A5A72', marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '700' },
  txAction: { fontSize: 16, paddingHorizontal: 4 },
  txActionDel: { fontSize: 14, color: '#5A5A72', paddingHorizontal: 4 },

  // Edit inline
  editInner: { padding: 14, gap: 10 },
  inputRow: { flexDirection: 'row', gap: 10 },
  amountWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#2A2A38', borderRadius: 12,
    paddingHorizontal: 12, width: 110, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  dollarSign: { fontSize: 16, color: '#5A5A72', marginRight: 2 },
  amountInput: { fontSize: 16, color: '#FFFFFF', flex: 1, paddingVertical: 12 },
  descInput: {
    flex: 1, backgroundColor: '#2A2A38', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#FFFFFF',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  editActions: { flexDirection: 'row', gap: 10 },
  saveBtn: { flex: 1, backgroundColor: '#FF6B5B', borderRadius: 10, padding: 11, alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  cancelEditBtn: { flex: 1, backgroundColor: '#2A2A38', borderRadius: 10, padding: 11, alignItems: 'center' },
  cancelEditBtnText: { color: '#5A5A72', fontSize: 14 },

  // Category chips
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  catEmoji: { fontSize: 15 },
  catLabel: { fontSize: 12, color: '#888', fontWeight: '500' },

  // Empty state
  emptyBox: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 16, color: '#CCCCDD', fontWeight: '600' },
  emptySubtext: { fontSize: 13, color: '#5A5A72', marginTop: 4 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#1A1A25', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 48,
    borderWidth: 1, borderColor: 'rgba(255,107,91,0.15)',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 20, letterSpacing: -0.3 },
  modalLabel: { fontSize: 12, fontWeight: '600', color: '#5A5A72', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  modalAddBtn: {
    backgroundColor: '#FF6B5B', borderRadius: 14, padding: 16, alignItems: 'center',
    shadowColor: '#FF6B5B', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 12, elevation: 6,
  },
  modalAddBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
