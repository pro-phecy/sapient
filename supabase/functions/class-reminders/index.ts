import { createClient } from 'npm:@supabase/supabase-js@2';

type DeviceRow = {
  id: string;
  user_id: string;
  expo_push_token: string;
  time_zone: string;
};

type ClassRow = {
  id: string;
  user_id: string;
  course_name: string;
  day: string;
  start_time: string;
  location: string;
};

type StudySession = {
  id?: string;
  course?: string;
  day?: string;
  time?: string;
};

type Message = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  channelId: string;
  data: { destination: 'timetable' | 'study'; reminderType: 'class' | 'study' };
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const cronSecret = Deno.env.get('PUSH_CRON_SECRET');

function localParts(date: Date, timeZone: string) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).map(({ type, value }) => [type, value]));
  return {
    day: values.weekday,
    time: `${values.hour}:${values.minute}`,
    date: `${values.year}-${values.month}-${values.day}`,
  };
}

function parseStudyTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  return `${String((hour % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0)).padStart(2, '0')}:${match[2]}`;
}

async function reserveDelivery(admin: ReturnType<typeof createClient>, deviceId: string, type: 'class' | 'study', referenceId: string, date: string) {
  const { data, error } = await admin.from('push_reminder_deliveries').insert({
    device_id: deviceId,
    reminder_type: type,
    reference_id: referenceId,
    local_date: date,
  }).select('id').single();
  if (error?.code === '23505') return null;
  if (error) throw error;
  return data.id as string;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!supabaseUrl || !serviceRoleKey || !cronSecret) return Response.json({ error: 'Server notification secrets are missing.' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profiles, error: profilesError } = await admin.from('profiles')
    .select('id, class_reminders_enabled, study_reminders_enabled, study_plan')
    .or('class_reminders_enabled.eq.true,study_reminders_enabled.eq.true');
  if (profilesError) return Response.json({ error: profilesError.message }, { status: 500 });
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const userIds = [...profileById.keys()];
  if (!userIds.length) return Response.json({ sent: 0 });

  const [{ data: devices, error: deviceError }, { data: classes, error: classError }] = await Promise.all([
    admin.from('push_devices').select('id, user_id, expo_push_token, time_zone').in('user_id', userIds),
    admin.from('classes').select('id, user_id, course_name, day, start_time, location').in('user_id', userIds),
  ]);
  if (deviceError || classError) return Response.json({ error: deviceError?.message ?? classError?.message }, { status: 500 });

  const classesByUser = new Map<string, ClassRow[]>();
  for (const item of (classes ?? []) as ClassRow[]) classesByUser.set(item.user_id, [...(classesByUser.get(item.user_id) ?? []), item]);
  const sendable: { message: Message; deliveryId: string; deviceId: string }[] = [];

  try {
    for (const device of (devices ?? []) as DeviceRow[]) {
      const profile = profileById.get(device.user_id);
      if (!profile) continue;
      const zone = device.time_zone || 'UTC';
      const classTarget = localParts(new Date(Date.now() + 15 * 60 * 1000), zone);
      if (profile.class_reminders_enabled) {
        for (const item of classesByUser.get(device.user_id) ?? []) {
          if (item.day !== classTarget.day || String(item.start_time).slice(0, 5) !== classTarget.time) continue;
          const deliveryId = await reserveDelivery(admin, device.id, 'class', item.id, classTarget.date);
          if (!deliveryId) continue;
          const location = item.location?.trim() ? ` · ${item.location.trim()}` : '';
          sendable.push({
            deviceId: device.id,
            deliveryId,
            message: {
              to: device.expo_push_token,
              title: 'Class starts in 15 minutes',
              body: `${item.course_name}${location}`,
              sound: 'default',
              channelId: 'class-reminders',
              data: { destination: 'timetable', reminderType: 'class' },
            },
          });
        }
      }

      if (profile.study_reminders_enabled && Array.isArray(profile.study_plan)) {
        const studyTarget = localParts(new Date(Date.now() + 10 * 60 * 1000), zone);
        for (const [index, session] of (profile.study_plan as StudySession[]).entries()) {
          if (!session.day || !session.time || !session.course) continue;
          if (session.day.slice(0, 3) !== studyTarget.day || parseStudyTime(session.time) !== studyTarget.time) continue;
          const referenceId = session.id || `${index}:${session.course}:${session.day}:${session.time}`;
          const deliveryId = await reserveDelivery(admin, device.id, 'study', referenceId, studyTarget.date);
          if (!deliveryId) continue;
          sendable.push({
            deviceId: device.id,
            deliveryId,
            message: {
              to: device.expo_push_token,
              title: 'Study session in 10 minutes',
              body: `Get ready for ${session.course}.`,
              sound: 'default',
              channelId: 'study-reminders',
              data: { destination: 'study', reminderType: 'study' },
            },
          });
        }
      }
    }

    let sent = 0;
    for (let offset = 0; offset < sendable.length; offset += 100) {
      const batch = sendable.slice(offset, offset + 100);
      let response: Response;
      try {
        response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(batch.map((item) => item.message)),
        });
      } catch (error) {
        await admin.from('push_reminder_deliveries').delete().in('id', batch.map((item) => item.deliveryId));
        throw error;
      }
      if (!response.ok) {
        await admin.from('push_reminder_deliveries').delete().in('id', batch.map((item) => item.deliveryId));
        throw new Error(`Expo Push Service returned ${response.status}.`);
      }
      const result = await response.json();
      const tickets = result.data ?? [];
      for (const [index, ticket] of tickets.entries()) {
        if (ticket.status === 'ok') {
          sent += 1;
          continue;
        }
        const item = batch[index];
        if (!item) continue;
        await admin.from('push_reminder_deliveries').delete().eq('id', item.deliveryId);
        if (ticket.details?.error === 'DeviceNotRegistered') {
          await admin.from('push_devices').delete().eq('id', item.deviceId);
        }
      }
    }
    return Response.json({ sent, checked: sendable.length });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});
