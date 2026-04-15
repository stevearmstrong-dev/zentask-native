import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { User } from '@supabase/supabase-js';

interface MenuItem {
  icon: string;
  label: string;
  sublabel: string;
  comingSoon?: boolean;
  screen?: string;
}

const MENU_SECTIONS: { title: string; items: MenuItem[] }[] = [
  {
    title: 'Productivity',
    items: [
      { icon: '📋', label: 'Kanban Board', sublabel: 'Visual task management', screen: 'Kanban' },
      { icon: '⊞', label: 'Eisenhower Matrix', sublabel: 'Prioritise by urgency & importance', screen: 'Eisenhower' },
      { icon: '🕒', label: 'Time Blocks', sublabel: 'Schedule your day', comingSoon: true },
    ],
  },
  {
    title: 'Health & Lifestyle',
    items: [
      { icon: '💧', label: 'Water Tracker', sublabel: 'Stay hydrated', screen: 'WaterTracker' },
      { icon: '🍳', label: 'Meal Tracker', sublabel: 'Log your meals', screen: 'MealTracker' },
      { icon: '🏋️', label: 'Workout Tracker', sublabel: 'Track your workouts', screen: 'WorkoutTracker' },
      { icon: '😴', label: 'Sleep Tracker', sublabel: 'Monitor sleep quality', screen: 'SleepTracker' },
      { icon: '💪', label: 'NoFap Tracker', sublabel: 'Streak tracking', comingSoon: true },
    ],
  },
  {
    title: 'Finance',
    items: [
      { icon: '💰', label: 'Expense Tracker', sublabel: 'Track spending', comingSoon: true },
      { icon: '📅', label: 'Recurring Expenses', sublabel: 'Subscriptions & bills', comingSoon: true },
      { icon: '💳', label: 'Credit Score', sublabel: 'Monitor your score', comingSoon: true },
    ],
  },
  {
    title: 'Gamification',
    items: [
      { icon: '⚔️', label: 'Power Sword Hall', sublabel: 'Unlock achievements', comingSoon: true },
    ],
  },
];

interface Props {
  user: User | null;
  onSignOut: () => void;
}

export default function MoreScreen({ user, onSignOut }: Props) {
  const navigation = useNavigation<any>();
  const userEmail = user?.email || '';
  const userName = user?.user_metadata?.name || (userEmail ? userEmail.split('@')[0] : 'Guest');
  const isGuest = !userEmail;
  const initials = userName.charAt(0).toUpperCase();

  const handleSignOut = () => {
    Alert.alert(
      isGuest ? 'Leave Guest Mode' : 'Sign Out',
      isGuest ? 'Any locally saved tasks will remain on this device.' : 'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: isGuest ? 'Leave' : 'Sign Out', style: 'destructive', onPress: onSignOut },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.pageTitle}>More</Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* User card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.userEmail}>{isGuest ? 'Guest Mode' : userEmail}</Text>
          </View>
          {isGuest && (
            <View style={styles.guestBadge}>
              <Text style={styles.guestBadgeText}>Guest</Text>
            </View>
          )}
        </View>

        {/* Menu sections */}
        {MENU_SECTIONS.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, idx) => (
                <View key={item.label}>
                  <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => item.screen && navigation.navigate(item.screen)}>
                    <Text style={styles.menuIcon}>{item.icon}</Text>
                    <View style={styles.menuText}>
                      <Text style={styles.menuLabel}>{item.label}</Text>
                      <Text style={styles.menuSublabel}>{item.sublabel}</Text>
                    </View>
                    {item.comingSoon ? (
                      <View style={styles.comingSoonBadge}>
                        <Text style={styles.comingSoonText}>Soon</Text>
                      </View>
                    ) : (
                      <Text style={styles.chevron}>›</Text>
                    )}
                  </TouchableOpacity>
                  {idx < section.items.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>{isGuest ? 'Leave Guest Mode' : 'Sign Out'}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>ZenTask Native v0.1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  pageTitle: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    marginHorizontal: 20,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1877F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: '#fff' },
  userInfo: { flex: 1 },
  userName: { fontSize: 17, fontWeight: '600', color: '#FFFFFF', marginBottom: 2 },
  userEmail: { fontSize: 13, color: '#636366' },
  guestBadge: { backgroundColor: 'rgba(255,159,10,0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,159,10,0.4)' },
  guestBadgeText: { color: '#FF9F0A', fontSize: 12, fontWeight: '600' },
  section: { marginBottom: 24, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#636366', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  sectionCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  menuIcon: { fontSize: 22, width: 32, textAlign: 'center' },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 15, color: '#EBEBF5', fontWeight: '500' },
  menuSublabel: { fontSize: 12, color: '#636366', marginTop: 1 },
  chevron: { fontSize: 20, color: '#48484A', fontWeight: '300' },
  comingSoonBadge: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  comingSoonText: { fontSize: 11, color: '#636366', fontWeight: '500' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginLeft: 58 },
  signOutBtn: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: 'rgba(255,69,58,0.12)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.25)',
  },
  signOutText: { color: '#FF453A', fontSize: 16, fontWeight: '600' },
  version: { textAlign: 'center', color: '#48484A', fontSize: 12, marginBottom: 32 },
});
