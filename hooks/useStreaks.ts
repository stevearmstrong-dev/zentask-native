import { useState, useEffect, useCallback } from 'react';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Streaks {
  water: number;
  workout: number;
  nofap: number;
}

function getDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function calcDaysSince(isoDate: string): number {
  const start = new Date(isoDate);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - start.getTime()) / 86400000);
}

export function useStreaks(userEmail: string): Streaks {
  const ns = userEmail || 'guest';
  const [streaks, setStreaks] = useState<Streaks>({ water: 0, workout: 0, nofap: 0 });
  const isFocused = useIsFocused();

  const load = useCallback(async () => {
    const WATER_LOGS_KEY = `zentask:water_logs:${ns}`;
    const WATER_GOAL_KEY = `zentask:water_goal:${ns}`;
    const WORKOUT_HISTORY_KEY = `zentask:workout_history:${ns}`;
    const NOFAP_START_KEY = `zentask:nofap_start:${ns}`;

    const [rawWaterLogs, rawWaterGoal, rawWorkout, rawNofapStart] = await Promise.all([
      AsyncStorage.getItem(WATER_LOGS_KEY),
      AsyncStorage.getItem(WATER_GOAL_KEY),
      AsyncStorage.getItem(WORKOUT_HISTORY_KEY),
      AsyncStorage.getItem(NOFAP_START_KEY),
    ]);

    // Water streak — consecutive days meeting goal
    let waterStreak = 0;
    if (rawWaterLogs) {
      const logs: { amount: number; timestamp: string }[] = JSON.parse(rawWaterLogs);
      const goal = rawWaterGoal ? parseInt(rawWaterGoal) : 2000;
      const today = new Date();
      for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = getDateStr(d);
        const dayTotal = logs
          .filter(l => l.timestamp.startsWith(key))
          .reduce((s, l) => s + l.amount, 0);
        if (dayTotal >= goal) waterStreak++;
        else if (i > 0) break;
      }
    }

    // Workout streak — consecutive days with a log entry
    let workoutStreak = 0;
    if (rawWorkout) {
      const history: { date: string }[] = JSON.parse(rawWorkout);
      // date is stored as full ISO string — normalize to YYYY-MM-DD
      const dates = new Set(history.map(h => h.date.slice(0, 10)));
      const today = new Date();
      for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = getDateStr(d);
        if (dates.has(key)) workoutStreak++;
        else if (i > 0) break;
      }
    }

    // NoFap streak — days since start date
    let nofapStreak = 0;
    if (rawNofapStart) {
      nofapStreak = calcDaysSince(rawNofapStart);
    }

    setStreaks({ water: waterStreak, workout: workoutStreak, nofap: nofapStreak });
  }, [ns]);

  // Re-fetch whenever the Today tab comes back into focus
  useEffect(() => {
    if (isFocused) load().catch(console.error);
  }, [isFocused, load]);

  return streaks;
}
