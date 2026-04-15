import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Task } from '../types';

// How notifications behave when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Task Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Schedule a local notification for a task reminder.
 * Returns the notification identifier (to cancel later), or null if not schedulable.
 */
export async function scheduleTaskReminder(task: Task): Promise<string | null> {
  if (!task.reminderMinutes || !task.dueDate) return null;

  // Build the due date/time
  const [year, month, day] = task.dueDate.split('-').map(Number);
  const dueDateTime = new Date(year, month - 1, day);

  if (task.dueTime) {
    const [h, m] = task.dueTime.split(':').map(Number);
    dueDateTime.setHours(h, m, 0, 0);
  } else {
    // No specific time — remind at start of day (9 AM)
    dueDateTime.setHours(9, 0, 0, 0);
  }

  const reminderTime = new Date(dueDateTime.getTime() - task.reminderMinutes * 60 * 1000);

  // Don't schedule if the reminder time is in the past
  if (reminderTime <= new Date()) return null;

  const granted = await requestNotificationPermission();
  if (!granted) return null;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '📝 Task Reminder',
        body: `${task.text}${task.dueTime ? ` — due at ${formatTime(task.dueTime)}` : ' — due today'}`,
        data: { taskId: task.id },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderTime,
      },
    });
    return id;
  } catch (e) {
    console.warn('Failed to schedule notification:', e);
    return null;
  }
}

/** Cancel a previously scheduled notification */
export async function cancelTaskReminder(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (e) {
    console.warn('Failed to cancel notification:', e);
  }
}

/** Cancel all scheduled notifications (e.g. on sign-out) */
export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const h12 = h % 12 || 12;
  const p = h >= 12 ? 'PM' : 'AM';
  return `${h12}:${String(m).padStart(2, '0')} ${p}`;
}
