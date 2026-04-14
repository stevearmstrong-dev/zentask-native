import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  title: string;
  icon: string;
  onSignOut?: () => void;
}

export default function PlaceholderScreen({ title, icon, onSignOut }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Coming soon</Text>
        {onSignOut && (
          <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  icon: { fontSize: 56 },
  title: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 16, color: '#636366' },
  signOutBtn: {
    marginTop: 32,
    backgroundColor: 'rgba(255,69,58,0.15)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.3)',
  },
  signOutText: { color: '#FF453A', fontSize: 16, fontWeight: '600' },
});
