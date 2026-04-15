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

const CARDS_KEY  = 'zentask:credit_cards';
const SCORE_KEY  = 'zentask:credit_score';
const BUDGET_KEY = 'zentask:debt_budget';
const PLANS_KEY  = 'zentask:payment_plans';

interface CreditCard {
  id: string;
  name: string;
  balance: number;
  limit: number;
  color: string;
}

interface MonthPayment {
  cardId: string;
  cardName: string;
  amount: number;
}

interface PaymentPlan {
  month: number;
  payments: MonthPayment[];
  completed: boolean;
  projectedScore: number;
  scoreChange: number;
  keyDriver: string;
}

const CARD_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444'];

const DEFAULT_CARDS: CreditCard[] = [
  { id: 'cibc',   name: 'CIBC',            balance: 3618, limit: 4000,  color: '#3B82F6' },
  { id: 'amex',   name: 'Amex *0100',      balance: 8500, limit: 8900,  color: '#8B5CF6' },
  { id: 'td',     name: 'TD **822',        balance: 7797, limit: 10000, color: '#EC4899' },
  { id: 'pcf',    name: 'PC Financial **130', balance: 2039, limit: 2500, color: '#F59E0B' },
];

const MILESTONES = [
  { score: 620, label: 'Fair',      sublabel: 'Limited options' },
  { score: 660, label: 'Good',      sublabel: 'Approved for most' },
  { score: 700, label: 'Excellent', sublabel: 'High limits' },
  { score: 750, label: 'Prime',     sublabel: 'Best rates' },
];

function utilColor(pct: number): string {
  if (pct >= 90) return '#FF453A';
  if (pct >= 80) return '#FF9F0A';
  if (pct >= 70) return '#FFD60A';
  if (pct >= 50) return '#3B82F6';
  return '#30D158';
}

function scoreColor(score: number): string {
  if (score >= 750) return '#30D158';
  if (score >= 700) return '#3B82F6';
  if (score >= 660) return '#FF9F0A';
  return '#FF453A';
}

function scoreLabel(score: number): string {
  if (score >= 750) return 'Prime Rate Ready';
  if (score >= 700) return 'Excellent';
  if (score >= 660) return 'Good';
  if (score >= 620) return 'Fair';
  return 'Building Credit';
}

function generatePaymentPlans(cards: CreditCard[], currentScore: number, monthlyBudget: number): PaymentPlan[] {
  const THRESHOLDS = [90, 80, 70, 50, 30];
  const plans: PaymentPlan[] = [];
  let balances = cards.reduce<Record<string, number>>((acc, c) => { acc[c.id] = c.balance; return acc; }, {});
  let runningScore = currentScore;

  for (let month = 1; month <= 5; month++) {
    let remaining = monthlyBudget;
    const payments: MonthPayment[] = [];
    let keyDriver = '';
    let scoreChange = 0;

    // Prioritise cards closest to crossing a threshold downward
    const sorted = [...cards].sort((a, b) => {
      const ua = (balances[a.id] / a.limit) * 100;
      const ub = (balances[b.id] / b.limit) * 100;
      // Which one is closest (above) to a threshold?
      const nearA = THRESHOLDS.find(t => ua > t) ?? 0;
      const nearB = THRESHOLDS.find(t => ub > t) ?? 0;
      return (ua - nearA) - (ub - nearB);
    });

    for (const card of sorted) {
      if (remaining <= 0) break;
      const bal = balances[card.id];
      if (bal <= 0) continue;
      const prevPct = (bal / card.limit) * 100;
      const payment = Math.min(remaining, bal);
      balances[card.id] = Math.max(0, bal - payment);
      const newPct = (balances[card.id] / card.limit) * 100;
      remaining -= payment;
      payments.push({ cardId: card.id, cardName: card.name, amount: payment });

      // Check if we crossed a threshold
      for (const t of THRESHOLDS) {
        if (prevPct > t && newPct <= t) {
          scoreChange += t >= 80 ? 20 : t >= 50 ? 15 : 10;
          if (!keyDriver) keyDriver = `${card.name} drops below ${t}%`;
        }
      }
    }

    if (scoreChange === 0) scoreChange = payments.length > 0 ? 5 : 0;
    runningScore += scoreChange;
    plans.push({
      month,
      payments,
      completed: false,
      projectedScore: runningScore,
      scoreChange,
      keyDriver: keyDriver || 'Continue reducing balances',
    });
  }
  return plans;
}

export default function CreditScoreScreen() {
  const [cards, setCards] = useState<CreditCard[]>(DEFAULT_CARDS);
  const [currentScore, setCurrentScore] = useState(638);
  const [monthlyBudget, setMonthlyBudget] = useState(1000);
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Add card form
  const [showAddCard, setShowAddCard] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBalance, setNewBalance] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [newColor, setNewColor] = useState(CARD_COLORS[0]);

  // Edit score/budget modals
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [scoreInput, setScoreInput] = useState('');
  const [budgetInput, setBudgetInput] = useState('');

  // Load
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(CARDS_KEY),
      AsyncStorage.getItem(SCORE_KEY),
      AsyncStorage.getItem(BUDGET_KEY),
      AsyncStorage.getItem(PLANS_KEY),
    ]).then(([rawCards, rawScore, rawBudget, rawPlans]) => {
      if (rawCards)  setCards(JSON.parse(rawCards));
      if (rawScore)  setCurrentScore(Number(rawScore));
      if (rawBudget) setMonthlyBudget(Number(rawBudget));
      if (rawPlans)  setPlans(JSON.parse(rawPlans));
      setLoaded(true);
    }).catch(console.error);
  }, []);

  // Persist
  useEffect(() => { if (loaded) AsyncStorage.setItem(CARDS_KEY,  JSON.stringify(cards)).catch(console.error); }, [cards, loaded]);
  useEffect(() => { if (loaded) AsyncStorage.setItem(SCORE_KEY,  String(currentScore)).catch(console.error); }, [currentScore, loaded]);
  useEffect(() => { if (loaded) AsyncStorage.setItem(BUDGET_KEY, String(monthlyBudget)).catch(console.error); }, [monthlyBudget, loaded]);
  useEffect(() => { if (loaded) AsyncStorage.setItem(PLANS_KEY,  JSON.stringify(plans)).catch(console.error); }, [plans, loaded]);

  // Recalculate plans when inputs change
  useEffect(() => {
    if (!loaded) return;
    setPlans(generatePaymentPlans(cards, currentScore, monthlyBudget));
  }, [cards, currentScore, monthlyBudget, loaded]);

  const totalBalance = cards.reduce((s, c) => s + c.balance, 0);
  const totalLimit   = cards.reduce((s, c) => s + c.limit, 0);
  const overallUtil  = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0;
  const projectedScore = plans[plans.length - 1]?.projectedScore ?? currentScore;

  const handleAddCard = useCallback(() => {
    const bal = parseFloat(newBalance);
    const lim = parseFloat(newLimit);
    if (!newName.trim())         { Alert.alert('Enter card name'); return; }
    if (isNaN(bal) || bal < 0)   { Alert.alert('Invalid balance'); return; }
    if (isNaN(lim) || lim <= 0)  { Alert.alert('Invalid limit'); return; }
    if (bal > lim)               { Alert.alert('Balance cannot exceed limit'); return; }
    const card: CreditCard = { id: String(Date.now()), name: newName.trim(), balance: bal, limit: lim, color: newColor };
    setCards(prev => [...prev, card]);
    setShowAddCard(false);
    setNewName(''); setNewBalance(''); setNewLimit(''); setNewColor(CARD_COLORS[0]);
  }, [newName, newBalance, newLimit, newColor]);

  const handleDeleteCard = useCallback((id: string) => {
    Alert.alert('Remove Card', 'Remove this card from tracking?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setCards(prev => prev.filter(c => c.id !== id)) },
    ]);
  }, []);

  const togglePlanComplete = useCallback((month: number) => {
    setPlans(prev => prev.map(p => p.month === month ? { ...p, completed: !p.completed } : p));
  }, []);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>💳 Credit Score</Text>
          <Text style={s.subtitle}>Track utilisation & plan your payoff</Text>
        </View>

        {/* Score overview */}
        <View style={s.overviewRow}>
          <TouchableOpacity style={s.scoreCard} onPress={() => { setScoreInput(String(currentScore)); setShowScoreModal(true); }}>
            <Text style={s.overviewLabel}>Current Score</Text>
            <Text style={[s.scoreNumber, { color: scoreColor(currentScore) }]}>{currentScore}</Text>
            <Text style={[s.scoreStatus, { color: scoreColor(currentScore) }]}>{scoreLabel(currentScore)}</Text>
            <Text style={s.editHint}>tap to edit ✏️</Text>
          </TouchableOpacity>
          <View style={s.arrowCol}>
            <Text style={s.arrow}>→</Text>
            <Text style={s.arrowLabel}>+{projectedScore - currentScore} pts</Text>
          </View>
          <View style={[s.scoreCard, { borderColor: scoreColor(projectedScore) + '55' }]}>
            <Text style={s.overviewLabel}>Projected (5mo)</Text>
            <Text style={[s.scoreNumber, { color: scoreColor(projectedScore) }]}>{projectedScore}</Text>
            <Text style={[s.scoreStatus, { color: scoreColor(projectedScore) }]}>{scoreLabel(projectedScore)}</Text>
          </View>
        </View>

        {/* Budget */}
        <TouchableOpacity style={s.budgetRow} onPress={() => { setBudgetInput(String(monthlyBudget)); setShowBudgetModal(true); }}>
          <Text style={s.budgetLabel}>Monthly Debt Budget</Text>
          <Text style={s.budgetValue}>${monthlyBudget.toLocaleString()} ✏️</Text>
        </TouchableOpacity>

        {/* Overall utilisation */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Overall Utilisation</Text>
          <View style={s.utilCard}>
            <View style={s.utilHeaderRow}>
              <Text style={[s.utilPct, { color: utilColor(overallUtil) }]}>{overallUtil.toFixed(1)}%</Text>
              <Text style={s.utilBalances}>${totalBalance.toLocaleString()} / ${totalLimit.toLocaleString()}</Text>
            </View>
            <View style={s.progressBar}>
              <View style={[s.progressFill, { width: `${Math.min(overallUtil, 100)}%` as any, backgroundColor: utilColor(overallUtil) }]} />
              {/* Threshold markers */}
              {[30, 50, 70, 80, 90].map(t => (
                <View key={t} style={[s.thresholdMark, { left: `${t}%` as any }]} />
              ))}
            </View>
            <Text style={s.utilHint}>
              {overallUtil < 30 ? '✅ Excellent! Below 30%' :
               overallUtil < 50 ? '👍 Good — aim for below 30%' :
               overallUtil < 70 ? '⚠️ Fair — pay down to below 50%' :
               '🔴 High — prioritise payoff'}
            </Text>
          </View>
        </View>

        {/* Individual cards */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Credit Cards</Text>
            <TouchableOpacity style={s.addCardBtn} onPress={() => setShowAddCard(true)}>
              <Text style={s.addCardBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
          {cards.map(card => {
            const util = card.limit > 0 ? (card.balance / card.limit) * 100 : 0;
            return (
              <View key={card.id} style={[s.cardItem, { borderLeftColor: card.color }]}>
                <View style={s.cardTop}>
                  <Text style={s.cardName}>{card.name}</Text>
                  <TouchableOpacity onPress={() => handleDeleteCard(card.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={s.cardDelete}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.cardStats}>
                  <Text style={s.cardBalance}>${card.balance.toLocaleString()} <Text style={s.cardLimit}>/ ${card.limit.toLocaleString()}</Text></Text>
                  <Text style={[s.cardUtil, { color: utilColor(util) }]}>{util.toFixed(1)}%</Text>
                </View>
                <View style={s.progressBar}>
                  <View style={[s.progressFill, { width: `${Math.min(util, 100)}%` as any, backgroundColor: utilColor(util) }]} />
                </View>
              </View>
            );
          })}
        </View>

        {/* Milestone track */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Line of Credit Readiness</Text>
          <View style={s.milestoneTrack}>
            {MILESTONES.map((m, i) => {
              const achieved = currentScore >= m.score;
              const projected = projectedScore >= m.score;
              return (
                <View key={m.score} style={s.milestoneItem}>
                  <View style={[
                    s.milestoneCircle,
                    achieved && s.milestoneAchieved,
                    !achieved && projected && s.milestoneProjected,
                  ]}>
                    <Text style={[s.milestoneScore, achieved && { color: '#30D158' }, !achieved && projected && { color: '#3B82F6' }]}>
                      {m.score}
                    </Text>
                  </View>
                  <Text style={[s.milestoneLabel, achieved && { color: '#30D158' }]}>{m.label}</Text>
                  <Text style={s.milestoneSub}>{m.sublabel}</Text>
                  {i < MILESTONES.length - 1 && <View style={[s.milestoneLine, achieved && { backgroundColor: '#30D158' }]} />}
                </View>
              );
            })}
          </View>
        </View>

        {/* Payment plan */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>5-Month Payment Plan</Text>
          {plans.map(plan => (
            <TouchableOpacity
              key={plan.month}
              style={[s.planCard, plan.completed && s.planCardDone]}
              onPress={() => togglePlanComplete(plan.month)}
              activeOpacity={0.8}
            >
              <View style={s.planHeader}>
                <View style={[s.planCheck, plan.completed && s.planCheckDone]}>
                  {plan.completed && <Text style={s.planCheckMark}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.planMonth, plan.completed && s.planTextDone]}>Month {plan.month}</Text>
                  <Text style={s.planDriver}>{plan.keyDriver}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.planScore, { color: scoreColor(plan.projectedScore) }]}>{plan.projectedScore}</Text>
                  <Text style={s.planChange}>+{plan.scoreChange} pts</Text>
                </View>
              </View>
              <View style={s.planPayments}>
                {plan.payments.map(p => (
                  <View key={p.cardId} style={s.planPaymentRow}>
                    <Text style={s.planPaymentCard}>{p.cardName}</Text>
                    <Text style={s.planPaymentAmount}>${p.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Add card modal */}
      <Modal visible={showAddCard} transparent animationType="slide" onRequestClose={() => setShowAddCard(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowAddCard(false)}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Add Credit Card</Text>

            <Text style={s.fieldLabel}>Card Name</Text>
            <TextInput style={s.textInput} placeholder="e.g. TD Visa" placeholderTextColor="#48484A" value={newName} onChangeText={setNewName} />

            <Text style={s.fieldLabel}>Current Balance ($)</Text>
            <TextInput style={s.textInput} placeholder="0.00" placeholderTextColor="#48484A" keyboardType="decimal-pad" value={newBalance} onChangeText={setNewBalance} />

            <Text style={s.fieldLabel}>Credit Limit ($)</Text>
            <TextInput style={s.textInput} placeholder="0.00" placeholderTextColor="#48484A" keyboardType="decimal-pad" value={newLimit} onChangeText={setNewLimit} />

            <Text style={s.fieldLabel}>Colour</Text>
            <View style={s.colorRow}>
              {CARD_COLORS.map(c => (
                <TouchableOpacity key={c} style={[s.colorDot, { backgroundColor: c }, newColor === c && s.colorDotActive]} onPress={() => setNewColor(c)} />
              ))}
            </View>

            <TouchableOpacity style={[s.addBtn, { marginTop: 16 }]} onPress={handleAddCard}>
              <Text style={s.addBtnText}>Add Card</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Score edit modal */}
      <Modal visible={showScoreModal} transparent animationType="slide" onRequestClose={() => setShowScoreModal(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowScoreModal(false)}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Update Credit Score</Text>
            <TextInput
              style={s.textInput}
              placeholder="e.g. 650"
              placeholderTextColor="#48484A"
              keyboardType="number-pad"
              value={scoreInput}
              onChangeText={setScoreInput}
              autoFocus
            />
            <TouchableOpacity style={s.addBtn} onPress={() => {
              const v = parseInt(scoreInput);
              if (isNaN(v) || v < 300 || v > 900) { Alert.alert('Enter a score between 300 and 900'); return; }
              setCurrentScore(v);
              setShowScoreModal(false);
            }}>
              <Text style={s.addBtnText}>Save Score</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Budget modal */}
      <Modal visible={showBudgetModal} transparent animationType="slide" onRequestClose={() => setShowBudgetModal(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowBudgetModal(false)}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Monthly Debt Budget</Text>
            <View style={s.amountWrap}>
              <Text style={s.dollarSign}>$</Text>
              <TextInput
                style={[s.textInput, { flex: 1, borderWidth: 0, marginBottom: 0 }]}
                placeholder="1000"
                placeholderTextColor="#48484A"
                keyboardType="decimal-pad"
                value={budgetInput}
                onChangeText={setBudgetInput}
                autoFocus
              />
            </View>
            <TouchableOpacity style={[s.addBtn, { marginTop: 16 }]} onPress={() => {
              const v = parseFloat(budgetInput);
              if (isNaN(v) || v <= 0) { Alert.alert('Enter a valid amount'); return; }
              setMonthlyBudget(v);
              setShowBudgetModal(false);
            }}>
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

  // Score overview
  overviewRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12, gap: 8 },
  scoreCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16,
    padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 3,
  },
  overviewLabel: { fontSize: 11, color: '#636366', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  scoreNumber: { fontSize: 36, fontWeight: '800' },
  scoreStatus: { fontSize: 12, fontWeight: '600' },
  editHint: { fontSize: 10, color: '#48484A', marginTop: 2 },
  arrowCol: { alignItems: 'center', gap: 2 },
  arrow: { fontSize: 20, color: '#636366' },
  arrowLabel: { fontSize: 11, color: '#30D158', fontWeight: '600' },

  // Budget row
  budgetRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 20, marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  budgetLabel: { fontSize: 14, color: '#636366' },
  budgetValue: { fontSize: 16, fontWeight: '700', color: '#30D158' },

  // Section
  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: '#EBEBF5', marginBottom: 10 },
  addCardBtn: { backgroundColor: 'rgba(59,130,246,0.2)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(59,130,246,0.4)' },
  addCardBtnText: { color: '#3B82F6', fontSize: 13, fontWeight: '600' },

  // Utilisation card
  utilCard: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 10,
  },
  utilHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  utilPct: { fontSize: 28, fontWeight: '800' },
  utilBalances: { fontSize: 13, color: '#636366' },
  progressBar: { height: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden', position: 'relative' },
  progressFill: { height: '100%', borderRadius: 5, position: 'absolute', left: 0, top: 0 },
  thresholdMark: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  utilHint: { fontSize: 13, color: '#EBEBF5' },

  // Card items
  cardItem: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderLeftWidth: 4, gap: 8,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: 15, fontWeight: '600', color: '#EBEBF5' },
  cardDelete: { fontSize: 16, color: '#48484A' },
  cardStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardBalance: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  cardLimit: { fontSize: 13, color: '#636366', fontWeight: '400' },
  cardUtil: { fontSize: 18, fontWeight: '700' },

  // Milestone track
  milestoneTrack: { flexDirection: 'row', justifyContent: 'space-between' },
  milestoneItem: { alignItems: 'center', flex: 1, position: 'relative' },
  milestoneCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  milestoneAchieved: { borderColor: '#30D158', backgroundColor: 'rgba(48,209,88,0.12)' },
  milestoneProjected: { borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.1)', borderStyle: 'dashed' },
  milestoneScore: { fontSize: 12, fontWeight: '700', color: '#636366' },
  milestoneLabel: { fontSize: 12, fontWeight: '600', color: '#636366', textAlign: 'center' },
  milestoneSub: { fontSize: 10, color: '#48484A', textAlign: 'center' },
  milestoneLine: {
    position: 'absolute', top: 26, left: '75%', right: '-75%',
    height: 2, backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Payment plan
  planCard: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
    padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 10,
  },
  planCardDone: { opacity: 0.5, backgroundColor: 'rgba(48,209,88,0.06)', borderColor: 'rgba(48,209,88,0.2)' },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planCheck: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  planCheckDone: { backgroundColor: '#30D158', borderColor: '#30D158' },
  planCheckMark: { fontSize: 13, color: '#000', fontWeight: '700' },
  planMonth: { fontSize: 15, fontWeight: '600', color: '#EBEBF5' },
  planTextDone: { textDecorationLine: 'line-through', color: '#636366' },
  planDriver: { fontSize: 12, color: '#636366', marginTop: 2 },
  planScore: { fontSize: 18, fontWeight: '800' },
  planChange: { fontSize: 12, color: '#30D158', fontWeight: '600' },
  planPayments: { gap: 4, paddingLeft: 36 },
  planPaymentRow: { flexDirection: 'row', justifyContent: 'space-between' },
  planPaymentCard: { fontSize: 13, color: '#636366' },
  planPaymentAmount: { fontSize: 13, color: '#EBEBF5', fontWeight: '600' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginBottom: 20 },
  fieldLabel: { fontSize: 13, color: '#636366', fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#FFFFFF', marginBottom: 14,
  },
  amountWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingHorizontal: 14,
  },
  dollarSign: { fontSize: 16, color: '#636366', marginRight: 4 },
  colorRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotActive: { borderWidth: 3, borderColor: '#FFFFFF' },
  addBtn: { backgroundColor: '#3B82F6', borderRadius: 14, padding: 16, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
