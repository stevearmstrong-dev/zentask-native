import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User } from '@supabase/supabase-js';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

function getKeys(userEmail: string) {
  const ns = userEmail || 'guest';
  return { REMINDERS_KEY: `zentask:recurring_reminders:${ns}` };
}

type DueDay = number | 'last' | 'weekly-thursday' | 'weekly-friday' | 'weekly-saturday';

interface Reminder {
  id: string;
  name: string;
  category: 'credit-card' | 'utility' | 'subscription' | 'emi' | 'rent' | 'other';
  dueDay: DueDay;
  icon: string;
  amount?: number;
}

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  'credit-card':  { label: 'Credit Card',  color: '#3B82F6' },
  'utility':      { label: 'Utility',      color: '#F59E0B' },
  'subscription': { label: 'Subscription', color: '#8B5CF6' },
  'emi':          { label: 'EMI / Loan',   color: '#EF4444' },
  'rent':         { label: 'Rent',         color: '#10B981' },
  'other':        { label: 'Other',        color: '#6B7280' },
};

const DEFAULT_REMINDERS: Reminder[] = [
  // Credit cards
  { id: 'pc-financial',   name: 'PC Financial',      category: 'credit-card',  dueDay: 20,                 icon: '💳' },
  { id: 'td-bank',        name: 'TD Bank',            category: 'credit-card',  dueDay: 23,                 icon: '💳' },
  { id: 'cibc',           name: 'CIBC Bank',          category: 'credit-card',  dueDay: 25,                 icon: '💳' },
  { id: 'amex',           name: 'American Express',   category: 'credit-card',  dueDay: 27,                 icon: '💳' },
  // EMI
  { id: 'ipad',           name: 'iPad Payment',       category: 'emi',          dueDay: 20,                 icon: '📱' },
  { id: 'edu-loan',       name: 'Education Loan EMI', category: 'emi',          dueDay: 1,                  icon: '🎓' },
  // Utilities
  { id: 'phone',          name: 'Phone Bill',         category: 'utility',      dueDay: 27,                 icon: '📞' },
  { id: 'wifi',           name: 'WiFi',               category: 'utility',      dueDay: 'last',             icon: '📶' },
  { id: 'electricity',    name: 'Power / Electricity',category: 'utility',      dueDay: 'last',             icon: '💡' },
  // Subscriptions
  { id: 'chatgpt',        name: 'ChatGPT',            category: 'subscription', dueDay: 4,                  icon: '🤖' },
  { id: 'walmart-plus',   name: 'Walmart+',           category: 'subscription', dueDay: 6,                  icon: '🛒' },
  { id: 'claude',         name: 'Claude',             category: 'subscription', dueDay: 10,                 icon: '🧠' },
  { id: 'cursor',         name: 'Cursor',             category: 'subscription', dueDay: 10,                 icon: '⌨️' },
  { id: 'squarespace',    name: 'Squarespace',        category: 'subscription', dueDay: 10,                 icon: '🌐' },
  { id: 'factor-meals',   name: 'Factor Meals',       category: 'subscription', dueDay: 'weekly-thursday',  icon: '🍳' },
  // Other
  { id: 'mom',            name: 'Money to Mom',       category: 'other',        dueDay: 1,                  icon: '👩' },
  { id: 'gym',            name: 'Gym Membership',     category: 'other',        dueDay: 2,                  icon: '🏋️' },
  { id: 'walmart-groc',   name: 'Walmart Grocery',    category: 'other',        dueDay: 'weekly-saturday',  icon: '🛍️' },
  { id: 'rent',           name: 'Monthly Rent',       category: 'rent',         dueDay: 'last',             icon: '🏠' },
];

function getDueDate(dueDay: DueDay): Date {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (dueDay === 'last') {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    if (lastDay < today) return new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return lastDay;
  }

  const weeklyMap: Record<string, number> = {
    'weekly-thursday': 4,
    'weekly-friday':   5,
    'weekly-saturday': 6,
  };

  if (typeof dueDay === 'string' && dueDay.startsWith('weekly-')) {
    const targetDow = weeklyMap[dueDay];
    const diff = (targetDow - today.getDay() + 7) % 7;
    return new Date(today.getTime() + diff * 86400000);
  }

  // Specific day of month
  let candidate = new Date(now.getFullYear(), now.getMonth(), dueDay as number);
  if (candidate < today) candidate = new Date(now.getFullYear(), now.getMonth() + 1, dueDay as number);
  return candidate;
}

function getDaysUntilDue(dueDay: DueDay): number {
  const due = getDueDate(dueDay);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function formatDueDate(dueDay: DueDay): string {
  return getDueDate(dueDay).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

type Urgency = 'overdue' | 'today' | 'tomorrow' | 'this-week' | 'upcoming';

function getUrgency(days: number): Urgency {
  if (days < 0)  return 'overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 5)  return 'this-week';
  return 'upcoming';
}

const URGENCY_META: Record<Urgency, { label: string; color: string; bg: string }> = {
  overdue:    { label: 'Overdue',       color: '#FF453A', bg: 'rgba(255,69,58,0.1)'  },
  today:      { label: 'Due Today',     color: '#FF9F0A', bg: 'rgba(255,159,10,0.1)' },
  tomorrow:   { label: 'Due Tomorrow',  color: '#FFD60A', bg: 'rgba(255,214,10,0.08)'},
  'this-week':{ label: 'This Week',     color: '#30D158', bg: 'rgba(48,209,88,0.08)' },
  upcoming:   { label: 'Upcoming',      color: '#636366', bg: 'rgba(255,255,255,0.04)'},
};

const URGENCY_ORDER: Urgency[] = ['overdue', 'today', 'tomorrow', 'this-week', 'upcoming'];

interface Props {
  user?: User | null;
}

const CATEGORIES = Object.keys(CATEGORY_META) as Array<keyof typeof CATEGORY_META>;
const DUE_DAY_OPTIONS: { label: string; value: DueDay }[] = [
  ...Array.from({ length: 28 }, (_, i) => ({ label: `${i + 1}${['st','nd','rd'][i] ?? 'th'}`, value: i + 1 as DueDay })),
  { label: 'Last day', value: 'last' },
  { label: 'Weekly Thu', value: 'weekly-thursday' },
  { label: 'Weekly Fri', value: 'weekly-friday' },
  { label: 'Weekly Sat', value: 'weekly-saturday' },
];

export default function RecurringExpensesScreen({ user }: Props) {
  const userEmail = user?.email || '';
  const { REMINDERS_KEY } = useMemo(() => getKeys(userEmail), [userEmail]);

  const [reminders, setReminders] = useState<Reminder[]>(DEFAULT_REMINDERS);
  const [loaded, setLoaded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // Add form
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('💳');
  const [newCategory, setNewCategory] = useState<Reminder['category']>('other');
  const [newDueDay, setNewDueDay] = useState<DueDay>(1);
  const [newAmount, setNewAmount] = useState('');

  // Load
  useEffect(() => {
    setLoaded(false);
    setReminders([]);
    AsyncStorage.getItem(REMINDERS_KEY).then(raw => {
      if (raw) setReminders(JSON.parse(raw));
      else setReminders(DEFAULT_REMINDERS);
      setLoaded(true);
    }).catch(console.error);
  }, [REMINDERS_KEY]);

  // Persist
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders)).catch(console.error);
  }, [reminders, loaded]);

  // Group by urgency
  const grouped = URGENCY_ORDER.reduce<Record<Urgency, (Reminder & { days: number })[]>>(
    (acc, u) => { acc[u] = []; return acc; },
    {} as any
  );
  reminders.forEach(r => {
    const days = getDaysUntilDue(r.dueDay);
    const urgency = getUrgency(days);
    grouped[urgency].push({ ...r, days });
  });

  const needsAttention = grouped.overdue.length + grouped.today.length;
  const thisWeek = grouped.tomorrow.length + grouped['this-week'].length;

  const handleAdd = useCallback(() => {
    if (!newName.trim()) { Alert.alert('Enter a name'); return; }
    const reminder: Reminder = {
      id: String(Date.now()),
      name: newName.trim(),
      icon: newIcon || '💳',
      category: newCategory,
      dueDay: newDueDay,
      amount: newAmount ? parseFloat(newAmount) : undefined,
    };
    setReminders(prev => [...prev, reminder]);
    setShowAdd(false);
    setNewName(''); setNewIcon('💳'); setNewCategory('other'); setNewDueDay(1); setNewAmount('');
  }, [newName, newIcon, newCategory, newDueDay, newAmount]);

  const handleDelete = useCallback((id: string) => {
    Alert.alert('Remove', 'Remove this reminder?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setReminders(prev => prev.filter(r => r.id !== id)) },
    ]);
  }, []);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>📅 Recurring Expenses</Text>
          <Text style={s.subtitle}>Payment reminders & subscriptions</Text>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={[s.statCard, needsAttention > 0 && s.statCardAlert]}>
            <Text style={[s.statValue, needsAttention > 0 && { color: '#FF453A' }]}>{needsAttention}</Text>
            <Text style={s.statLabel}>Needs Attention</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: '#30D158' }]}>{thisWeek}</Text>
            <Text style={s.statLabel}>Due This Week</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statValue}>{reminders.length}</Text>
            <Text style={s.statLabel}>Total Reminders</Text>
          </View>
        </View>

        {/* Grouped sections */}
        {URGENCY_ORDER.map(urgency => {
          const items = grouped[urgency];
          if (items.length === 0) return null;
          const meta = URGENCY_META[urgency];
          return (
            <View key={urgency} style={s.section}>
              <View style={[s.urgencyHeader, { borderLeftColor: meta.color }]}>
                <Text style={[s.urgencyLabel, { color: meta.color }]}>{meta.label}</Text>
                <Text style={s.urgencyCount}>{items.length}</Text>
              </View>
              {items.map(r => {
                const catMeta = CATEGORY_META[r.category];
                const daysAbs = Math.abs(r.days);
                let daysLabel = '';
                if (urgency === 'overdue')    daysLabel = `${daysAbs}d overdue`;
                else if (urgency === 'today') daysLabel = 'Today';
                else if (urgency === 'tomorrow') daysLabel = 'Tomorrow';
                else                          daysLabel = `in ${r.days}d`;

                return (
                  <View key={r.id} style={[s.reminderCard, { backgroundColor: meta.bg, borderColor: meta.color + '44' }]}>
                    <Text style={s.reminderIcon}>{r.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.reminderName}>{r.name}</Text>
                      <View style={s.reminderMeta}>
                        <View style={[s.catBadge, { backgroundColor: catMeta.color + '22' }]}>
                          <Text style={[s.catBadgeText, { color: catMeta.color }]}>{catMeta.label}</Text>
                        </View>
                        <Text style={s.reminderDate}>{formatDueDate(r.dueDay)}</Text>
                      </View>
                      {r.amount != null && (
                        <Text style={[s.reminderAmount, { color: meta.color }]}>${r.amount.toFixed(2)}</Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <View style={[s.urgencyBadge, { backgroundColor: meta.color + '22' }]}>
                        <Text style={[s.urgencyBadgeText, { color: meta.color }]}>{daysLabel}</Text>
                      </View>
                      <TouchableOpacity onPress={() => handleDelete(r.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={s.deleteBtn}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}

        {/* Add button */}
        <TouchableOpacity style={s.addFab} onPress={() => setShowAdd(true)}>
          <Text style={s.addFabText}>+ Add Reminder</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Add modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowAdd(false)}>
          <ScrollView style={s.modalCard} keyboardShouldPersistTaps="handled" bounces={false}>
            <Text style={s.modalTitle}>Add Reminder</Text>

            <Text style={s.fieldLabel}>Name</Text>
            <TextInput
              style={s.textInput}
              placeholder="e.g. Netflix"
              placeholderTextColor="#48484A"
              value={newName}
              onChangeText={setNewName}
            />

            <Text style={s.fieldLabel}>Icon (emoji)</Text>
            <TextInput
              style={s.textInput}
              placeholder="💳"
              placeholderTextColor="#48484A"
              value={newIcon}
              onChangeText={setNewIcon}
              maxLength={4}
            />

            <Text style={s.fieldLabel}>Amount (optional)</Text>
            <View style={s.amountWrap}>
              <Text style={s.dollarSign}>$</Text>
              <TextInput
                style={[s.textInput, { flex: 1, borderWidth: 0, padding: 0 }]}
                placeholder="0.00"
                placeholderTextColor="#48484A"
                keyboardType="decimal-pad"
                value={newAmount}
                onChangeText={setNewAmount}
              />
            </View>

            <Text style={s.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {CATEGORIES.map(cat => {
                const meta = CATEGORY_META[cat];
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[s.catChip, newCategory === cat && { borderColor: meta.color, backgroundColor: meta.color + '22' }]}
                    onPress={() => setNewCategory(cat)}
                  >
                    <Text style={[s.catChipText, newCategory === cat && { color: meta.color }]}>{meta.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={s.fieldLabel}>Due Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {DUE_DAY_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={String(opt.value)}
                  style={[s.dayChip, newDueDay === opt.value && s.dayChipActive]}
                  onPress={() => setNewDueDay(opt.value)}
                >
                  <Text style={[s.dayChipText, newDueDay === opt.value && s.dayChipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={s.addBtn} onPress={handleAdd}>
              <Text style={s.addBtnText}>Add Reminder</Text>
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
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

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  statCardAlert: { borderColor: 'rgba(255,69,58,0.3)', backgroundColor: 'rgba(255,69,58,0.08)' },
  statValue: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
  statLabel: { fontSize: 11, color: '#636366', marginTop: 3, textAlign: 'center' },

  section: { paddingHorizontal: 20, marginBottom: 16 },
  urgencyHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderLeftWidth: 3, paddingLeft: 10, marginBottom: 8,
  },
  urgencyLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  urgencyCount: { fontSize: 12, color: '#636366' },

  reminderCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, padding: 14, marginBottom: 8,
    borderWidth: 1, gap: 12,
  },
  reminderIcon: { fontSize: 24, width: 32, textAlign: 'center' },
  reminderName: { fontSize: 15, color: '#EBEBF5', fontWeight: '600', marginBottom: 4 },
  reminderMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  catBadgeText: { fontSize: 11, fontWeight: '600' },
  reminderDate: { fontSize: 12, color: '#636366' },
  reminderAmount: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  urgencyBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  urgencyBadgeText: { fontSize: 11, fontWeight: '700' },
  deleteBtn: { fontSize: 14, color: '#48484A' },

  addFab: {
    marginHorizontal: 20, backgroundColor: '#F59E0B',
    borderRadius: 16, padding: 16, alignItems: 'center',
  },
  addFabText: { color: '#000', fontWeight: '700', fontSize: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '85%',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginBottom: 20 },
  fieldLabel: { fontSize: 13, color: '#636366', fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#FFFFFF',
    marginBottom: 14,
  },
  amountWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10,
    paddingHorizontal: 14, marginBottom: 14,
  },
  dollarSign: { fontSize: 16, color: '#636366', marginRight: 4 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)', marginRight: 8,
  },
  catChipText: { fontSize: 13, color: '#636366', fontWeight: '500' },
  dayChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)', marginRight: 8,
  },
  dayChipActive: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  dayChipText: { fontSize: 13, color: '#636366', fontWeight: '500' },
  dayChipTextActive: { color: '#000', fontWeight: '700' },
  addBtn: { backgroundColor: '#F59E0B', borderRadius: 14, padding: 16, alignItems: 'center' },
  addBtnText: { color: '#000', fontWeight: '700', fontSize: 16 },
});
