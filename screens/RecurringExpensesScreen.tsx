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
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
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

const SUGGESTIONS: Reminder[] = [
  { id: 's-visa',         name: 'Visa',               category: 'credit-card',  dueDay: 1,                 icon: '💳' },
  { id: 's-mastercard',   name: 'Mastercard',         category: 'credit-card',  dueDay: 1,                 icon: '💳' },
  { id: 's-amex',         name: 'Amex',               category: 'credit-card',  dueDay: 1,                 icon: '💳' },
  { id: 's-pc-financial', name: 'PC Financial',       category: 'credit-card',  dueDay: 1,                 icon: '💳' },
  { id: 's-td-bank',      name: 'TD Bank',            category: 'credit-card',  dueDay: 1,                 icon: '💳' },
  { id: 's-cibc',         name: 'CIBC',               category: 'credit-card',  dueDay: 1,                 icon: '💳' },
  { id: 's-scotiabank',   name: 'Scotiabank',         category: 'credit-card',  dueDay: 1,                 icon: '💳' },
  { id: 's-rbc',          name: 'RBC',                category: 'credit-card',  dueDay: 1,                 icon: '💳' },
  { id: 's-car-loan',     name: 'Car Loan',           category: 'emi',          dueDay: 1,                 icon: '🚗' },
  { id: 's-mortgage',     name: 'Mortgage',           category: 'emi',          dueDay: 1,                 icon: '🏦' },
  { id: 's-student-loan', name: 'Student Loan',       category: 'emi',          dueDay: 1,                 icon: '🎓' },
  { id: 's-personal-loan',name: 'Personal Loan',      category: 'emi',          dueDay: 1,                 icon: '💰' },
  { id: 's-ipad',         name: 'iPad / Device EMI',  category: 'emi',          dueDay: 1,                 icon: '📱' },
  { id: 's-phone',        name: 'Phone Bill',         category: 'utility',      dueDay: 1,                 icon: '📞' },
  { id: 's-wifi',         name: 'Internet / WiFi',    category: 'utility',      dueDay: 1,                 icon: '📶' },
  { id: 's-electricity',  name: 'Electricity',        category: 'utility',      dueDay: 1,                 icon: '💡' },
  { id: 's-gas',          name: 'Gas / Heating',      category: 'utility',      dueDay: 1,                 icon: '🔥' },
  { id: 's-water',        name: 'Water Bill',         category: 'utility',      dueDay: 1,                 icon: '💧' },
  { id: 's-insurance',    name: 'Insurance',          category: 'utility',      dueDay: 1,                 icon: '🛡️' },
  { id: 's-netflix',      name: 'Netflix',            category: 'subscription', dueDay: 1,                 icon: '🎬' },
  { id: 's-spotify',      name: 'Spotify',            category: 'subscription', dueDay: 1,                 icon: '🎵' },
  { id: 's-youtube',      name: 'YouTube Premium',    category: 'subscription', dueDay: 1,                 icon: '▶️' },
  { id: 's-disney',       name: 'Disney+',            category: 'subscription', dueDay: 1,                 icon: '🏰' },
  { id: 's-apple',        name: 'Apple One',          category: 'subscription', dueDay: 1,                 icon: '🍎' },
  { id: 's-chatgpt',      name: 'ChatGPT',            category: 'subscription', dueDay: 1,                 icon: '🤖' },
  { id: 's-claude',       name: 'Claude',             category: 'subscription', dueDay: 1,                 icon: '🧠' },
  { id: 's-cursor',       name: 'Cursor',             category: 'subscription', dueDay: 1,                 icon: '⌨️' },
  { id: 's-amazon-prime', name: 'Amazon Prime',       category: 'subscription', dueDay: 1,                 icon: '📦' },
  { id: 's-walmart-plus', name: 'Walmart+',           category: 'subscription', dueDay: 1,                 icon: '🛒' },
  { id: 's-squarespace',  name: 'Squarespace',        category: 'subscription', dueDay: 1,                 icon: '🌐' },
  { id: 's-dropbox',      name: 'Dropbox',            category: 'subscription', dueDay: 1,                 icon: '📂' },
  { id: 's-icloud',       name: 'iCloud Storage',     category: 'subscription', dueDay: 1,                 icon: '☁️' },
  { id: 's-factor-meals', name: 'Factor Meals',       category: 'subscription', dueDay: 'weekly-thursday', icon: '🍳' },
  { id: 's-rent',         name: 'Monthly Rent',       category: 'rent',         dueDay: 1,                 icon: '🏠' },
  { id: 's-gym',          name: 'Gym Membership',     category: 'other',        dueDay: 1,                 icon: '🏋️' },
  { id: 's-parking',      name: 'Parking',            category: 'other',        dueDay: 1,                 icon: '🅿️' },
  { id: 's-transit',      name: 'Transit Pass',       category: 'other',        dueDay: 1,                 icon: '🚌' },
  { id: 's-grocery',      name: 'Grocery Run',        category: 'other',        dueDay: 'weekly-saturday', icon: '🛍️' },
  { id: 's-allowance',    name: 'Family Allowance',   category: 'other',        dueDay: 1,                 icon: '👨‍👩‍👧' },
];

function getDueDate(dueDay: DueDay): Date {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (dueDay === 'last') {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    if (lastDay < today) return new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return lastDay;
  }
  const weeklyMap: Record<string, number> = { 'weekly-thursday': 4, 'weekly-friday': 5, 'weekly-saturday': 6 };
  if (typeof dueDay === 'string' && dueDay.startsWith('weekly-')) {
    const targetDow = weeklyMap[dueDay];
    const diff = (targetDow - today.getDay() + 7) % 7;
    return new Date(today.getTime() + diff * 86400000);
  }
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

function formatDueLabel(dueDay: DueDay): string {
  const days = getDaysUntilDue(dueDay);
  if (days < 0)  return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Tomorrow';
  if (days <= 6)  return `in ${days}d`;
  return getDueDate(dueDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

type Urgency = 'overdue' | 'today' | 'tomorrow' | 'this-week' | 'upcoming';

function getUrgency(days: number): Urgency {
  if (days < 0)   return 'overdue';
  if (days === 0)  return 'today';
  if (days === 1)  return 'tomorrow';
  if (days <= 5)   return 'this-week';
  return 'upcoming';
}

const URGENCY_COLOR: Record<Urgency, string> = {
  overdue:     '#FF453A',
  today:       '#FF9F0A',
  tomorrow:    '#FFD60A',
  'this-week': '#30D158',
  upcoming:    '#8E8E93',
};

const URGENCY_ORDER: Urgency[] = ['overdue', 'today', 'tomorrow', 'this-week', 'upcoming'];
const URGENCY_LABEL: Record<Urgency, string> = {
  overdue: 'Overdue', today: 'Due Today', tomorrow: 'Tomorrow', 'this-week': 'This Week', upcoming: 'Upcoming',
};

const CATEGORIES = Object.keys(CATEGORY_META) as Array<keyof typeof CATEGORY_META>;
const DUE_DAY_OPTIONS: { label: string; value: DueDay }[] = [
  ...Array.from({ length: 28 }, (_, i) => ({ label: `${i + 1}${['st','nd','rd'][i] ?? 'th'}`, value: i + 1 as DueDay })),
  { label: 'Last day', value: 'last' },
  { label: 'Weekly Thu', value: 'weekly-thursday' },
  { label: 'Weekly Fri', value: 'weekly-friday' },
  { label: 'Weekly Sat', value: 'weekly-saturday' },
];

interface Props { user?: User | null; }

export default function RecurringExpensesScreen({ user }: Props) {
  const navigation = useNavigation<any>();
  const userEmail = user?.email || '';
  const { REMINDERS_KEY } = useMemo(() => getKeys(userEmail), [userEmail]);

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addTab, setAddTab] = useState<'suggestions' | 'custom'>('suggestions');
  const [suggestionCategory, setSuggestionCategory] = useState<Reminder['category']>('credit-card');
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('💳');
  const [newCategory, setNewCategory] = useState<Reminder['category']>('other');
  const [newDueDay, setNewDueDay] = useState<DueDay>(1);
  const [newAmount, setNewAmount] = useState('');

  useEffect(() => {
    setLoaded(false);
    setReminders([]);
    AsyncStorage.getItem(REMINDERS_KEY).then(raw => {
      if (raw) setReminders(JSON.parse(raw));
      setLoaded(true);
    }).catch(console.error);
  }, [REMINDERS_KEY]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders)).catch(console.error);
  }, [reminders, loaded]);

  const totalMonthly = useMemo(() =>
    reminders.filter(r => typeof r.dueDay === 'number' || r.dueDay === 'last')
      .reduce((sum, r) => sum + (r.amount ?? 0), 0),
    [reminders]
  );

  const needsAttention = useMemo(() =>
    reminders.filter(r => { const d = getDaysUntilDue(r.dueDay); return d < 0 || d === 0; }).length,
    [reminders]
  );

  const dueThisWeek = useMemo(() =>
    reminders.filter(r => { const d = getDaysUntilDue(r.dueDay); return d > 0 && d <= 7; }).length,
    [reminders]
  );

  // Sort reminders by days until due
  const sortedReminders = useMemo(() =>
    [...reminders].sort((a, b) => getDaysUntilDue(a.dueDay) - getDaysUntilDue(b.dueDay)),
    [reminders]
  );

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

  const handleToggleSuggestion = useCallback((suggestion: Reminder) => {
    setReminders(prev => {
      const already = prev.some(r => r.id === suggestion.id);
      if (already) return prev.filter(r => r.id !== suggestion.id);
      return [...prev, { ...suggestion }];
    });
  }, []);

  const handleDelete = useCallback((id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
  }, []);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Teal glow behind hero */}
      <View style={s.heroGlow} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Bills & Subscriptions</Text>
          <View style={{ width: 22 }} />
        </View>

        {/* Hero balance card */}
        <View style={s.heroCard}>
          <Text style={s.heroLabel}>Monthly commitment</Text>
          <Text style={s.heroAmount}>
            ${totalMonthly > 0 ? totalMonthly.toFixed(2) : '—'}
          </Text>
          <Text style={s.heroSub}>
            {reminders.length} active · {needsAttention > 0 ? `${needsAttention} need attention` : 'all clear'}
          </Text>
        </View>

        {/* Quick action row */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.actionBtn} onPress={() => { setAddTab('suggestions'); setSuggestionCategory('credit-card'); setShowAdd(true); }}>
            <View style={s.actionIcon}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </View>
            <Text style={s.actionLabel}>Add</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={() => { setAddTab('custom'); setShowAdd(true); }}>
            <View style={s.actionIcon}>
              <Ionicons name="create-outline" size={18} color="#FFFFFF" />
            </View>
            <Text style={s.actionLabel}>Custom</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn}>
            <View style={s.actionIcon}>
              <Ionicons name="stats-chart-outline" size={18} color="#FFFFFF" />
            </View>
            <Text style={s.actionLabel}>{dueThisWeek} this wk</Text>
          </TouchableOpacity>
        </View>

        {/* Reminders list */}
        {reminders.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyTitle}>No reminders yet</Text>
            <Text style={s.emptySubtitle}>Tap Add to track your bills and subscriptions</Text>
          </View>
        ) : (
          <>
            <View style={s.listHeader}>
              <Text style={s.listTitle}>Reminders</Text>
              <Text style={s.listCount}>{reminders.length} total</Text>
            </View>

            {sortedReminders.map((r, idx) => {
              const days = getDaysUntilDue(r.dueDay);
              const urgency = getUrgency(days);
              const urgencyColor = URGENCY_COLOR[urgency];
              const catMeta = CATEGORY_META[r.category];
              const isLast = idx === sortedReminders.length - 1;

              return (
                <View key={r.id} style={[s.txRow, isLast && { borderBottomWidth: 0 }]}>
                  <View style={[s.txIconWrap, { backgroundColor: catMeta.color + '22' }]}>
                    <Text style={s.txIcon}>{r.icon}</Text>
                  </View>
                  <View style={s.txMiddle}>
                    <Text style={s.txName}>{r.name}</Text>
                    <Text style={[s.txDue, { color: urgencyColor }]}>{formatDueLabel(r.dueDay)}</Text>
                  </View>
                  <View style={s.txRight}>
                    {r.amount != null ? (
                      <Text style={s.txAmount}>-${r.amount.toFixed(2)}</Text>
                    ) : (
                      <Text style={s.txAmountNone}>—</Text>
                    )}
                    <TouchableOpacity
                      onPress={() => handleDelete(r.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={s.txDelete}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowAdd(false)}>
          <View style={s.modalCard}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Add Reminder</Text>

            <View style={s.tabRow}>
              {(['suggestions', 'custom'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.tab, addTab === t && s.tabActive]}
                  onPress={() => setAddTab(t)}
                >
                  <Text style={[s.tabText, addTab === t && s.tabTextActive]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {addTab === 'suggestions' ? (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {CATEGORIES.map(cat => {
                    const meta = CATEGORY_META[cat];
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[s.catChip, suggestionCategory === cat && { borderColor: meta.color, backgroundColor: meta.color + '22' }]}
                        onPress={() => setSuggestionCategory(cat)}
                      >
                        <Text style={[s.catChipText, suggestionCategory === cat && { color: meta.color }]}>{meta.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
                  {SUGGESTIONS.filter(sg => sg.category === suggestionCategory).map(suggestion => {
                    const added = reminders.some(r => r.id === suggestion.id);
                    return (
                      <TouchableOpacity
                        key={suggestion.id}
                        style={[s.suggestionRow, added && s.suggestionRowAdded]}
                        onPress={() => handleToggleSuggestion(suggestion)}
                        activeOpacity={0.7}
                      >
                        <Text style={s.suggestionIcon}>{suggestion.icon}</Text>
                        <Text style={[s.suggestionName, added && s.suggestionNameAdded]}>{suggestion.name}</Text>
                        <View style={[s.suggestionCheck, added && s.suggestionCheckAdded]}>
                          {added && <Text style={s.suggestionCheckMark}>✓</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  <View style={{ height: 16 }} />
                </ScrollView>
              </>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" bounces={false} style={{ maxHeight: 420 }}>
                <Text style={s.fieldLabel}>Name</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="e.g. Netflix"
                  placeholderTextColor="#3A3A4A"
                  value={newName}
                  onChangeText={setNewName}
                />
                <Text style={s.fieldLabel}>Icon (emoji)</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="💳"
                  placeholderTextColor="#3A3A4A"
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
                    placeholderTextColor="#3A3A4A"
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
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E12' },
  scroll: { paddingBottom: 32 },

  heroGlow: {
    position: 'absolute',
    top: -40,
    left: '15%',
    width: '70%',
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(0,180,160,0.08)',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },

  // Hero
  heroCard: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    paddingTop: 4,
  },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 8, letterSpacing: 0.3 },
  heroAmount: { fontSize: 44, fontWeight: '700', color: '#FFFFFF', letterSpacing: -1, marginBottom: 6 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.35)' },

  // Quick actions
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 32,
  },
  actionBtn: { flex: 1, alignItems: 'center', gap: 8 },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  actionLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.25)', textAlign: 'center', lineHeight: 20 },

  // List
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  listTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  listCount: { fontSize: 13, color: 'rgba(255,255,255,0.3)', fontWeight: '500' },

  // Transaction rows
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 14,
  },
  txIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIcon: { fontSize: 20 },
  txMiddle: { flex: 1 },
  txName: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', marginBottom: 3 },
  txDue: { fontSize: 12, fontWeight: '500' },
  txRight: { alignItems: 'flex-end', gap: 6 },
  txAmount: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  txAmountNone: { fontSize: 15, color: 'rgba(255,255,255,0.2)' },
  txDelete: { fontSize: 13, color: 'rgba(255,255,255,0.18)' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#141820',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '88%',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginBottom: 20 },
  fieldLabel: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  amountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 13,
  },
  dollarSign: { fontSize: 15, color: 'rgba(255,255,255,0.35)', marginRight: 6 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)', marginRight: 8,
  },
  catChipText: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
  dayChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)', marginRight: 8,
  },
  dayChipActive: { backgroundColor: '#00C9B8', borderColor: '#00C9B8' },
  dayChipText: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
  dayChipTextActive: { color: '#000', fontWeight: '700' },
  addBtn: {
    backgroundColor: '#00C9B8', borderRadius: 16, padding: 16, alignItems: 'center',
    shadowColor: '#00C9B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  addBtnText: { color: '#000', fontWeight: '700', fontSize: 16 },

  tabRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 3, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#00C9B8' },
  tabText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.35)' },
  tabTextActive: { color: '#000' },

  suggestionRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', gap: 12,
  },
  suggestionRowAdded: { opacity: 0.5 },
  suggestionIcon: { fontSize: 22, width: 32, textAlign: 'center' },
  suggestionName: { flex: 1, fontSize: 15, color: '#FFFFFF', fontWeight: '500' },
  suggestionNameAdded: { textDecorationLine: 'line-through', color: 'rgba(255,255,255,0.35)' },
  suggestionCheck: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  suggestionCheckAdded: { backgroundColor: '#30D158', borderColor: '#30D158' },
  suggestionCheckMark: { fontSize: 13, color: '#000', fontWeight: '700' },
});
