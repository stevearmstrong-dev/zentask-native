import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'zentask:notification_ids';

type NotifMap = Record<string, string>; // taskId → notificationId

async function getMap(): Promise<NotifMap> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

async function saveMap(map: NotifMap): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(map));
}

export async function getNotificationId(taskId: number): Promise<string | null> {
  const map = await getMap();
  return map[String(taskId)] ?? null;
}

export async function setNotificationId(taskId: number, notifId: string): Promise<void> {
  const map = await getMap();
  map[String(taskId)] = notifId;
  await saveMap(map);
}

export async function removeNotificationId(taskId: number): Promise<void> {
  const map = await getMap();
  delete map[String(taskId)];
  await saveMap(map);
}
