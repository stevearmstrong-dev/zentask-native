import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { Task, DbTask } from '../types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Create Supabase client with AsyncStorage for session persistence on device
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

class SupabaseService {
  // Auth methods
  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  async signOut(): Promise<boolean> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  getAuthStateChangeListener(
    callback: (event: AuthChangeEvent, session: Session | null) => void
  ) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  }

  // Fetch all tasks for authenticated user
  async fetchTasks(userEmail: string): Promise<DbTask[]> {
    if (!userEmail) return [];

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_email', userEmail)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as DbTask[]) || [];
    } catch (error) {
      console.error('Error fetching tasks:', error);
      return [];
    }
  }

  // Create a new task
  async createTask(task: Task, userEmail: string): Promise<DbTask> {
    if (!userEmail) throw new Error('User email required');

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([
          {
            id: task.id,
            user_email: userEmail,
            text: task.text,
            completed: task.completed,
            priority: task.priority,
            due_date: task.dueDate || null,
            due_time: task.dueTime || null,
            category: task.category || null,
            reminder_minutes: task.reminderMinutes || null,
            recurrence: task.recurrence || null,
            calendar_event_id: task.calendarEventId || null,
            time_spent: task.timeSpent || 0,
            is_tracking: task.isTracking || false,
            tracking_start_time: task.trackingStartTime || null,
            pomodoro_time: task.pomodoroTime || null,
            pomodoro_mode: task.pomodoroMode || null,
            pomodoro_active: task.pomodoroActive || false,
            scheduled_start: task.scheduledStart || null,
            scheduled_duration: task.scheduledDuration || null,
            sort_order: typeof task.sortOrder === 'number' ? task.sortOrder : 0,
            status: task.status || 'todo',
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data as DbTask;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  // Update an existing task
  async updateTask(
    taskId: number,
    updates: Partial<Task>,
    userEmail: string
  ): Promise<DbTask> {
    if (!userEmail) throw new Error('User email required');

    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          text: updates.text,
          completed: updates.completed,
          priority: updates.priority,
          due_date: updates.dueDate,
          due_time: updates.dueTime,
          category: updates.category,
          reminder_minutes: updates.reminderMinutes,
          recurrence: updates.recurrence,
          calendar_event_id: updates.calendarEventId,
          time_spent: updates.timeSpent,
          is_tracking: updates.isTracking,
          tracking_start_time: updates.trackingStartTime,
          pomodoro_time: updates.pomodoroTime,
          pomodoro_mode: updates.pomodoroMode,
          pomodoro_active: updates.pomodoroActive,
          scheduled_start: updates.scheduledStart,
          scheduled_duration: updates.scheduledDuration,
          status: updates.status,
          sort_order: updates.sortOrder,
        })
        .eq('id', taskId)
        .eq('user_email', userEmail)
        .select()
        .single();

      if (error) throw error;
      return data as DbTask;
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }

  // Delete a task
  async deleteTask(taskId: number, userEmail: string): Promise<boolean> {
    if (!userEmail) throw new Error('User email required');

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_email', userEmail);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }

  // Delete completed tasks
  async deleteCompletedTasks(userEmail: string): Promise<boolean> {
    if (!userEmail) throw new Error('User email required');

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('user_email', userEmail)
        .eq('completed', true);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting completed tasks:', error);
      throw error;
    }
  }

  // Convert database task to app format
  convertToAppFormat(dbTask: DbTask): Task {
    return {
      id: dbTask.id,
      text: dbTask.text,
      completed: dbTask.completed,
      priority: dbTask.priority as 'high' | 'medium' | 'low',
      dueDate: dbTask.due_date || undefined,
      dueTime: dbTask.due_time || undefined,
      category: dbTask.category || undefined,
      reminderMinutes: dbTask.reminder_minutes || undefined,
      recurrence: (dbTask.recurrence as 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | null) || undefined,
      calendarEventId: dbTask.calendar_event_id || undefined,
      timeSpent: dbTask.time_spent || 0,
      isTracking: dbTask.is_tracking || false,
      trackingStartTime: dbTask.tracking_start_time || undefined,
      pomodoroTime: dbTask.pomodoro_time || undefined,
      pomodoroMode: (dbTask.pomodoro_mode as 'work' | 'break') || undefined,
      pomodoroActive: dbTask.pomodoro_active || false,
      scheduledStart: dbTask.scheduled_start || undefined,
      scheduledDuration: dbTask.scheduled_duration || undefined,
      sortOrder: typeof dbTask.sort_order === 'number' ? dbTask.sort_order : 0,
      status: (dbTask.status as 'todo' | 'inprogress' | 'done' | null) || (dbTask.completed ? 'done' : 'todo'),
    };
  }

  // Convert app task to database format
  convertToDbFormat(task: Task, userEmail: string): DbTask {
    return {
      id: task.id,
      user_email: userEmail,
      text: task.text,
      completed: task.completed,
      priority: task.priority,
      due_date: task.dueDate || null,
      due_time: task.dueTime || null,
      category: task.category || null,
      reminder_minutes: task.reminderMinutes || null,
      recurrence: task.recurrence || null,
      calendar_event_id: task.calendarEventId || null,
      time_spent: task.timeSpent || 0,
      is_tracking: task.isTracking || false,
      tracking_start_time: task.trackingStartTime || null,
      pomodoro_time: task.pomodoroTime || null,
      pomodoro_mode: task.pomodoroMode || null,
      pomodoro_active: task.pomodoroActive || false,
      scheduled_start: task.scheduledStart || null,
      scheduled_duration: task.scheduledDuration || null,
      sort_order: typeof task.sortOrder === 'number' ? task.sortOrder : 0,
      status: task.status || 'todo',
    };
  }
}

const supabaseService = new SupabaseService();
export default supabaseService;
