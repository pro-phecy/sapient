import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

async function sessionFilePath() {
  const FileSystem = await import('expo-file-system/legacy');
  const directory = FileSystem.documentDirectory;
  if (!directory) throw new Error('Private app storage is unavailable.');
  return `${directory}slyde-supabase-session.json`;
}

const sessionStorage = {
  async getItem(key: string) {
    if (Platform.OS === 'web') return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
    const FileSystem = await import('expo-file-system/legacy');
    const path = await sessionFilePath();
    const info = await FileSystem.getInfoAsync(path);
    return info.exists ? FileSystem.readAsStringAsync(path) : null;
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
      return;
    }
    const FileSystem = await import('expo-file-system/legacy');
    await FileSystem.writeAsStringAsync(await sessionFilePath(), value, { encoding: FileSystem.EncodingType.UTF8 });
  },
  async removeItem(key: string) {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
      return;
    }
    const FileSystem = await import('expo-file-system/legacy');
    await FileSystem.deleteAsync(await sessionFilePath(), { idempotent: true });
  },
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        storage: sessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
