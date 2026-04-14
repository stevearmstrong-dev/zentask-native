import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User } from '@supabase/supabase-js';
import { Task } from '../types';
import supabaseService from '../services/supabase';

interface Props {
  user: User | null;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

const PRIORITY_COLOR: Record<string, string> = {
  high: '#FF453A',
  medium: '#FF9F0A',
  low: '#30D158',
};

export default function TodayScreen({ user }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const userEmail = user?.email || '';
  const userName = user?.user_metadata?.name || (userEmail ? userEmail.split('@')[0] : 'Guest');

  const loadTasks = async () => {
    try {
      const dbTasks = await supabaseService.fetchTasks(userEmail);
      setTasks(dbTasks.map(t => supabaseService.convertToAppFormat(t)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadTasks(); }, []);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayTasks = tasks.filter(t => !t.completed && t.dueDate === todayStr);
  const overdueTasks = tasks.filter(t => {
    if (!t.dueDate || t.completed) return false;
    return t.dueDate < todayStr;
  });
  const completedToday = tasks.filter(t => t.completed && t.dueDate === todayStr).length;
  const totalToday = todayTasks.length + completedToday;
  const completionRate = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  const toggleTask = async (task: Task) => {
    try {
      await supabaseService.updateTask(task.id as number, { completed: !task.completed }, userEmail);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t));
    } catch (e) {
      console.error(e);
    }
  };

  const renderTask = ({ item }: { item: Task }) => (
    <TouchableOpacity style={styles.taskRow} onPress={() => toggleTask(item)} activeOpacity={0.7}>
      <View style={[styles.checkbox, item.completed && styles.checkboxDone]}>
        {item.completed && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.taskInfo}>
        <Text style={[styles.taskText, item.completed && styles.taskTextDone]} numberOfLines={2}>
          {item.text}
        </Text>
        {item.dueTime && <Text style={styles.taskTime}>{item.dueTime}</Text>}
      </View>
      <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLOR[item.priority] }]} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#1877F2" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting()}, {userName} 👋</Text>
          <Text style={styles.date}>{formatDate()}</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{todayTasks.length}</Text>
          <Text style={styles.statLabel}>Due Today</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, overdueTasks.length > 0 && styles.statRed]}>{overdueTasks.length}</Text>
          <Text style={styles.statLabel}>Overdue</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, styles.statGreen]}>{completionRate}%</Text>
          <Text style={styles.statLabel}>Done Today</Text>
        </View>
      </View>

      {/* Today's tasks */}
      <FlatList
        data={[...overdueTasks, ...todayTasks]}
        keyExtractor={item => String(item.id)}
        renderItem={renderTask}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTasks(); }} tintColor="#1877F2" />}
        ListHeaderComponent={
          <Text style={styles.sectionTitle}>
            {overdueTasks.length > 0 ? 'Overdue & Today' : "Today's Tasks"}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎉</Text>
            <Text style={styles.emptyText}>All clear for today!</Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  loader: { flex: 1, backgroundColor: '#0A0A0F', justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  date: { fontSize: 14, color: '#636366', marginTop: 2 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 8 },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statNum: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
  statRed: { color: '#FF453A' },
  statGreen: { color: '#30D158' },
  statLabel: { fontSize: 12, color: '#636366', marginTop: 2 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: '#EBEBF5', marginBottom: 12 },
  list: { padding: 20, paddingTop: 8 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: '#30D158', borderColor: '#30D158' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  taskInfo: { flex: 1 },
  taskText: { fontSize: 15, color: '#EBEBF5' },
  taskTextDone: { color: '#48484A', textDecorationLine: 'line-through' },
  taskTime: { fontSize: 12, color: '#636366', marginTop: 2 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 17, color: '#636366' },
});
