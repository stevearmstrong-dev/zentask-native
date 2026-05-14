import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Typography, BorderRadius, ComponentTokens, Opacity } from '../constants/theme';

interface AIAssistButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  icon?: string;
  text?: string;
}

export default function AIAssistButton({
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  icon = '✨',
  text = 'AI Assist',
}: AIAssistButtonProps) {
  const isPrimary = variant === 'primary';

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      style={[
        styles.button,
        isPrimary ? styles.primaryButton : styles.secondaryButton,
        (disabled || loading) && styles.disabled,
      ]}
      activeOpacity={0.7}
    >
      {loading ? (
        <View style={styles.content}>
          <ActivityIndicator size="small" color={isPrimary ? Colors.text.primary : Colors.interactive.secondary} />
          <Text style={[styles.text, isPrimary ? styles.primaryText : styles.secondaryText]}>
            Thinking...
          </Text>
        </View>
      ) : (
        <View style={styles.content}>
          <Ionicons
            name="sparkles"
            size={16}
            color={isPrimary ? Colors.text.primary : Colors.interactive.secondary}
          />
          <Text style={[styles.text, isPrimary ? styles.primaryText : styles.secondaryText]}>
            {text}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: ComponentTokens.button.paddingVertical,
    paddingHorizontal: ComponentTokens.button.paddingHorizontal,
    borderRadius: ComponentTokens.button.borderRadius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: ComponentTokens.button.minHeight,
    flex: 1,
  },
  primaryButton: {
    backgroundColor: Colors.interactive.secondary,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.interactive.secondary,
  },
  disabled: {
    opacity: Opacity.disabled,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  text: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  primaryText: {
    color: Colors.text.primary,
  },
  secondaryText: {
    color: Colors.interactive.secondary,
  },
});
