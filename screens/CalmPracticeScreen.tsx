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
  dotColor: string;
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
    id: 'sigh',
    title: 'Physiological Sigh',
    subtitle: 'Double inhale',
    accent: '#C8A882',
    dotColor: '#C8A882',
    cycles: 5,
    cycleLabel: 'Sigh',
    guidance: 'Use the small top-up inhale, then make the exhale unhurried.',
    phases: sighPattern,
    pattern: sighPattern,
  },
  {
    id: 'box',
    title: 'Box Breathing',
    subtitle: '4-4-4-4',
    accent: '#8BAED4',
    dotColor: '#8BAED4',
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
    accent: '#C8A882',
    dotColor: '#C8A882',
    cycles: 4,
    cycleLabel: 'Round',
    guidance: 'Keep the exhale soft and longer than the inhale.',
    phases: fourSevenEightPattern,
    pattern: fourSevenEightPattern,
  },
  {
    id: 'coherent',
    title: 'Coherent Breathing',
    subtitle: '5 in, 5 out',
    accent: '#8BAED4',
    dotColor: '#8BAED4',
    cycles: 6,
    cycleLabel: 'Breath',
    guidance: 'An even rhythm for settling into a steady pace.',
    phases: coherentPattern,
    pattern: coherentPattern,
  },
  {
    id: 'wim-hof',
    title: 'Wim Hof',
    subtitle: '30 breaths',
    accent: '#C8A882',
    dotColor: '#C8A882',
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

// Deterministic dot positions for the particle orb on each card
function getDots(seed: number, count: number): { x: number; y: number; size: number; opacity: number }[] {
  const dots = [];
  for (let i = 0; i < count; i++) {
    // Pseudorandom but stable per technique
    const angle = (i / count) * Math.PI * 2 + seed;
    const r = 28 + ((i * seed * 7 + 13) % 22);
    const jitter = ((i * 17 + seed * 3) % 14) - 7;
    const x = 50 + Math.cos(angle) * r + jitter;
    const y = 50 + Math.sin(angle) * r + jitter * 0.7;
    const size = 1.5 + ((i * seed + 5) % 3) * 0.8;
    const opacity = 0.35 + ((i * 3 + seed) % 10) * 0.05;
    dots.push({ x, y, size, opacity });
  }
  return dots;
}

interface ParticleOrbProps {
  color: string;
  seed: number;
  scale: Animated.Value;
}

function ParticleOrb({ color, seed, scale }: ParticleOrbProps) {
  const dots = useMemo(() => getDots(seed, 48), [seed]);
  return (
    <Animated.View style={[s.orbContainer, { transform: [{ scale }] }]}>
      {dots.map((dot, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: `${dot.x}%` as any,
            top: `${dot.y}%` as any,
            width: dot.size,
            height: dot.size,
            borderRadius: dot.size / 2,
            backgroundColor: color,
            opacity: dot.opacity,
          }}
        />
      ))}
    </Animated.View>
  );
}

interface TechniqueCardProps {
  technique: BreathingTechnique;
  selected: boolean;
  onPress: () => void;
  seed: number;
}

function TechniqueCard({ technique, selected, onPress, seed }: TechniqueCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      style={[s.techniqueCard, selected && s.techniqueCardSelected]}
      onPress={onPress}
    >
      <View style={s.cardBookmark}>
        <Ionicons name="bookmark-outline" size={14} color="rgba(255,255,255,0.4)" />
      </View>
      <View style={s.cardOrbArea}>
        <View style={s.cardOrbFrame}>
          {Array.from({ length: 48 }).map((_, i) => {
            const angle = (i / 48) * Math.PI * 2 + seed;
            const r = 28 + ((i * seed * 7 + 13) % 22);
            const jitter = ((i * 17 + seed * 3) % 14) - 7;
            const x = 50 + Math.cos(angle) * r + jitter;
            const y = 50 + Math.sin(angle) * r + jitter * 0.7;
            const size = 1.5 + ((i * seed + 5) % 3) * 0.8;
            const opacity = 0.3 + ((i * 3 + seed) % 10) * 0.05;
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: `${x}%` as any,
                  top: `${y}%` as any,
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: technique.dotColor,
                  opacity: selected ? opacity + 0.15 : opacity,
                }}
              />
            );
          })}
        </View>
      </View>
      <Text style={[s.cardTitle, selected && { color: '#FFFFFF' }]}>{technique.title}</Text>
    </TouchableOpacity>
  );
}

export default function CalmPracticeScreen() {
  const navigation = useNavigation<any>();
  const [techniqueId, setTechniqueId] = useState('sigh');
  const technique = useMemo(
    () => TECHNIQUES.find(item => item.id === techniqueId) ?? TECHNIQUES[0],
    [techniqueId]
  );
  const techniqueIndex = TECHNIQUES.findIndex(t => t.id === techniqueId);

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
    if (isLastPhase && isLastCycle) { completeSession(); return; }
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
    if (timeLeft <= 0) { advancePhase(); return; }
    const timeout = setTimeout(() => setTimeLeft(prev => Math.max(prev - 1, 0)), 1000);
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
    if (isRunning) { setIsRunning(false); return; }
    if (isComplete) { resetSession(true); return; }
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
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Title block */}
        <View style={s.titleBlock}>
          <Text style={s.title}>Breathing</Text>
          <Text style={s.subtitle}>Exercises to center your mind, improve{'\n'}focus, and reduce stress</Text>
        </View>

        {/* 2-column technique grid */}
        <View style={s.grid}>
          {TECHNIQUES.map((item, idx) => (
            <TechniqueCard
              key={item.id}
              technique={item}
              selected={item.id === techniqueId}
              onPress={() => selectTechnique(item.id)}
              seed={idx + 1}
            />
          ))}
        </View>

        {/* Active session panel */}
        <View style={s.sessionCard}>
          {/* Particle orb */}
          <View style={s.sessionOrbWrapper}>
            <ParticleOrb
              color={technique.dotColor}
              seed={techniqueIndex + 1}
              scale={orbScale}
            />
          </View>

          <Text style={[s.phaseLabel, { color: technique.accent }]}>{currentPhase.label}</Text>
          <Text style={s.instruction}>{isComplete ? 'Practice complete' : currentPhase.instruction}</Text>
          <Text style={s.countdown}>{formatSeconds(timeLeft)}</Text>

          {/* Progress row */}
          <View style={s.progressRow}>
            <Text style={s.progressMeta}>{technique.cycleLabel} {cycle}/{technique.cycles} · Step {currentStep}/{totalSteps}</Text>
            <Text style={s.remainingText}>{formatSeconds(remainingTotal)}s left</Text>
          </View>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${progress * 100}%` as any, backgroundColor: technique.accent }]} />
          </View>

          {/* Controls */}
          <View style={s.controls}>
            <TouchableOpacity style={s.resetButton} onPress={handleReset}>
              <Ionicons name="refresh" size={16} color="rgba(255,255,255,0.5)" />
              <Text style={s.resetButtonText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.startButton, { backgroundColor: technique.accent }]}
              onPress={toggleRunning}
            >
              <Ionicons name={isRunning ? 'pause' : 'play'} size={18} color="#000000" />
              <Text style={s.startButtonText}>{isRunning ? 'Pause' : isComplete ? 'Again' : 'Start'}</Text>
            </TouchableOpacity>
          </View>

          {/* Pattern pills */}
          <View style={s.patternRow}>
            {technique.pattern.map((phase, index) => (
              <View key={`${phase.shortLabel}-${index}`} style={s.phasePill}>
                <Text style={s.phasePillLabel}>{phase.shortLabel}</Text>
                <Text style={[s.phasePillTime, { color: technique.accent }]}>{phase.duration}s</Text>
              </View>
            ))}
          </View>
          <Text style={s.guidance}>{technique.guidance}</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  scroll: { paddingBottom: 32 },

  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  titleBlock: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6E7A8A',
    lineHeight: 22,
    fontStyle: 'italic',
  },

  // 2-col grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 16,
  },
  techniqueCard: {
    width: '47.5%',
    aspectRatio: 0.9,
    backgroundColor: '#0D2040',
    borderRadius: 20,
    overflow: 'hidden',
    padding: 14,
    justifyContent: 'flex-end',
  },
  techniqueCardSelected: {
    backgroundColor: '#102850',
    borderWidth: 1,
    borderColor: 'rgba(200,168,130,0.35)',
  },
  cardBookmark: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  cardOrbArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cardOrbFrame: {
    width: 110,
    height: 110,
    position: 'relative',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 21,
  },

  // Active session
  sessionCard: {
    marginHorizontal: 12,
    backgroundColor: '#0D2040',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
  },
  sessionOrbWrapper: {
    width: 180,
    height: 180,
    marginBottom: 20,
  },
  orbContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },

  phaseLabel: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  instruction: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
    minHeight: 20,
  },
  countdown: {
    fontSize: 72,
    fontWeight: '200',
    color: '#FFFFFF',
    letterSpacing: -2,
    marginBottom: 16,
  },

  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  progressMeta: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
  remainingText: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressFill: { height: '100%', borderRadius: 2 },

  controls: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 20 },
  resetButton: {
    width: 90,
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  resetButtonText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },
  startButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  startButtonText: { color: '#000000', fontSize: 16, fontWeight: '800' },

  patternRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    width: '100%',
    marginBottom: 14,
  },
  phasePill: {
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  phasePillLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  phasePillTime: { fontSize: 12, fontWeight: '800' },
  guidance: { color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
