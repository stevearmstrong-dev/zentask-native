import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PowerSwordUnlock from '../components/PowerSwordUnlock';
import { SWORD_RECORDS_KEY, SwordRecord } from './PowerSwordHallScreen';

// Keys used by the respective tracker screens (must match each screen's constants)
const WATER_KEY    = 'zentask:water_logs';
const NOFAP_KEY    = 'zentask:nofap_start';
const MEALS_KEY    = 'zentask:meal_logs';
const EXPENSES_KEY = 'zentask:expenses';
const SLEEP_KEY    = 'zentask:sleep_logs';

function todayStr() { return new Date().toISOString().split('T')[0]; }

interface Gem {
  key: keyof GemStatus;
  label: string;
  emoji: string;
  color: string;
  description: string;
  hint: string;
}

interface GemStatus {
  water: boolean;
  discipline: boolean;
  nourishment: boolean;
  wealth: boolean;
  rest: boolean;
}

const GEMS: Gem[] = [
  {
    key: 'water',
    label: 'Water',
    emoji: '💧',
    color: '#3B82F6',
    description: 'Hydration Gem',
    hint: 'Log at least 1500ml of water today',
  },
  {
    key: 'discipline',
    label: 'Discipline',
    emoji: '💪',
    color: '#8B5CF6',
    description: 'Discipline Gem',
    hint: 'Maintain your NoFap streak',
  },
  {
    key: 'nourishment',
    label: 'Nourishment',
    emoji: '🍽️',
    color: '#10B981',
    description: 'Nourishment Gem',
    hint: 'Log at least 1 meal today',
  },
  {
    key: 'wealth',
    label: 'Wealth',
    emoji: '💰',
    color: '#F59E0B',
    description: 'Wealth Gem',
    hint: 'Track at least 1 expense today',
  },
  {
    key: 'rest',
    label: 'Rest',
    emoji: '😴',
    color: '#EC4899',
    description: 'Rest Gem',
    hint: 'Log your sleep for today',
  },
];

// Water: ≥1500ml logged today (75% of default 2000ml goal)
async function checkWater(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(WATER_KEY);
    if (!raw) return false;
    const log: { timestamp: string; amount: number }[] = JSON.parse(raw);
    const today = todayStr();
    const total = log
      .filter(e => e.timestamp.startsWith(today))
      .reduce((s, e) => s + e.amount, 0);
    return total >= 1500;
  } catch { return false; }
}

// Discipline: NoFap streak is active (startDate exists)
async function checkDiscipline(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(NOFAP_KEY);
    return !!raw;
  } catch { return false; }
}

// Nourishment: ≥1 meal logged today
async function checkNourishment(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(MEALS_KEY);
    if (!raw) return false;
    const meals: { date: string }[] = JSON.parse(raw);
    return meals.some(m => m.date === todayStr());
  } catch { return false; }
}

// Wealth: ≥1 expense logged today
async function checkWealth(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(EXPENSES_KEY);
    if (!raw) return false;
    const expenses: { date: string }[] = JSON.parse(raw);
    return expenses.some(e => e.date === todayStr());
  } catch { return false; }
}

// Rest: any sleep entry logged today
async function checkRest(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SLEEP_KEY);
    if (!raw) return false;
    const log: { date: string }[] = JSON.parse(raw);
    return log.some(e => e.date === todayStr());
  } catch { return false; }
}

const SWORD_UNLOCK_KEY = 'zentask:sword_unlocked_today';

export default function GemCollectorScreen() {
  const [gemStatus, setGemStatus] = useState<GemStatus>({
    water: false, discipline: false, nourishment: false, wealth: false, rest: false,
  });
  const [showUnlock, setShowUnlock] = useState(false);
  const [swordUnlockedToday, setSwordUnlockedToday] = useState(false);
  const prevStatus = useRef<GemStatus | null>(null);

  // Animated scales for each gem (pop when newly collected)
  const scales = useRef(GEMS.reduce<Record<string, Animated.Value>>((acc, g) => {
    acc[g.key] = new Animated.Value(1);
    return acc;
  }, {})).current;

  const checkAllGems = useCallback(async () => {
    const [water, discipline, nourishment, wealth, rest] = await Promise.all([
      checkWater(), checkDiscipline(), checkNourishment(), checkWealth(), checkRest(),
    ]);
    const next: GemStatus = { water, discipline, nourishment, wealth, rest };

    // Pop animation for newly collected gems
    if (prevStatus.current) {
      const prev = prevStatus.current;
      (Object.keys(next) as (keyof GemStatus)[]).forEach(key => {
        if (!prev[key] && next[key]) {
          Animated.sequence([
            Animated.spring(scales[key], { toValue: 1.4, friction: 4, useNativeDriver: true }),
            Animated.spring(scales[key], { toValue: 1,   friction: 6, useNativeDriver: true }),
          ]).start();
        }
      });
    }

    prevStatus.current = next;
    setGemStatus(next);

    // Check if all collected and not yet unlocked today
    const allCollected = Object.values(next).every(Boolean);
    if (allCollected) {
      const unlockedKey = await AsyncStorage.getItem(SWORD_UNLOCK_KEY);
      if (unlockedKey !== todayStr()) {
        setTimeout(() => setShowUnlock(true), 500);
      } else {
        setSwordUnlockedToday(true);
      }
    }
  }, [scales]);

  // Check on mount and every 30 seconds (trackers may be updated while on this screen)
  useEffect(() => {
    checkAllGems();
    const interval = setInterval(checkAllGems, 30000);
    return () => clearInterval(interval);
  }, [checkAllGems]);

  const handleUnlockClose = useCallback(async () => {
    setShowUnlock(false);
    setSwordUnlockedToday(true);
    // Mark sword as unlocked today
    await AsyncStorage.setItem(SWORD_UNLOCK_KEY, todayStr());
    // Save sword record
    const raw = await AsyncStorage.getItem(SWORD_RECORDS_KEY);
    const records: SwordRecord[] = raw ? JSON.parse(raw) : [];
    const today = todayStr();
    if (!records.some(r => r.date === today)) {
      records.push({ date: today, timestamp: new Date().toISOString() });
      await AsyncStorage.setItem(SWORD_RECORDS_KEY, JSON.stringify(records));
    }
  }, []);

  const collectedCount = Object.values(gemStatus).filter(Boolean).length;
  const allCollected = collectedCount === 5;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>💎 Gem Collector</Text>
          <Text style={s.subtitle}>Complete daily pillars to forge your Power Sword</Text>
        </View>

        {/* Progress badge */}
        <View style={[s.progressCard, allCollected && s.progressCardComplete]}>
          <Text style={[s.progressCount, allCollected && { color: '#FBBF24' }]}>
            {collectedCount} / 5
          </Text>
          <Text style={s.progressLabel}>
            {allCollected
              ? swordUnlockedToday
                ? '⚔️ Power Sword unlocked today!'
                : '🔥 All gems collected!'
              : `${5 - collectedCount} gem${5 - collectedCount !== 1 ? 's' : ''} remaining`}
          </Text>
          {/* Bar */}
          <View style={s.progressBar}>
            <View style={[s.progressFill, {
              width: `${(collectedCount / 5) * 100}%` as any,
              backgroundColor: allCollected ? '#FBBF24' : '#8B5CF6',
            }]} />
          </View>
        </View>

        {/* Gem grid */}
        <View style={s.gemsGrid}>
          {GEMS.map(gem => {
            const collected = gemStatus[gem.key];
            return (
              <TouchableOpacity
                key={gem.key}
                style={[s.gemCard, collected && { borderColor: gem.color + '66', backgroundColor: gem.color + '11' }]}
                onPress={checkAllGems}
                activeOpacity={0.8}
              >
                <Animated.Text style={[s.gemEmoji, !collected && s.gemLocked, { transform: [{ scale: scales[gem.key] }] }]}>
                  {gem.emoji}
                </Animated.Text>
                <Text style={[s.gemLabel, collected && { color: gem.color }]}>{gem.label}</Text>
                <Text style={s.gemDescription}>{gem.description}</Text>
                {collected ? (
                  <View style={[s.collectedBadge, { backgroundColor: gem.color + '22' }]}>
                    <Text style={[s.collectedText, { color: gem.color }]}>✓ Collected</Text>
                  </View>
                ) : (
                  <Text style={s.gemHint} numberOfLines={2}>{gem.hint}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Info */}
        <View style={s.infoCard}>
          <Text style={s.infoTitle}>How it works</Text>
          <Text style={s.infoText}>
            Collect all 5 gems by completing your daily habits. Each gem is automatically awarded when you log enough activity in its tracker. Collect all 5 to forge a Power Sword and add it to your Hall!
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <PowerSwordUnlock visible={showUnlock} onClose={handleUnlockClose} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 13, color: '#636366', marginTop: 4 },

  progressCard: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 18,
    padding: 18, marginBottom: 20, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', gap: 8, alignItems: 'center',
  },
  progressCardComplete: { borderColor: 'rgba(251,191,36,0.4)', backgroundColor: 'rgba(251,191,36,0.06)' },
  progressCount: { fontSize: 42, fontWeight: '900', color: '#FFFFFF' },
  progressLabel: { fontSize: 15, color: '#636366', fontWeight: '500' },
  progressBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', width: '100%' },
  progressFill: { height: '100%', borderRadius: 3 },

  gemsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  gemCard: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', gap: 6,
  },
  gemEmoji: { fontSize: 40 },
  gemLocked: { opacity: 0.35 },
  gemLabel: { fontSize: 15, fontWeight: '700', color: '#636366' },
  gemDescription: { fontSize: 11, color: '#48484A', textAlign: 'center' },
  collectedBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginTop: 2 },
  collectedText: { fontSize: 12, fontWeight: '700' },
  gemHint: { fontSize: 11, color: '#48484A', textAlign: 'center', lineHeight: 15 },

  infoCard: {
    backgroundColor: 'rgba(139,92,246,0.08)', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)', gap: 8,
  },
  infoTitle: { fontSize: 15, fontWeight: '700', color: '#8B5CF6' },
  infoText: { fontSize: 13, color: '#636366', lineHeight: 19 },
});
