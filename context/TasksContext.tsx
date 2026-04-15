import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@supabase/supabase-js';
import { Task, TaskStatus } from '../types';
import supabaseService from '../services/supabase';

const GUEST_TASKS_KEY = 'zentask:guest_tasks';

interface TasksContextValue {
  tasks: Task[];
  loading: boolean;
  reload: () => Promise<void>;
  toggleTask: (id: number) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  editTask: (id: number, updates: Partial<Task>) => Promise<void>;
  addTask: (task: Task) => Promise<void>;
  moveTask: (id: number, status: TaskStatus) => Promise<void>;
}

const TasksContext = createContext<TasksContextValue | null>(null);

export function TasksProvider({ user, children }: { user: User | null; children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const userEmail = user?.email || '';
  const isGuest = !userEmail;

  const persist = async (updated: Task[]) => {
    if (isGuest) await AsyncStorage.setItem(GUEST_TASKS_KEY, JSON.stringify(updated));
  };

  const reload = useCallback(async () => {
    try {
      if (isGuest) {
        const raw = await AsyncStorage.getItem(GUEST_TASKS_KEY);
        setTasks(raw ? JSON.parse(raw) : []);
      } else {
        const dbTasks = await supabaseService.fetchTasks(userEmail);
        setTasks(dbTasks.map(t => supabaseService.convertToAppFormat(t)));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [userEmail, isGuest]);

  useEffect(() => { reload(); }, [reload]);

  const toggleTask = useCallback(async (id: number) => {
    setTasks(prev => {
      const updated = prev.map(t => {
        if (t.id !== id) return t;
        const completed = !t.completed;
        return { ...t, completed, status: completed ? 'done' : 'todo' } as Task;
      });
      persist(updated);
      if (!isGuest) {
        const task = prev.find(t => t.id === id);
        if (task) {
          const completed = !task.completed;
          supabaseService.updateTask(id, { completed, status: completed ? 'done' : 'todo' }, userEmail).catch(console.error);
        }
      }
      return updated;
    });
  }, [userEmail, isGuest]);

  const deleteTask = useCallback(async (id: number) => {
    setTasks(prev => {
      const updated = prev.filter(t => t.id !== id);
      persist(updated);
      return updated;
    });
    if (!isGuest) supabaseService.deleteTask(id, userEmail).catch(console.error);
  }, [userEmail, isGuest]);

  const editTask = useCallback(async (id: number, updates: Partial<Task>) => {
    setTasks(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, ...updates } : t);
      persist(updated);
      return updated;
    });
    if (!isGuest) supabaseService.updateTask(id, updates, userEmail).catch(console.error);
  }, [userEmail, isGuest]);

  const addTask = useCallback(async (task: Task) => {
    if (isGuest) {
      setTasks(prev => {
        const updated = [task, ...prev];
        persist(updated);
        return updated;
      });
    } else {
      try {
        const dbTask = await supabaseService.createTask(task, userEmail);
        setTasks(prev => [supabaseService.convertToAppFormat(dbTask), ...prev]);
      } catch (e) { console.error(e); }
    }
  }, [userEmail, isGuest]);

  const moveTask = useCallback(async (id: number, status: TaskStatus) => {
    const completed = status === 'done';
    setTasks(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, status, completed } : t);
      persist(updated);
      return updated;
    });
    if (!isGuest) supabaseService.updateTask(id, { status, completed }, userEmail).catch(console.error);
  }, [userEmail, isGuest]);

  return (
    <TasksContext.Provider value={{ tasks, loading, reload, toggleTask, deleteTask, editTask, addTask, moveTask }}>
      {children}
    </TasksContext.Provider>
  );
}

export function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error('useTasks must be used within TasksProvider');
  return ctx;
}
