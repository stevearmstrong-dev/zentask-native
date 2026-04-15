import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'zentask:pomodoro_sessions';

interface SessionLog {
  date: string; // YYYY-MM-DD
  count: number;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export async function getTodaySessions(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return 0;
    const log: SessionLog = JSON.parse(raw);
    return log.date === todayStr() ? log.count : 0;
  } catch { return 0; }
}

export async function incrementSessions(): Promise<number> {
  try {
    const current = await getTodaySessions();
    const next = current + 1;
    await AsyncStorage.setItem(KEY, JSON.stringify({ date: todayStr(), count: next }));
    return next;
  } catch { return 0; }
}
