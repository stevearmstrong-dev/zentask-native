const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_TASK_MODEL = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-6';
const DEFAULT_FAST_MODEL = Deno.env.get('ANTHROPIC_FAST_MODEL') || 'claude-haiku-4-5';
const DEFAULT_MODEL_FALLBACKS = [
  'claude-sonnet-4-20250514',
  'claude-3-7-sonnet-latest',
  'claude-3-5-sonnet-latest',
];
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const MAX_INPUT_CHARS = 2_000;
const MAX_TASKS = 50;

type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type ParsedTask = {
  text: string;
  dueDate?: string;
  dueTime?: string;
  priority?: 'high' | 'medium' | 'low';
  category?: string;
  reminderMinutes?: number;
  recurrence?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
};

type RequestBody = {
  action?: string;
  payload?: Record<string, unknown>;
};

class AnthropicAPIError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AnthropicAPIError';
    this.status = status;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  const match = authHeader?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  const [, payload] = token.split('.');
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function requireAuthenticatedUser(request: Request): void {
  const token = getBearerToken(request);
  const payload = token ? parseJwtPayload(token) : null;

  if (payload?.role !== 'authenticated') {
    throw new Response(JSON.stringify({ error: 'Sign in to use AI Assist.' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
}

function getAnthropicFallbackModels(primaryModel: string): string[] {
  const envFallbacks: string[] | undefined = Deno.env.get('ANTHROPIC_FALLBACK_MODELS')
    ?.split(',')
    .map((model: string) => model.trim())
    .filter(Boolean);

  return Array.from(new Set<string>([...(envFallbacks?.length ? envFallbacks : DEFAULT_MODEL_FALLBACKS)]))
    .filter(model => model !== primaryModel);
}

async function callAnthropicAPI(
  messages: AnthropicMessage[],
  model: string,
  maxTokens: number
): Promise<string> {
  const modelsToTry = [model, ...getAnthropicFallbackModels(model)];
  let lastError: unknown;

  for (const modelToTry of modelsToTry) {
    try {
      return await callAnthropicModel(messages, modelToTry, maxTokens);
    } catch (error) {
      lastError = error;
      if (!(error instanceof AnthropicAPIError) || error.status !== 404) {
        throw error;
      }
    }
  }

  throw lastError;
}

async function callAnthropicModel(
  messages: AnthropicMessage[],
  model: string,
  maxTokens: number
): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured.');

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new AnthropicAPIError(response.status, `Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.content?.[0];

  if (content?.type !== 'text' || typeof content.text !== 'string') {
    throw new Error('Unexpected response type from Claude.');
  }

  return content.text;
}

function parseJsonObject<T>(responseText: string): T {
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse JSON object from Claude response.');
  return JSON.parse(jsonMatch[0]);
}

function parseJsonArray<T>(responseText: string): T {
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Could not parse JSON array from Claude response.');
  return JSON.parse(jsonMatch[0]);
}

function normalizeParsedTask(parsed: Partial<ParsedTask>, originalInput: string): ParsedTask {
  const validPriorities = new Set(['high', 'medium', 'low']);
  const validRecurrences = new Set(['daily', 'weekly', 'biweekly', 'monthly', 'yearly']);
  const reminder = Number(parsed.reminderMinutes);

  return {
    text: typeof parsed.text === 'string' && parsed.text.trim() ? parsed.text.trim() : originalInput,
    dueDate: typeof parsed.dueDate === 'string' ? parsed.dueDate : undefined,
    dueTime: typeof parsed.dueTime === 'string' ? parsed.dueTime : undefined,
    priority: typeof parsed.priority === 'string' && validPriorities.has(parsed.priority) ? parsed.priority : undefined,
    category: typeof parsed.category === 'string' ? parsed.category : undefined,
    reminderMinutes: Number.isFinite(reminder) && reminder > 0 ? reminder : undefined,
    recurrence: typeof parsed.recurrence === 'string' && validRecurrences.has(parsed.recurrence)
      ? parsed.recurrence
      : undefined,
  };
}

function getString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${key} is required.`);
  }

  const trimmed = value.trim();
  if (trimmed.length > MAX_INPUT_CHARS) {
    throw new Error(`${key} must be ${MAX_INPUT_CHARS} characters or less.`);
  }

  return trimmed;
}

function getOptionalString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

async function parseNaturalLanguageTask(payload: Record<string, unknown>): Promise<ParsedTask> {
  const input = getString(payload, 'input');
  const todayStr = getOptionalString(payload, 'clientDate') || new Date().toISOString().split('T')[0];
  const currentTime = getOptionalString(payload, 'clientTime') || new Date().toISOString().split('T')[1]?.slice(0, 5) || '';
  const timeZone = getOptionalString(payload, 'clientTimeZone') || 'local time';

  const responseText = await callAnthropicAPI(
    [
      {
        role: 'user',
        content: `You are a task parsing assistant. Parse the following natural language input into structured task data.

Today's local date: ${todayStr}
Current local time: ${currentTime}
User time zone: ${timeZone}

Interpret relative dates like "today", "tomorrow", "Friday", and "next week" from the user's local date and time above, not from server UTC time.

Input: "${input}"

Extract and return ONLY a JSON object with these fields (use null if not mentioned):
{
  "text": "cleaned task description",
  "dueDate": "YYYY-MM-DD or null",
  "dueTime": "HH:MM in 24-hour format or null",
  "priority": "high/medium/low or null",
  "category": "category name or null",
  "reminderMinutes": "number (5, 15, 30, 60, 1440) or null",
  "recurrence": "daily/weekly/biweekly/monthly/yearly or null"
}

Examples:
- "Call dentist tomorrow at 2pm" -> {"text":"Call dentist","dueDate":"[tomorrow's date]","dueTime":"14:00","priority":null,"category":null,"reminderMinutes":null,"recurrence":null}
- "High priority: finish project report by Friday" -> {"text":"Finish project report","dueDate":"[next Friday]","dueTime":null,"priority":"high","category":null,"reminderMinutes":null,"recurrence":null}
- "Daily workout at 7am, remind me 15 min before" -> {"text":"Workout","dueDate":"${todayStr}","dueTime":"07:00","priority":null,"category":"Health","reminderMinutes":15,"recurrence":"daily"}

Return ONLY the JSON object, no other text.`,
      },
    ],
    DEFAULT_TASK_MODEL,
    1024
  );

  return normalizeParsedTask(parseJsonObject<Partial<ParsedTask>>(responseText), input);
}

async function breakDownTask(payload: Record<string, unknown>) {
  const taskText = getString(payload, 'taskText');
  const responseText = await callAnthropicAPI(
    [
      {
        role: 'user',
        content: `You are a task breakdown assistant. Break down the following task into actionable subtasks.

Task: "${taskText}"

Provide a JSON object with:
{
  "mainTask": "cleaned version of the main task",
  "subtasks": [
    {"text": "subtask description", "estimatedMinutes": number, "priority": "high/medium/low"}
  ],
  "totalEstimatedTime": total_minutes_number
}

Guidelines:
- Create 3-7 subtasks unless the task is very simple
- Make subtasks specific and actionable
- Estimate time realistically
- Assign priority based on dependencies and importance
- Order subtasks logically

Return ONLY the JSON object, no other text.`,
      },
    ],
    DEFAULT_TASK_MODEL,
    2048
  );

  return parseJsonObject(responseText);
}

async function getPrioritizationSuggestions(payload: Record<string, unknown>) {
  const tasks = Array.isArray(payload.tasks) ? payload.tasks.slice(0, MAX_TASKS) : [];
  const today = getOptionalString(payload, 'clientDate') || new Date().toISOString().split('T')[0];
  const taskLines = tasks.map((task, index) => {
    const t = task as Record<string, unknown>;
    return `${index + 1}. [ID: ${String(t.id)}] ${String(t.text)}
   Priority: ${String(t.priority || 'none')} | Due: ${String(t.dueDate || 'no date')} ${String(t.dueTime || '')}
   Category: ${String(t.category || 'none')} | Time spent: ${typeof t.timeSpent === 'number' ? `${Math.round(t.timeSpent / 60)}min` : '0min'}`;
  }).join('\n\n');

  const responseText = await callAnthropicAPI(
    [
      {
        role: 'user',
        content: `You are a productivity advisor. Analyze these tasks and suggest the optimal order to tackle them today.

Today's date: ${today}

Tasks:
${taskLines}

Provide prioritization suggestions as a JSON array:
[
  {
    "taskId": number,
    "reasoning": "brief explanation why this task should be prioritized",
    "suggestedOrder": number,
    "focusScore": number
  }
]

Consider urgent deadlines, task priority, time invested, dependencies, and energy levels.

Return ONLY the JSON array, no other text.`,
      },
    ],
    DEFAULT_TASK_MODEL,
    2048
  );

  return parseJsonArray(responseText);
}

async function getQuickTaskSuggestion(payload: Record<string, unknown>): Promise<string> {
  const context = payload.context as Record<string, unknown> | undefined;
  if (!context) throw new Error('context is required.');

  const responseText = await callAnthropicAPI(
    [
      {
        role: 'user',
        content: `You are a motivational productivity coach. Give a brief, encouraging suggestion.

Context:
- Time: ${String(context.timeOfDay)}
- Completed today: ${String(context.completedToday)} tasks
- Remaining: ${String(context.remainingTasks)} tasks

Provide a single short sentence, max 15 words.

Return ONLY the suggestion text, nothing else.`,
      },
    ],
    DEFAULT_FAST_MODEL,
    256
  );

  return responseText.trim();
}

Deno.serve(async (request: Request) => {
  try {
    if (request.method === 'OPTIONS') {
      return new Response('ok', { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed.' }, 405);
    }

    requireAuthenticatedUser(request);

    const body = await request.json() as RequestBody;
    const payload = body.payload || {};
    let data: unknown;

    switch (body.action) {
      case 'parseNaturalLanguageTask':
        data = await parseNaturalLanguageTask(payload);
        break;
      case 'breakDownTask':
        data = await breakDownTask(payload);
        break;
      case 'getPrioritizationSuggestions':
        data = await getPrioritizationSuggestions(payload);
        break;
      case 'getQuickTaskSuggestion':
        data = await getQuickTaskSuggestion(payload);
        break;
      default:
        return jsonResponse({ error: 'Unsupported AI Assist action.' }, 400);
    }

    return jsonResponse({ data });
  } catch (error) {
    if (error instanceof Response) return error;

    console.error('AI Task Assistant error:', error);
    const message = error instanceof Error ? error.message : 'AI Assist failed.';
    return jsonResponse({ error: message }, 500);
  }
});
