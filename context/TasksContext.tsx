import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@supabase/supabase-js';
import { Task, TaskStatus } from '../types';
import supabaseService from '../services/supabase';
import { scheduleTaskReminder, cancelTaskReminder } from '../utils/notifications';
import { getNotificationId, setNotificationId, removeNotificationId } from '../utils/notificationStore';

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

  // Schedule or reschedule a reminder for a task
  const syncReminder = useCallback(async (task: Task) => {
    // Cancel any existing notification for this task
    const existing = await getNotificationId(task.id as number);
    if (existing) await cancelTaskReminder(existing);

    // Schedule new one if task has a reminder and isn't completed
    if (task.reminderMinutes && !task.completed) {
      const notifId = await scheduleTaskReminder(task);
      if (notifId) await setNotificationId(task.id as number, notifId);
      else await removeNotificationId(task.id as number);
    } else {
      await removeNotificationId(task.id as number);
    }
  }, []);

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
      // Cancel reminder when task is completed
      const task = prev.find(t => t.id === id);
      if (task && !task.completed) {
        getNotificationId(id).then(nid => { if (nid) cancelTaskReminder(nid); });
        removeNotificationId(id);
      }
      return updated;
    });
  }, [userEmail, isGuest]);

  const deleteTask = useCallback(async (id: number) => {
    // Cancel reminder before deleting
    const nid = await getNotificationId(id);
    if (nid) await cancelTaskReminder(nid);
    await removeNotificationId(id);
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
      // Reschedule reminder if reminder-relevant fields changed
      if ('reminderMinutes' in updates || 'dueDate' in updates || 'dueTime' in updates || 'completed' in updates) {
        const updatedTask = updated.find(t => t.id === id);
        if (updatedTask) syncReminder(updatedTask);
      }
      return updated;
    });
    if (!isGuest) supabaseService.updateTask(id, updates, userEmail).catch(console.error);
  }, [userEmail, isGuest, syncReminder]);

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
        const appTask = supabaseService.convertToAppFormat(dbTask);
        setTasks(prev => [appTask, ...prev]);
        // Schedule reminder for newly created task
        if (appTask.reminderMinutes) syncReminder(appTask);
        return;
      } catch (e) { console.error(e); }
    }
    // Schedule reminder for guest task
    if (task.reminderMinutes) syncReminder(task);
  }, [userEmail, isGuest, syncReminder]);

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
