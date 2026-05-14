import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { Colors, Spacing, Typography, BorderRadius, ComponentTokens, Opacity } from '../constants/theme';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

// Simple button that shows an alert on simulator
export default function VoiceInputButton({ disabled }: VoiceInputButtonProps) {
  const isSimulator = Constants.isDevice === false;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Simulator Not Supported',
      'Voice input requires a real device with a microphone. Please test on a physical iPhone to use this feature.',
      [{ text: 'OK' }]
    );
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      style={[styles.button, disabled && styles.buttonDisabled]}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <Ionicons name="mic" size={18} color={Colors.text.secondary} />
        <Text style={styles.text}>Voice Input</Text>
        {isSimulator && <Text style={styles.simulatorBadge}>(Simulator)</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.surface.base,
    borderRadius: ComponentTokens.button.borderRadius,
    borderWidth: 1,
    borderColor: Colors.border.default,
    paddingVertical: ComponentTokens.button.paddingVertical,
    paddingHorizontal: ComponentTokens.button.paddingHorizontal,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: ComponentTokens.button.minHeight,
    flex: 1,
  },
  buttonDisabled: {
    opacity: Opacity.disabled,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  text: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    fontWeight: Typography.fontWeight.medium,
  },
  simulatorBadge: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
  },
});
