// Shared TypeScript type definitions for Zentask

export type Priority = 'high' | 'medium' | 'low';

export type Recurrence = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | null;

export type ViewType = 'today' | 'tasks' | 'dashboard' | 'matrix' | 'pomodoro' | 'timeblocks' | 'upcoming' | 'kanban';

export type TaskStatus = 'todo' | 'inprogress' | 'done';

export interface Task {
  id: number;
  text: string;
  completed: boolean;
  priority: Priority;
  dueDate?: string;
  dueTime?: string;
  category?: string;
  reminderMinutes?: number | null;
  recurrence?: Recurrence;
  calendarEventId?: string;
  timeSpent?: number;
  isTracking?: boolean;
  trackingStartTime?: number | null;
  pomodoroTime?: number;
  pomodoroMode?: 'work' | 'break';
  pomodoroActive?: boolean;
  scheduledStart?: string; // ISO timestamp for scheduled start time
  scheduledDuration?: number; // Duration in minutes
  sortOrder?: number;
  status?: TaskStatus;
}

export interface TimeData {
  timeSpent: number;
  isTracking: boolean;
  trackingStartTime: number | null;
}

export interface PomodoroSettings {
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
}

export type PomodoroMode = 'work' | 'shortBreak' | 'longBreak';

export interface User {
  email: string;
  displayName?: string;
}

// Supabase database column names (snake_case)
export interface DbTask {
  id: number;
  user_email: string;
  text: string;
  completed: boolean;
  priority: string;
  due_date: string | null;
  due_time: string | null;
  category: string | null;
  reminder_minutes: number | null;
  recurrence: string | null;
  calendar_event_id: string | null;
  time_spent: number;
  is_tracking: boolean;
  tracking_start_time: number | null;
  pomodoro_time: number | null;
  pomodoro_mode: string | null;
  pomodoro_active: boolean;
  scheduled_start: string | null;
  scheduled_duration: number | null;
  sort_order: number | null;
  status: string | null;
  created_at?: string;
}
