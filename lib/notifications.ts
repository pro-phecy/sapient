import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';

export type ReminderClass = {
  id: string;
  course: string;
  day: string;
  start: string;
  location?: string;
};

export type ReminderSession = {
  id: string;
  course: string;
  day: string;
  time: string;
};

export type ReminderSettings = {
  classes: ReminderClass[];
  sessions: ReminderSession[];
  classReminders: boolean;
  studyReminders: boolean;
};

export const remotePushEnabled = process.env.EXPO_PUBLIC_REMOTE_PUSH === 'true';

function easProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId
    ?? Constants.easConfig?.projectId
    ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    ?? undefined;
}

export async function registerRemotePushDevice(userId: string): Promise<string | null> {
  if (!remotePushEnabled || !supabase || !Device.isDevice || Platform.OS === 'web') return null;
  const projectId = easProjectId();
  if (!projectId) return null;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const { error } = await supabase.from('push_devices').upsert({
    user_id: userId,
    expo_push_token: token,
    platform: Platform.OS,
    time_zone: timeZone,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'expo_push_token' });
  if (error) throw error;
  return token;
}

export async function removeRemotePushDevice(userId: string, token: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('push_devices').delete().eq('user_id', userId).eq('expo_push_token', token);
  if (error) throw error;
}

const DAY_TO_EXPO_WEEKDAY: Record<string, number> = {
  Sun: 1,
  Mon: 2,
  Tue: 3,
  Wed: 4,
  Thu: 5,
  Fri: 6,
  Sat: 7,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  let permission = await Notifications.getPermissionsAsync();
  const alreadyAllowed = permission.granted
    || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!alreadyAllowed && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
  }

  const allowed = permission.granted
    || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (allowed) await configureNotificationChannels();
  return allowed;
}

export async function configureNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('class-reminders', {
    name: 'Class reminders',
    description: 'A heads-up before your scheduled classes.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 220, 120, 220],
    lightColor: '#63D6A3',
  });
  await Notifications.setNotificationChannelAsync('study-reminders', {
    name: 'Study reminders',
    description: 'A heads-up before your planned study sessions.',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180],
    lightColor: '#63D6A3',
  });
}

export async function clearSapientReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const ownReminders = scheduled.filter((item) => item.content.data?.sapientReminder === true);
  await Promise.all(ownReminders.map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
}

function parseTime(value: string): { hour: number; minute: number } | null {
  const twentyFourHour = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1]);
    const minute = Number(twentyFourHour[2]);
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? { hour, minute } : null;
  }

  const twelveHour = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value.trim());
  if (!twelveHour) return null;
  const rawHour = Number(twelveHour[1]);
  const minute = Number(twelveHour[2]);
  if (rawHour < 1 || rawHour > 12 || minute < 0 || minute > 59) return null;
  const hour = (rawHour % 12) + (twelveHour[3].toUpperCase() === 'PM' ? 12 : 0);
  return { hour, minute };
}

function reminderTime(day: string, time: string, minutesBefore: number) {
  const weekday = DAY_TO_EXPO_WEEKDAY[day.slice(0, 3)];
  const parsed = parseTime(time);
  if (weekday === undefined || !parsed) return null;

  const totalMinutes = parsed.hour * 60 + parsed.minute - minutesBefore;
  const weekdayShift = Math.floor(totalMinutes / (24 * 60));
  const normalizedMinutes = (totalMinutes + 24 * 60) % (24 * 60);
  const adjustedWeekday = ((weekday - 1 + weekdayShift + 7) % 7) + 1;
  return { weekday: adjustedWeekday, hour: Math.floor(normalizedMinutes / 60), minute: normalizedMinutes % 60 };
}

export async function scheduleSapientReminders(settings: ReminderSettings): Promise<number> {
  await clearSapientReminders();
  if (Platform.OS === 'web') return 0;

  const permission = await Notifications.getPermissionsAsync();
  const allowed = permission.granted
    || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!allowed) return 0;
  await configureNotificationChannels();

  const requests: Notifications.NotificationRequestInput[] = [];
  if (settings.classReminders) {
    for (const item of settings.classes) {
      const time = reminderTime(item.day, item.start, 15);
      if (!time) continue;
      const place = item.location?.trim() ? ` · ${item.location.trim()}` : '';
      requests.push({
        content: {
          title: 'Class starts in 15 minutes',
          body: `${item.course}${place}`,
          sound: 'default',
          data: { sapientReminder: true, destination: 'timetable', classId: item.id },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, ...time, channelId: 'class-reminders' },
      });
    }
  }

  if (settings.studyReminders) {
    for (const item of settings.sessions) {
      const time = reminderTime(item.day, item.time, 10);
      if (!time) continue;
      requests.push({
        content: {
          title: 'Study session in 10 minutes',
          body: `Get ready for ${item.course}.`,
          sound: 'default',
          data: { sapientReminder: true, destination: 'study', sessionId: item.id },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, ...time, channelId: 'study-reminders' },
      });
    }
  }

  // Keep below iOS's pending-notification limit, leaving room for system notifications.
  const scheduled = requests.slice(0, 60);
  await Promise.all(scheduled.map((request) => Notifications.scheduleNotificationAsync(request)));
  return scheduled.length;
}
