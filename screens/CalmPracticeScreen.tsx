import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PhaseShape = 'expand' | 'holdFull' | 'contract' | 'holdEmpty';

interface PracticePhase {
  label: string;
  shortLabel: string;
  instruction: string;
  duration: number;
  shape: PhaseShape;
}

interface BreathingTechnique {
  id: string;
  title: string;
  subtitle: string;
  accent: string;
  cycles: number;
  cycleLabel: string;
  guidance: string;
  phases: PracticePhase[];
  pattern: PracticePhase[];
}

const SCALE_BY_SHAPE: Record<PhaseShape, number> = {
  expand: 1.12,
  holdFull: 1.12,
  contract: 0.68,
  holdEmpty: 0.68,
};

const boxPattern: PracticePhase[] = [
  { label: 'Inhale', shortLabel: 'In', instruction: 'Breathe in through your nose', duration: 4, shape: 'expand' },
  { label: 'Hold', shortLabel: 'Hold', instruction: 'Keep the breath gently held', duration: 4, shape: 'holdFull' },
  { label: 'Exhale', shortLabel: 'Out', instruction: 'Breathe out slowly', duration: 4, shape: 'contract' },
  { label: 'Hold', shortLabel: 'Hold', instruction: 'Rest at the bottom of the breath', duration: 4, shape: 'holdEmpty' },
];

const fourSevenEightPattern: PracticePhase[] = [
  { label: 'Inhale', shortLabel: 'In', instruction: 'Quiet inhale through the nose', duration: 4, shape: 'expand' },
  { label: 'Hold', shortLabel: 'Hold', instruction: 'Hold the breath comfortably', duration: 7, shape: 'holdFull' },
  { label: 'Exhale', shortLabel: 'Out', instruction: 'Long relaxed exhale', duration: 8, shape: 'contract' },
];

const coherentPattern: PracticePhase[] = [
  { label: 'Inhale', shortLabel: 'In', instruction: 'Smooth steady inhale', duration: 5, shape: 'expand' },
  { label: 'Exhale', shortLabel: 'Out', instruction: 'Smooth steady exhale', duration: 5, shape: 'contract' },
];

const sighPattern: PracticePhase[] = [
  { label: 'Inhale', shortLabel: 'In', instruction: 'Take a full inhale', duration: 2, shape: 'expand' },
  { label: 'Top-up', shortLabel: 'Top', instruction: 'Add a small second inhale', duration: 1, shape: 'holdFull' },
  { label: 'Exhale', shortLabel: 'Out', instruction: 'Let a long sigh out', duration: 6, shape: 'contract' },
];

const wimHofBreaths = Array.from({ length: 30 }).flatMap<PracticePhase>(() => [
  { label: 'Power inhale', shortLabel: 'In', instruction: 'Deep active inhale', duration: 2, shape: 'expand' },
  { label: 'Release', shortLabel: 'Out', instruction: 'Relax the exhale, do not force it', duration: 2, shape: 'contract' },
]);

const wimHofPattern: PracticePhase[] = [
  { label: 'Power inhale', shortLabel: 'In', instruction: 'Deep active inhale', duration: 2, shape: 'expand' },
  { label: 'Release', shortLabel: 'Out', instruction: 'Relax the exhale', duration: 2, shape: 'contract' },
  { label: 'Retention', shortLabel: 'Hold', instruction: 'Hold after the last exhale', duration: 60, shape: 'holdEmpty' },
  { label: 'Recovery breath', shortLabel: 'Recover', instruction: 'Inhale and hold gently', duration: 15, shape: 'holdFull' },
];

const TECHNIQUES: BreathingTechnique[] = [
  {
    id: 'box',
    title: 'Box Breathing',
    subtitle: '4-4-4-4',
    accent: '#1877F2',
    cycles: 4,
    cycleLabel: 'Box',
    guidance: 'A balanced pattern for slowing down and regaining control.',
    phases: boxPattern,
    pattern: boxPattern,
  },
  {
    id: '478',
    title: '4-7-8',
    subtitle: 'Long exhale',
    accent: '#AF52DE',
    cycles: 4,
    cycleLabel: 'Round',
    guidance: 'Keep the exhale soft and longer than the inhale.',
    phases: fourSevenEightPattern,
    pattern: fourSevenEightPattern,
  },
  {
    id: 'coherent',
    title: 'Coherent',
    subtitle: '5 in, 5 out',
    accent: '#30D158',
    cycles: 6,
    cycleLabel: 'Breath',
    guidance: 'An even rhythm for settling into a steady pace.',
    phases: coherentPattern,
    pattern: coherentPattern,
  },
  {
    id: 'sigh',
    title: 'Physiological Sigh',
    subtitle: 'Double inhale',
    accent: '#00C7BE',
    cycles: 5,
    cycleLabel: 'Sigh',
    guidance: 'Use the small top-up inhale, then make the exhale unhurried.',
    phases: sighPattern,
    pattern: sighPattern,
  },
  {
    id: 'wim-hof',
    title: 'Wim Hof',
    subtitle: '30 breaths',
    accent: '#FF9F0A',
    cycles: 1,
    cycleLabel: 'Round',
    guidance: 'Active breathing can feel intense. Sit or lie down and stop if dizzy.',
    phases: [
      ...wimHofBreaths,
      { label: 'Retention', shortLabel: 'Hold', instruction: 'Hold after the last exhale', duration: 60, shape: 'holdEmpty' },
      { label: 'Recovery breath', shortLabel: 'Recover', instruction: 'Inhale and hold gently', duration: 15, shape: 'holdFull' },
    ],
    pattern: wimHofPattern,
  },
];

function formatSeconds(seconds: number): string {
  if (seconds < 60) return String(seconds);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function sumDurations(phases: PracticePhase[]): number {
  return phases.reduce((sum, phase) => sum + phase.duration, 0);
}

export default function CalmPracticeScreen() {
  const navigation = useNavigation<any>();
  const [techniqueId, setTechniqueId] = useState('box');
  const technique = useMemo(
    () => TECHNIQUES.find(item => item.id === techniqueId) ?? TECHNIQUES[0],
    [techniqueId]
  );

  const [phaseIndex, setPhaseIndex] = useState(0);
  const [cycle, setCycle] = useState(1);
  const [timeLeft, setTimeLeft] = useState(technique.phases[0].duration);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const orbScale = useRef(new Animated.Value(SCALE_BY_SHAPE[technique.phases[0].shape])).current;

  const safePhaseIndex = Math.min(phaseIndex, technique.phases.length - 1);
  const currentPhase = technique.phases[safePhaseIndex];
  const cycleDuration = useMemo(() => sumDurations(technique.phases), [technique]);
  const totalDuration = cycleDuration * technique.cycles;
  const elapsedBeforePhase = (cycle - 1) * cycleDuration + sumDurations(technique.phases.slice(0, safePhaseIndex));
  const elapsed = elapsedBeforePhase + (currentPhase.duration - timeLeft);
  const progress = isComplete ? 1 : Math.max(0, Math.min(elapsed / totalDuration, 1));
  const totalSteps = technique.phases.length * technique.cycles;
  const currentStep = Math.min((cycle - 1) * technique.phases.length + phaseIndex + 1, totalSteps);
  const remainingTotal = Math.max(totalDuration - elapsed, 0);

  const resetSession = useCallback((startRunning = false) => {
    setPhaseIndex(0);
    setCycle(1);
    setTimeLeft(technique.phases[0].duration);
    setIsComplete(false);
    setIsRunning(startRunning);
  }, [technique]);

  useEffect(() => {
    resetSession(false);
  }, [resetSession]);

  const completeSession = useCallback(() => {
    setIsRunning(false);
    setIsComplete(true);
    setTimeLeft(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const advancePhase = useCallback(() => {
    const isLastPhase = phaseIndex === technique.phases.length - 1;
    const isLastCycle = cycle === technique.cycles;

    if (isLastPhase && isLastCycle) {
      completeSession();
      return;
    }

    if (isLastPhase) {
      setCycle(prev => prev + 1);
      setPhaseIndex(0);
      setTimeLeft(technique.phases[0].duration);
      return;
    }

    const nextIndex = phaseIndex + 1;
    setPhaseIndex(nextIndex);
    setTimeLeft(technique.phases[nextIndex].duration);
  }, [completeSession, cycle, phaseIndex, technique]);

  useEffect(() => {
    if (!isRunning) return;
    if (timeLeft <= 0) {
      advancePhase();
      return;
    }

    const timeout = setTimeout(() => {
      setTimeLeft(prev => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearTimeout(timeout);
  }, [advancePhase, isRunning, timeLeft]);

  useEffect(() => {
    orbScale.stopAnimation();
    Animated.timing(orbScale, {
      toValue: SCALE_BY_SHAPE[currentPhase.shape],
      duration: isRunning ? Math.max(timeLeft, 1) * 1000 : 250,
      useNativeDriver: true,
    }).start();
  }, [currentPhase, isRunning, orbScale]);

  const toggleRunning = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isRunning) {
      setIsRunning(false);
      return;
    }
    if (isComplete) {
      resetSession(true);
      return;
    }
    setIsRunning(true);
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetSession(false);
  };

  const selectTechnique = (id: string) => {
    if (id === techniqueId) return;
    Haptics.selectionAsync();
    setTechniqueId(id);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#EBEBF5" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Calm Practice</Text>
          <Text style={styles.subtitle}>Guided breathing techniques</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.techniqueRow}
        >
          {TECHNIQUES.map(item => {
            const selected = item.id === technique.id;
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.78}
                style={[
                  styles.techniqueCard,
                  selected && { borderColor: item.accent, backgroundColor: `${item.accent}20` },
                ]}
                onPress={() => selectTechnique(item.id)}
              >
                <Text style={[styles.techniqueTitle, selected && { color: item.accent }]}>{item.title}</Text>
                <Text style={styles.techniqueSubtitle}>{item.subtitle}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.visualSection}>
          <View style={[styles.orbHalo, { borderColor: `${technique.accent}26` }]}>
            <Animated.View
              style={[
                styles.orb,
                {
                  backgroundColor: `${technique.accent}30`,
                  borderColor: `${technique.accent}90`,
                  transform: [{ scale: orbScale }],
                },
              ]}
            >
              <View style={[styles.orbCore, { backgroundColor: technique.accent }]} />
            </Animated.View>
          </View>

          <Text style={[styles.phaseLabel, { color: technique.accent }]}>{currentPhase.label}</Text>
          <Text style={styles.instruction}>{isComplete ? 'Practice complete' : currentPhase.instruction}</Text>
          <Text style={styles.countdown}>{formatSeconds(timeLeft)}</Text>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>
              {technique.cycleLabel} {cycle} of {technique.cycles}
            </Text>
            <Text style={styles.progressMeta}>
              Step {currentStep} of {totalSteps}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: technique.accent }]} />
          </View>
          <Text style={styles.remainingText}>{formatSeconds(remainingTotal)} remaining</Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Ionicons name="refresh" size={18} color="#EBEBF5" />
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.startButton, { backgroundColor: technique.accent }]}
            onPress={toggleRunning}
          >
            <Ionicons name={isRunning ? 'pause' : 'play'} size={20} color="#FFFFFF" />
            <Text style={styles.startButtonText}>{isRunning ? 'Pause' : isComplete ? 'Again' : 'Start'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.patternCard}>
          <Text style={styles.cardTitle}>Pattern</Text>
          <View style={styles.phaseGrid}>
            {technique.pattern.map((phase, index) => (
              <View key={`${phase.shortLabel}-${index}`} style={styles.phasePill}>
                <Text style={styles.phasePillLabel}>{phase.shortLabel}</Text>
                <Text style={[styles.phasePillTime, { color: technique.accent }]}>{phase.duration}s</Text>
              </View>
            ))}
          </View>
          <Text style={styles.guidance}>{technique.guidance}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerText: { flex: 1 },
  title: { fontSize: 26, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 13, color: '#636366', marginTop: 2 },
  scrollContent: { paddingBottom: 32 },
  techniqueRow: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 18, gap: 10 },
  techniqueCard: {
    width: 132,
    minHeight: 72,
    borderRadius: 16,
    padding: 13,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  techniqueTitle: { fontSize: 15, fontWeight: '700', color: '#EBEBF5', marginBottom: 5 },
  techniqueSubtitle: { fontSize: 12, color: '#8E8E93' },
  visualSection: { alignItems: 'center', paddingTop: 4, paddingBottom: 18 },
  orbHalo: {
    width: 248,
    height: 248,
    borderRadius: 124,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 22,
  },
  orb: {
    width: 168,
    height: 168,
    borderRadius: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  orbCore: {
    width: 34,
    height: 34,
    borderRadius: 17,
    opacity: 0.9,
  },
  phaseLabel: { fontSize: 28, fontWeight: '800', marginBottom: 6 },
  instruction: { fontSize: 15, color: '#EBEBF5', textAlign: 'center', paddingHorizontal: 32, minHeight: 22 },
  countdown: { fontSize: 68, fontWeight: '200', color: '#FFFFFF', marginTop: 10 },
  progressCard: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  progressLabel: { fontSize: 14, fontWeight: '700', color: '#EBEBF5' },
  progressMeta: { fontSize: 12, color: '#636366', fontWeight: '600' },
  progressTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  remainingText: { color: '#8E8E93', fontSize: 12, marginTop: 10 },
  controls: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 16 },
  resetButton: {
    width: 112,
    minHeight: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  resetButtonText: { color: '#EBEBF5', fontSize: 16, fontWeight: '600' },
  startButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  patternCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardTitle: { fontSize: 13, color: '#636366', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  phaseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  phasePill: {
    minWidth: 70,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  phasePillLabel: { color: '#EBEBF5', fontSize: 12, fontWeight: '700', marginBottom: 3 },
  phasePillTime: { fontSize: 13, fontWeight: '800' },
  guidance: { color: '#8E8E93', fontSize: 13, lineHeight: 18 },
});
