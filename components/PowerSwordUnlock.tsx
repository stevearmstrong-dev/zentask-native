import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
  Dimensions,
} from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

type Phase = 'gems' | 'transform' | 'sword' | 'complete';

const GEM_EMOJIS = ['💧', '💪', '🍽️', '💰', '😴'];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function PowerSwordUnlock({ visible, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('gems');

  // Animated values
  const opacity      = useRef(new Animated.Value(0)).current;
  const swordScale   = useRef(new Animated.Value(0)).current;
  const swordOpacity = useRef(new Animated.Value(0)).current;
  const glowAnim     = useRef(new Animated.Value(0)).current;
  const gemScales    = useRef(GEM_EMOJIS.map(() => new Animated.Value(1))).current;
  const gemOpacities = useRef(GEM_EMOJIS.map(() => new Animated.Value(1))).current;
  const textOpacity  = useRef(new Animated.Value(0)).current;
  const burstScale   = useRef(new Animated.Value(0)).current;
  const burstOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      // Reset
      setPhase('gems');
      opacity.setValue(0);
      swordScale.setValue(0);
      swordOpacity.setValue(0);
      glowAnim.setValue(0);
      textOpacity.setValue(0);
      burstScale.setValue(0);
      burstOpacity.setValue(0);
      gemScales.forEach(a => a.setValue(1));
      gemOpacities.forEach(a => a.setValue(1));
      return;
    }

    // Fade in overlay
    Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    // Phase 1: gems (0-1000ms) — gems pulse in
    Animated.stagger(100, gemScales.map(a =>
      Animated.sequence([
        Animated.timing(a, { toValue: 1.4, duration: 300, useNativeDriver: true }),
        Animated.timing(a, { toValue: 1,   duration: 200, useNativeDriver: true }),
      ])
    )).start();

    // Phase 2: transform (1000ms) — gems fly together & burst
    const t2 = setTimeout(() => {
      setPhase('transform');
      Animated.parallel([
        ...gemOpacities.map(a =>
          Animated.timing(a, { toValue: 0, duration: 400, useNativeDriver: true })
        ),
        Animated.sequence([
          Animated.timing(burstScale, { toValue: 1.5, duration: 400, useNativeDriver: true }),
          Animated.timing(burstScale, { toValue: 0.8, duration: 200, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(burstOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.delay(400),
          Animated.timing(burstOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
        Animated.timing(textOpacity, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }),
      ]).start();
    }, 1000);

    // Phase 3: sword (2500ms)
    const t3 = setTimeout(() => {
      setPhase('sword');
      textOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(swordScale, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
        Animated.timing(swordOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.timing(glowAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
          ])
        ),
      ]).start();
    }, 2500);

    // Phase 4: complete (4500ms)
    const t4 = setTimeout(() => setPhase('complete'), 4500);

    return () => { clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [visible]);

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(251,191,36,0.2)', 'rgba(251,191,36,0.8)'],
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={phase === 'complete' ? onClose : undefined}>
        <Animated.View style={[s.overlay, { opacity }]}>

          {/* Gems phase */}
          {(phase === 'gems') && (
            <View style={s.gemsContainer}>
              <Text style={s.phaseTitle}>All Gems Collected!</Text>
              <View style={s.gemsRow}>
                {GEM_EMOJIS.map((gem, i) => (
                  <Animated.Text
                    key={i}
                    style={[s.gemEmoji, { transform: [{ scale: gemScales[i] }], opacity: gemOpacities[i] }]}
                  >
                    {gem}
                  </Animated.Text>
                ))}
              </View>
              <Text style={s.phaseSubtitle}>Forging your Power Sword…</Text>
            </View>
          )}

          {/* Transform phase */}
          {phase === 'transform' && (
            <View style={s.transformContainer}>
              <Animated.View style={[s.burst, { transform: [{ scale: burstScale }], opacity: burstOpacity }]} />
              <Animated.Text style={[s.grayskull, { opacity: textOpacity }]}>
                BY THE POWER OF{'\n'}GRAYSKULL!
              </Animated.Text>
            </View>
          )}

          {/* Sword phase & complete */}
          {(phase === 'sword' || phase === 'complete') && (
            <View style={s.swordContainer}>
              <Animated.View style={[s.glowRing, { backgroundColor: glowColor }]} />
              <Animated.Text style={[s.swordEmoji, { transform: [{ scale: swordScale }], opacity: swordOpacity }]}>
                ⚔️
              </Animated.Text>
              <Animated.Text style={[s.swordTitle, { opacity: swordOpacity }]}>
                Power Sword Unlocked!
              </Animated.Text>
              <Animated.Text style={[s.swordMessage, { opacity: swordOpacity }]}>
                You've mastered all 5 pillars today.{'\n'}A new sword is added to your Hall.
              </Animated.Text>
              {phase === 'complete' && (
                <TouchableOpacity style={s.continueBtn} onPress={onClose}>
                  <Text style={s.continueBtnText}>Continue Your Quest ⚔️</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gemsContainer: { alignItems: 'center', gap: 24 },
  gemsRow: { flexDirection: 'row', gap: 16 },
  gemEmoji: { fontSize: 44 },
  phaseTitle: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  phaseSubtitle: { fontSize: 16, color: '#636366', textAlign: 'center' },

  transformContainer: { alignItems: 'center', justifyContent: 'center' },
  burst: {
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(251,191,36,0.4)',
    position: 'absolute',
  },
  grayskull: {
    fontSize: 28, fontWeight: '900', color: '#FBBF24',
    textAlign: 'center', lineHeight: 38, letterSpacing: 2,
  },

  swordContainer: { alignItems: 'center', gap: 16 },
  glowRing: {
    width: 160, height: 160, borderRadius: 80,
    position: 'absolute',
  },
  swordEmoji: { fontSize: 96 },
  swordTitle: { fontSize: 26, fontWeight: '800', color: '#FBBF24', textAlign: 'center' },
  swordMessage: { fontSize: 15, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },
  continueBtn: {
    marginTop: 8,
    backgroundColor: '#FBBF24', borderRadius: 16,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  continueBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
});
