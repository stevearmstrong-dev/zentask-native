import React, { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { User } from '@supabase/supabase-js';
import { Task } from '../types';
import { useTasks } from '../context/TasksContext';
import FocusMode from '../components/FocusMode';
import AddTaskModal from '../components/AddTaskModal';
import { toLocalDateString } from '../utils/date';
import { Colors, Spacing, Typography, BorderRadius, Shadows, TouchTarget, getPriorityColor } from '../constants/theme';

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

// Priority colors moved to theme

interface NewTaskInput {
  text: string;
  priority: Task['priority'];
  dueDate: string;
  dueTime: string;
  category: string;
  reminderMinutes: number | null;
}

export default function TodayScreen({ user }: Props) {
  const { tasks, loading, reload, toggleTask, editTask, addTask } = useTasks();
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const userEmail = user?.email || '';
  const userName = user?.user_metadata?.name || (userEmail ? userEmail.split('@')[0] : 'Guest');

  const todayStr = toLocalDateString();
  const todayTasks = tasks.filter(t => !t.completed && t.dueDate === todayStr);
  const overdueTasks = tasks.filter(t => {
    if (!t.dueDate || t.completed) return false;
    return t.dueDate < todayStr;
  });
  const completedToday = tasks.filter(t => t.completed && t.dueDate === todayStr).length;
  const totalToday = todayTasks.length + completedToday;
  const completionRate = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  const handleAdd = async (newTask: NewTaskInput) => {
    const task: Task = {
      id: Date.now(),
      text: newTask.text,
      completed: false,
      priority: newTask.priority,
      dueDate: newTask.dueDate || todayStr,
      dueTime: newTask.dueTime || undefined,
      category: newTask.category || undefined,
      reminderMinutes: newTask.reminderMinutes ?? undefined,
      timeSpent: 0,
      isTracking: false,
      pomodoroActive: false,
      sortOrder: 0,
      status: 'todo',
    };
    await addTask(task);
  };

  const renderTask = ({ item }: { item: Task }) => {
    const priorityColor = getPriorityColor(item.priority || 'medium');

    return (
      <TouchableOpacity
        style={styles.taskRow}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          toggleTask(item.id as number);
        }}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setFocusTask(item);
        }}
        delayLongPress={400}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, item.completed && styles.checkboxDone]}>
          {item.completed && <Ionicons name="checkmark" size={16} color="#fff" />}
        </View>
        <View style={styles.taskInfo}>
          <Text style={[styles.taskText, item.completed && styles.taskTextDone]} numberOfLines={2}>
            {item.text}
          </Text>
          <View style={styles.taskMeta}>
            {item.dueTime && (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={12} color={Colors.text.tertiary} />
                <Text style={styles.taskTime}>{item.dueTime}</Text>
              </View>
            )}
            {(item.timeSpent ?? 0) > 0 && (
              <View style={styles.metaItem}>
                <Ionicons name="timer-outline" size={12} color={Colors.text.tertiary} />
                <Text style={styles.taskTimeSpent}>{Math.round((item.timeSpent ?? 0) / 60)}m</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.taskRight}>
          <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
          <Text style={styles.focusHint}>hold</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#1877F2" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FocusMode
        visible={!!focusTask}
        task={focusTask}
        onClose={() => setFocusTask(null)}
        onComplete={id => { toggleTask(id); setFocusTask(null); }}
        onUpdateTime={(id, data) => editTask(id, data)}
      />
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.greeting}>{greeting()}, {userName}</Text>
          <Text style={styles.date}>{formatDate()}</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowAddModal(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Add task for today"
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
      </View>

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

      <FlatList
        data={[...overdueTasks, ...todayTasks]}
        keyExtractor={item => String(item.id)}
        renderItem={renderTask}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor="#1877F2" />}
        ListHeaderComponent={
          <Text style={styles.sectionTitle}>
            {overdueTasks.length > 0 ? 'Overdue & Today' : "Today's Tasks"}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle" size={64} color={Colors.semantic.success} />
            <Text style={styles.emptyText}>All clear for today!</Text>
            <Text style={styles.emptySubtext}>Great work! Time to relax or plan ahead</Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />

      <AddTaskModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAdd}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary
  },
  loader: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    gap: Spacing.lg,
  },
  headerCopy: { flex: 1 },
  greeting: {
    fontSize: Typography.fontSize.xxxl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary
  },
  date: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.tertiary,
    marginTop: 2
  },
  addButton: {
    width: TouchTarget.min,
    height: TouchTarget.min,
    borderRadius: TouchTarget.min / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.interactive.primary,
    ...Shadows.lg,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
    marginBottom: Spacing.sm
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface.base,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  statNum: {
    fontSize: Typography.fontSize.xxxl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary
  },
  statRed: { color: Colors.semantic.error },
  statGreen: { color: Colors.semantic.success },
  statLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
    marginTop: 2
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.secondary,
    marginBottom: Spacing.md
  },
  list: {
    padding: Spacing.xl,
    paddingTop: Spacing.sm
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.base,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    gap: Spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: Colors.semantic.success,
    borderColor: Colors.semantic.success
  },
  taskInfo: { flex: 1 },
  taskText: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  taskTextDone: {
    color: Colors.text.disabled,
    textDecorationLine: 'line-through'
  },
  taskMeta: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  taskTime: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary
  },
  taskTimeSpent: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary
  },
  taskRight: {
    alignItems: 'center',
    gap: 4
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  focusHint: {
    fontSize: 9,
    color: Colors.text.disabled
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: Typography.fontSize.xl,
    color: Colors.text.secondary,
    fontWeight: Typography.fontWeight.semibold,
  },
  emptySubtext: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.tertiary,
  },
});
