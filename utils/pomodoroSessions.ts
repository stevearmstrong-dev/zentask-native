import AsyncStorage from '@react-native-async-storage/async-storage';

// Stored as { [YYYY-MM-DD]: number }
type SessionHistory = Record<string, number>;

function getKey(userEmail?: string): string {
  const ns = userEmail || 'guest';
  return `zentask:pomodoro_history:${ns}`;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

async function getHistory(userEmail?: string): Promise<SessionHistory> {
  try {
    const raw = await AsyncStorage.getItem(getKey(userEmail));
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

async function saveHistory(history: SessionHistory, userEmail?: string): Promise<void> {
  await AsyncStorage.setItem(getKey(userEmail), JSON.stringify(history));
}

export async function getTodaySessions(userEmail?: string): Promise<number> {
  const history = await getHistory(userEmail);
  return history[todayStr()] ?? 0;
}

export async function incrementSessions(userEmail?: string): Promise<number> {
  const history = await getHistory(userEmail);
  const today = todayStr();
  const next = (history[today] ?? 0) + 1;
  history[today] = next;
  await saveHistory(history, userEmail);
  return next;
}

export async function getSessionHistory(userEmail?: string): Promise<SessionHistory> {
  return getHistory(userEmail);
}

/** Returns count for each of the last N days, oldest first */
export async function getLastNDays(n: number, userEmail?: string): Promise<{ date: string; count: number }[]> {
  const history = await getHistory(userEmail);
  const result: { date: string; count: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    result.push({ date: dateStr, count: history[dateStr] ?? 0 });
  }
  return result;
}
