import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User } from '@supabase/supabase-js';
import { Task } from '../types';
import supabaseService from '../services/supabase';
import TaskItem from '../components/TaskItem';
import AddTaskModal from '../components/AddTaskModal';

interface Props {
  user: User | null;
}

type Filter = 'all' | 'active' | 'completed';

const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
];

export default function AllTasksScreen({ user }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const userEmail = user?.email || '';
  const isGuest = !userEmail;

  const loadTasks = useCallback(async () => {
    try {
      const dbTasks = await supabaseService.fetchTasks(userEmail);
      setTasks(dbTasks.map(t => supabaseService.convertToAppFormat(t)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userEmail]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const filteredTasks = tasks.filter(t => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  const handleToggle = async (id: number) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    try {
      await supabaseService.updateTask(id, { completed: !task.completed }, userEmail);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: number) => {
    try {
      await supabaseService.deleteTask(id, userEmail);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (e) { console.error(e); }
  };

  const handleEdit = async (id: number, updates: Partial<Task>) => {
    try {
      await supabaseService.updateTask(id, updates, userEmail);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    } catch (e) { console.error(e); }
  };

  const handleAdd = async (newTask: { text: string; priority: any; dueDate: string; dueTime: string; category: string }) => {
    if (!userEmail) {
      Alert.alert(
        'Sign In Required',
        'Tasks can\'t be saved in guest mode. Sign in to create and sync tasks across your devices.',
        [{ text: 'OK' }]
      );
      return;
    }
    try {
      const task: Task = {
        id: Date.now(),
        text: newTask.text,
        completed: false,
        priority: newTask.priority,
        dueDate: newTask.dueDate || undefined,
        dueTime: newTask.dueTime || undefined,
        category: newTask.category || undefined,
        timeSpent: 0,
        isTracking: false,
        pomodoroActive: false,
        sortOrder: 0,
        status: 'todo',
      };
      const dbTask = await supabaseService.createTask(task, userEmail);
      setTasks(prev => [supabaseService.convertToAppFormat(dbTask), ...prev]);
    } catch (e) { console.error(e); }
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
      {/* Guest banner */}
      {isGuest && (
        <View style={styles.guestBanner}>
          <Text style={styles.guestBannerText}>👤 Guest mode — sign in to save tasks</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>All Tasks</Text>
        <TouchableOpacity style={[styles.addBtn, isGuest && styles.addBtnDisabled]} onPress={() => setShowAddModal(true)}>
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterTab, filter === f.value && styles.filterTabActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.filterTabText, filter === f.value && styles.filterTabTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Task count */}
      <Text style={styles.countText}>{filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}</Text>

      {/* Task list */}
      <FlatList
        data={filteredTasks}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <TaskItem
            task={item}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTasks(); }} tintColor="#1877F2" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{filter === 'completed' ? '✓' : '📋'}</Text>
            <Text style={styles.emptyText}>
              {filter === 'completed' ? 'No completed tasks yet' : 'No tasks here'}
            </Text>
            {filter !== 'completed' && (
              <TouchableOpacity style={styles.emptyAddBtn} onPress={() => setShowAddModal(true)}>
                <Text style={styles.emptyAddBtnText}>Add your first task</Text>
              </TouchableOpacity>
            )}
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
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  loader: { flex: 1, backgroundColor: '#0A0A0F', justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  addBtn: {
    backgroundColor: '#1877F2',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  addBtnDisabled: { backgroundColor: '#48484A' },
  guestBanner: {
    backgroundColor: 'rgba(255,159,10,0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,159,10,0.3)',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  guestBannerText: { color: '#FF9F0A', fontSize: 14, fontWeight: '500' },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterTabActive: { backgroundColor: '#1877F2', borderColor: '#1877F2' },
  filterTabText: { fontSize: 14, color: '#636366', fontWeight: '500' },
  filterTabTextActive: { color: '#FFFFFF', fontWeight: '600' },
  countText: { fontSize: 13, color: '#48484A', paddingHorizontal: 20, marginBottom: 8 },
  list: { padding: 20, paddingTop: 4 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 17, color: '#636366' },
  emptyAddBtn: {
    marginTop: 8,
    backgroundColor: '#1877F2',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyAddBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
