import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'zentask:pomodoro_history';

// Stored as { [YYYY-MM-DD]: number }
type SessionHistory = Record<string, number>;

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

async function getHistory(): Promise<SessionHistory> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

async function saveHistory(history: SessionHistory): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(history));
}

export async function getTodaySessions(): Promise<number> {
  const history = await getHistory();
  return history[todayStr()] ?? 0;
}

export async function incrementSessions(): Promise<number> {
  const history = await getHistory();
  const today = todayStr();
  const next = (history[today] ?? 0) + 1;
  history[today] = next;
  await saveHistory(history);
  return next;
}

export async function getSessionHistory(): Promise<SessionHistory> {
  return getHistory();
}

/** Returns count for each of the last N days, oldest first */
export async function getLastNDays(n: number): Promise<{ date: string; count: number }[]> {
  const history = await getHistory();
  const result: { date: string; count: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    result.push({ date: dateStr, count: history[dateStr] ?? 0 });
  }
  return result;
}
