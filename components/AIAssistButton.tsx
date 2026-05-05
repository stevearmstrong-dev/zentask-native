import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';

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

  return (
    <TouchableOpacity
      onPress={onPress}
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
          <ActivityIndicator size="small" color={isPrimary ? '#fff' : '#007AFF'} />
          <Text style={[styles.text, isPrimary ? styles.primaryText : styles.secondaryText]}>
            Thinking...
          </Text>
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.icon}>{icon}</Text>
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
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    fontSize: 16,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryText: {
    color: '#fff',
  },
  secondaryText: {
    color: '#007AFF',
  },
});
