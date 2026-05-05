import { supabase } from './supabase';

export interface ParsedTask {
  text: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:MM
  priority?: 'high' | 'medium' | 'low';
  category?: string;
  reminderMinutes?: number;
  recurrence?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
}

export interface TaskBreakdown {
  mainTask: string;
  subtasks: Array<{
    text: string;
    estimatedMinutes?: number;
    priority?: 'high' | 'medium' | 'low';
  }>;
  totalEstimatedTime?: number;
}

export interface PrioritizationSuggestion {
  taskId: number;
  reasoning: string;
  suggestedOrder: number;
  focusScore: number; // 1-10
}

interface InvokeResponse<T> {
  data?: T;
  error?: string;
}

export class AIAssistAuthRequiredError extends Error {
  constructor() {
    super('Sign in to use AI Assist.');
    this.name = 'AIAssistAuthRequiredError';
  }
}

function getFunctionErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function getClientDateContext(): Record<string, string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';

  return {
    clientDate: `${year}-${month}-${day}`,
    clientTime: `${hour}:${minute}`,
    clientTimeZone: timeZone,
  };
}

async function invokeAIAssistant<T>(
  action: string,
  payload: Record<string, unknown>
): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;
  if (!sessionData.session) throw new AIAssistAuthRequiredError();

  const { data, error } = await supabase.functions.invoke<InvokeResponse<T>>('ai-task-assistant', {
    body: {
      action,
      payload: {
        ...payload,
        ...getClientDateContext(),
      },
    },
  });

  if (error) {
    if ('context' in error && typeof error.context === 'object' && error.context) {
      const response = error.context as { status?: number; json?: () => Promise<InvokeResponse<T>> };
      if (response.status === 401) throw new AIAssistAuthRequiredError();

      try {
        const body = await response.json?.();
        if (body?.error) return Promise.reject(new Error(body.error));
      } catch (parseError) {
        throw new Error(getFunctionErrorMessage(parseError));
      }
    }

    throw new Error(error.message);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  if (!data || typeof data.data === 'undefined') {
    throw new Error('AI Assist returned an empty response.');
  }

  return data.data;
}

/**
 * Parse natural language input into structured task data.
 */
export async function parseNaturalLanguageTask(input: string): Promise<ParsedTask> {
  return invokeAIAssistant<ParsedTask>('parseNaturalLanguageTask', { input });
}

/**
 * Break down a complex task into subtasks.
 */
export async function breakDownTask(taskText: string): Promise<TaskBreakdown> {
  return invokeAIAssistant<TaskBreakdown>('breakDownTask', { taskText });
}

/**
 * Get AI suggestions for prioritizing tasks.
 */
export async function getPrioritizationSuggestions(
  tasks: Array<{
    id: number;
    text: string;
    priority?: 'high' | 'medium' | 'low';
    dueDate?: string;
    dueTime?: string;
    category?: string;
    timeSpent?: number;
  }>
): Promise<PrioritizationSuggestion[]> {
  return invokeAIAssistant<PrioritizationSuggestion[]>('getPrioritizationSuggestions', { tasks });
}

/**
 * Generate a quick task suggestion based on context.
 */
export async function getQuickTaskSuggestion(context: {
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  completedToday: number;
  remainingTasks: number;
}): Promise<string> {
  return invokeAIAssistant<string>('getQuickTaskSuggestion', { context });
}
