import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as Notifications from 'expo-notifications';
import { createStudentFileUrl, removeStudentFiles, uploadStudentFile } from './lib/storage';
import { clearSapientReminders, requestNotificationPermission, scheduleSapientReminders } from './lib/notifications';
import { isSupabaseConfigured, supabase } from './lib/supabase';

const C = {
  bg: '#071610',
  bg2: '#0b1f17',
  card: '#142b21',
  card2: '#10241b',
  border: '#2a4938',
  text: '#f7f5eb',
  muted: '#b9c8bd',
  quiet: '#86998b',
  accent: '#63d6a3',
  accentStrong: '#24865b',
  teal: '#38d9bd',
  orange: '#f0bd69',
  pink: '#ed8d8f',
  red: '#ff716a',
  green: '#5fce91',
};

type Tab = 'Home' | 'Timetable' | 'Resources' | 'Study';
type Course = { id: string; name: string; workload: 'light' | 'medium' | 'heavy'; color: string };
type ClassItem = { id: string; course: string; courseId?: string | null; day: string; start: string; end: string; location: string; lecturer: string };
type Resource = { id: string; course: string; courseId?: string | null; name: string; size: string; sizeBytes?: number; mimeType?: string; storagePath?: string; kind?: 'resource' | 'timetable' };
type StudySession = { id: string; day: string; time: string; course: string; minutes: number };

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const universities = ['KNUST', 'University of Ghana', 'University of Cape Coast', 'University for Development Studies', 'Other'];
const tourSlides = [
  { icon: '✦', color: C.accent, title: 'Your semester, organised.', body: 'Your classes, courses and study time come together in one calm space.', tip: 'Sapient is yours to shape around the way you learn.' },
  { icon: '▦', color: C.teal, title: 'See your week clearly.', body: 'Add classes to a simple weekly timetable and know what is coming next.', tip: 'Start with one class. You can build the rest as you go.' },
  { icon: '▤', color: C.orange, title: 'Bring every course in.', body: 'Keep your courses together and mark the ones that need extra attention.', tip: 'Set a workload for each course to make your plan more useful.' },
  { icon: '↗', color: C.pink, title: 'Make room for focused study.', body: 'Build a personal study plan around your course list and the time you have.', tip: 'A light, repeatable plan beats a perfect plan you cannot keep.' },
  { icon: '▧', color: C.green, title: 'Keep your resources close.', body: 'Save slides, notes and past questions by course so they are easy to find again.', tip: 'Your uploads stay in your private account.' },
  { icon: '◷', color: C.accent, title: 'Small sessions add up.', body: 'Use the focus timer, keep a streak and see your study time grow week by week.', tip: 'Try 25 minutes of focus, then take a proper break.' },
];

function Brand({ large = false }: { large?: boolean }) {
  return <Text style={[styles.brand, large && styles.brandLarge]}>Sapient<Text style={{ color: C.teal }}>.</Text></Text>;
}

function Stars() {
  const points = [
    { x: '8%', y: '13%', c: C.accent }, { x: '82%', y: '11%', c: C.teal }, { x: '90%', y: '31%', c: C.accent },
    { x: '14%', y: '37%', c: C.teal }, { x: '73%', y: '51%', c: C.accent }, { x: '94%', y: '64%', c: C.teal },
    { x: '6%', y: '75%', c: C.accent }, { x: '28%', y: '89%', c: C.teal }, { x: '63%', y: '91%', c: C.accent },
    { x: '51%', y: '18%', c: C.teal }, { x: '35%', y: '58%', c: C.accent }, { x: '87%', y: '83%', c: C.teal },
  ];
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    {points.map((p, i) => <StarParticle key={i} point={p} index={i} />)}
  </View>;
}

function StarParticle({ point, index }: any) {
  const pulse = useRef(new Animated.Value(0.35)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.delay((index % 6) * 240),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.9, duration: 1200 + (index % 3) * 180, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0.25, duration: 1500 + (index % 4) * 160, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.25, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.8, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ]),
    ]));
    animation.start();
    return () => animation.stop();
  }, [index, pulse, scale]);
  const size = index % 3 === 0 ? 5 : 3;
  return <Animated.View style={{ position: 'absolute', left: point.x as any, top: point.y as any, width: size, height: size, borderRadius: 8, backgroundColor: point.c, opacity: pulse, transform: [{ scale }] }} />;
}

function ScreenEntrance({ children, style }: { children: React.ReactNode; style?: any }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [progress]);
  return <Animated.View style={[{ flex: 1, opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }, { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) }] }, style]}>{children}</Animated.View>;
}

function Reveal({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: any }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.spring(progress, { toValue: 1, tension: 48, friction: 9, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [delay, progress]);
  return <Animated.View style={[{ opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }, style]}>{children}</Animated.View>;
}

function ProgressBar({ value, color = C.teal }: { value: number; color?: string }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: Math.max(0, Math.min(100, value)), duration: 720, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [progress, value]);
  return <View style={styles.progressTrack}><Animated.View style={[styles.progressFill, { backgroundColor: color, width: progress.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} /></View>;
}

function TabButton({ item, icon, active, onPress }: { item: Tab; icon: string; active: boolean; onPress: () => void }) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    const animation = Animated.spring(progress, { toValue: active ? 1 : 0, speed: 20, bounciness: 3, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [active, progress]);
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.tabItem, pressed && { transform: [{ scale: 0.95 }] }]}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.tabItemActiveFill, { opacity: progress, transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]} />
    <Text style={[styles.tabIcon, item === 'Study' && styles.studyTabIcon, active && { color: C.text }]}>{icon}</Text><Text style={[styles.tabLabel, active && { color: C.text }]}>{item}</Text>
  </Pressable>;
}

function Button({ title, onPress, secondary = false, disabled = false, style }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean; style?: any }) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = (toValue: number) => Animated.spring(scale, { toValue, speed: 26, bounciness: 5, useNativeDriver: true }).start();
  return <Animated.View style={[style, { transform: [{ scale }] }]}>
    <Pressable onPress={onPress} disabled={disabled} onPressIn={() => press(0.975)} onPressOut={() => press(1)} accessibilityRole="button" style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, disabled && { opacity: 0.48 }, pressed && !disabled && { opacity: 0.92 }]}>
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{title}</Text>
    </Pressable>
  </Animated.View>;
}

function Pill({ title, color = C.accent }: { title: string; color?: string }) {
  return <View style={[styles.pill, { borderColor: `${color}66`, backgroundColor: `${color}20` }]}><Text style={[styles.pillText, { color }]}>{title}</Text></View>;
}

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

function dateForInput(value: string | null | undefined) {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function dateForDatabase(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(?:(\d{2})\/(\d{2})\/(\d{4})|(\d{4})-(\d{2})-(\d{2}))$/.exec(trimmed);
  if (!match) return undefined;
  const year = Number(match[3] ?? match[4]);
  const month = Number(match[2] ?? match[5]);
  const day = Number(match[1] ?? match[6]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function Field({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, multiline = false, onPress, right }: any) {
  const [focused, setFocused] = useState(false);
  return <View style={{ marginBottom: 16 }}>
    {label ? <Label>{label}</Label> : null}
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.field, focused && styles.fieldFocused, multiline && { minHeight: 96, alignItems: 'flex-start' }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.quiet}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        editable={!onPress}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, multiline && { minHeight: 76, textAlignVertical: 'top' }]}
      />
      {right ? (typeof right === 'string' ? <Text style={styles.fieldRight}>{right}</Text> : right) : null}
    </Pressable>
  </View>;
}

function PasswordToggle({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  return <Pressable
    onPress={onPress}
    style={styles.passwordToggle}
    accessibilityRole="button"
    accessibilityLabel={visible ? 'Hide password' : 'Show password'}
    accessibilityState={{ selected: visible }}
  >
    <View style={styles.eyeShape}><View style={styles.eyeIris} /></View>
    {!visible ? <View pointerEvents="none" style={styles.eyeSlash} /> : null}
  </Pressable>;
}

function UniversityChevron() {
  return <View style={styles.dropdownChevron} accessibilityElementsHidden>
    <View style={[styles.dropdownChevronLine, styles.dropdownChevronLeft]} />
    <View style={[styles.dropdownChevronLine, styles.dropdownChevronRight]} />
  </View>;
}

function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return <View style={styles.emptyState}>
    <View style={styles.emptyIcon}><Text style={{ fontSize: 25, color: C.quiet }}>{icon}</Text></View>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyBody}>{body}</Text>
  </View>;
}

export default function App() {
  const [flow, setFlow] = useState<'welcome' | 'signup' | 'login' | 'verify' | 'tour' | 'app' | 'settings' | 'profile'>('welcome');
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileReturn, setProfileReturn] = useState<'app' | 'settings'>('app');
  const [tourIndex, setTourIndex] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [university, setUniversity] = useState('KNUST');
  const [courseOfStudy, setCourseOfStudy] = useState('');
  const [semester, setSemester] = useState('');
  const [semesterStart, setSemesterStart] = useState('');
  const [semesterEnd, setSemesterEnd] = useState('');
  const [universityPicker, setUniversityPicker] = useState(false);
  const [tab, setTab] = useState<Tab>('Home');
  const [courses, setCourses] = useState<Course[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [timetableFile, setTimetableFile] = useState('');
  const [timetablePath, setTimetablePath] = useState('');
  const [timetableResourceId, setTimetableResourceId] = useState('');
  const [setupDone, setSetupDone] = useState(false);
  const [notifyClasses, setNotifyClasses] = useState(false);
  const [notifyStudy, setNotifyStudy] = useState(false);

  const loadCloudWorkspace = async (id: string) => {
    if (!supabase) return;
    const [profileResult, courseResult, classResult, resourceResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('courses').select('*').order('created_at', { ascending: true }),
      supabase.from('classes').select('*').order('start_time', { ascending: true }),
      supabase.from('resources').select('*').order('created_at', { ascending: false }),
    ]);
    const failure = profileResult.error ?? courseResult.error ?? classResult.error ?? resourceResult.error;
    if (failure) throw failure;
    const profile = profileResult.data;
    if (profile) {
      setName(profile.full_name || 'Student');
      setUniversity(profile.university || '');
      setCourseOfStudy(profile.course_of_study || '');
      setSemester(profile.semester || '');
      setSemesterStart(dateForInput(profile.semester_start));
      setSemesterEnd(dateForInput(profile.semester_end));
      setNotifyClasses(profile.class_reminders_enabled === true);
      setNotifyStudy(profile.study_reminders_enabled === true);
      setSessions(Array.isArray(profile.study_plan) ? profile.study_plan as StudySession[] : []);
    }
    const cloudCourses = (courseResult.data ?? []).map((row: any) => ({ id: row.id, name: row.name, workload: row.workload, color: row.color } as Course));
    setCourses(cloudCourses);
    setClasses((classResult.data ?? []).map((row: any) => ({
      id: row.id, courseId: row.course_id, course: row.course_name, day: row.day,
      start: String(row.start_time).slice(0, 5), end: String(row.end_time).slice(0, 5),
      location: row.location, lecturer: row.lecturer,
    } as ClassItem)));
    const rows = resourceResult.data ?? [];
    setResources(rows.filter((row: any) => row.file_kind === 'resource').map((row: any) => ({
      id: row.id, courseId: row.course_id, course: row.course_name ?? '', name: row.file_name,
      size: row.size_bytes ? `${Math.max(1, Math.round(Number(row.size_bytes) / 1024))} KB` : 'Added',
      sizeBytes: row.size_bytes ?? undefined, mimeType: row.mime_type, storagePath: row.storage_path, kind: 'resource',
    } as Resource)));
    const timetable = rows.find((row: any) => row.file_kind === 'timetable');
    setTimetableFile(timetable?.file_name ?? '');
    setTimetablePath(timetable?.storage_path ?? '');
    setTimetableResourceId(timetable?.id ?? '');
  };

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      // Token rotation updates credentials, not the visible account. Avoid
      // needlessly touching React state while Supabase refreshes in background.
      if (event === 'TOKEN_REFRESHED') return;
      if (session?.user) {
        setUserId(session.user.id);
        setEmail(session.user.email ?? '');
        setName(String(session.user.user_metadata?.full_name ?? 'Student'));
      } else if (event === 'SIGNED_OUT') {
        setUserId(null);
      }
    });
    void (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error) Alert.alert('Session error', error.message);
        const user = data.session?.user;
        if (user) {
          setUserId(user.id);
          setEmail(user.email ?? '');
          setFlow('app');
          try { await loadCloudWorkspace(user.id); }
          catch (loadError) { Alert.alert('Could not load your Sapient data', String(loadError)); }
        }
      } catch (error) {
        if (mounted) Alert.alert('Session error', String(error));
      } finally {
        if (mounted) setAuthReady(true);
      }
    })();
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!authReady) return;
    let active = true;
    void (async () => {
      try {
        if (!userId) {
          await clearSapientReminders();
          return;
        }
        await scheduleSapientReminders({
          classes,
          sessions,
          classReminders: notifyClasses,
          studyReminders: notifyStudy,
        });
      } catch (error) {
        if (active) console.warn('Could not update scheduled reminders', error);
      }
    })();
    return () => { active = false; };
  }, [authReady, userId, classes, sessions, notifyClasses, notifyStudy]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const destination = response.notification.request.content.data?.destination;
      setTab(destination === 'study' ? 'Study' : 'Timetable');
      setFlow('app');
    });
    return () => subscription.remove();
  }, []);

  const updateSessions = async (nextPlan: StudySession[]) => {
    setSessions(nextPlan);
    if (supabase && userId) {
      const { error } = await supabase.from('profiles').update({ study_plan: nextPlan }).eq('id', userId);
      if (error) Alert.alert('Could not save study plan', error.message);
    }
  };

  const updateNotificationPreference = async (kind: 'classes' | 'study', enabled: boolean) => {
    if (enabled) {
      try {
        const granted = await requestNotificationPermission();
        if (!granted) {
          Alert.alert('Notifications are off', 'Allow notifications in your device settings to turn this reminder on.', [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open settings', onPress: () => { void Linking.openSettings(); } },
          ]);
          return;
        }
      } catch (error) {
        Alert.alert('Could not enable notifications', String(error));
        return;
      }
    }

    const setter = kind === 'classes' ? setNotifyClasses : setNotifyStudy;
    const previousValue = kind === 'classes' ? notifyClasses : notifyStudy;
    setter(enabled);
    if (supabase && userId) {
      const column = kind === 'classes' ? 'class_reminders_enabled' : 'study_reminders_enabled';
      const { error } = await supabase.from('profiles').update({ [column]: enabled }).eq('id', userId);
      if (error) {
        setter(previousValue);
        Alert.alert('Could not save notification setting', error.message);
      }
    }
  };

  const finishSignup = async (password: string) => {
    if (!name.trim() || !email.trim() || email.indexOf('@') < 1) {
      Alert.alert('Check your details', 'Enter your name and a valid email address to continue.');
      return;
    }
    if (!supabase) {
      Alert.alert('Connect Supabase first', 'Add your Supabase project URL and publishable key to the app .env file before creating an account.');
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(), password,
      options: { data: { full_name: name.trim(), university } },
    });
    if (error) { Alert.alert('Could not create your account', error.message); return; }
    setEmail(email.trim().toLowerCase());
    if (data.session?.user) {
      setUserId(data.session.user.id);
      try { await loadCloudWorkspace(data.session.user.id); }
      catch (loadError) { Alert.alert('Account created, but data did not load', String(loadError)); }
      setTourIndex(0); setFlow('tour');
    } else {
      setFlow('verify');
    }
  };

  const verifyEmail = async (token: string) => {
    if (!supabase) return;
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: 'signup' });
    if (error) { Alert.alert('Could not verify your email', error.message); return; }
    if (data.user) {
      setUserId(data.user.id);
      try { await loadCloudWorkspace(data.user.id); }
      catch (loadError) { Alert.alert('Account verified, but data did not load', String(loadError)); }
    }
    setTourIndex(0); setFlow('tour');
  };

  const resendSignupCode = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() });
    if (error) Alert.alert('Could not resend code', error.message);
    else Alert.alert('Code sent', `A new code was sent to ${email}.`);
  };

  const signIn = async (loginEmail: string, password: string) => {
    if (!supabase) { Alert.alert('Connect Supabase first', 'Add your project URL and publishable key to the app .env file.'); return; }
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail.trim().toLowerCase(), password });
    if (error) { Alert.alert('Could not sign in', error.message); return; }
    if (data.user) {
      setUserId(data.user.id); setEmail(data.user.email ?? '');
      try { await loadCloudWorkspace(data.user.id); }
      catch (loadError) { Alert.alert('Signed in, but data did not load', String(loadError)); }
      setTab('Home'); setFlow('app');
    }
  };

  const signOut = async () => {
    if (supabase && userId) {
      const { error } = await supabase.auth.signOut();
      if (error) { Alert.alert('Could not sign out', error.message); return; }
    }
    try { await clearSapientReminders(); } catch (error) { console.warn('Could not clear scheduled reminders', error); }
    setUserId(null); setCourses([]); setClasses([]); setResources([]); setTimetableFile(''); setTimetablePath(''); setTimetableResourceId(''); setSessions([]); setNotifyClasses(false); setNotifyStudy(false);
    setFlow('welcome'); setTab('Home');
  };

  const uploadTimetable = async () => {
    if (!userId || !supabase) { Alert.alert('Sign in required', 'Sign in to upload your timetable.'); return; }
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: false, base64: false });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const uploaded = await uploadStudentFile(userId, asset, { kind: 'timetable' });
        if (timetablePath) {
          const { error: removeError } = await supabase.from('resources').delete().eq('id', timetableResourceId);
          if (removeError) {
            await removeStudentFiles([uploaded.storagePath!]);
            await supabase.from('resources').delete().eq('id', uploaded.id);
            throw removeError;
          }
          try { await removeStudentFiles([timetablePath]); }
          catch (removeError) { Alert.alert('Timetable replaced', `The new file is saved. The previous file could not be removed: ${String(removeError)}`); }
        }
        setTimetableFile(uploaded.name); setTimetablePath(uploaded.storagePath ?? ''); setTimetableResourceId(uploaded.id);
      }
    } catch (error) {
      Alert.alert('Could not save timetable', String(error));
    }
  };

  const pickResource = async (course: string) => {
    if (!userId || !supabase) { Alert.alert('Sign in required', 'Sign in to upload course resources.'); return; }
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: false, base64: false });
      if (!result.canceled && result.assets?.length) {
        const selectedCourse = courses.find((item) => item.name === course);
        const added = [] as Resource[];
        for (let i = 0; i < result.assets.length; i += 1) {
          try {
            added.push(await uploadStudentFile(userId, result.assets[i], { kind: 'resource', courseId: selectedCourse?.id, courseName: course }));
          } catch (error) {
            if (added.length) setResources((prev) => [...prev, ...added]);
            Alert.alert(added.length ? 'Some files uploaded' : 'Could not upload files', added.length
              ? `${added.length} file${added.length === 1 ? '' : 's'} saved. The next upload failed: ${String(error)}`
              : String(error));
            return;
          }
        }
        setResources((prev) => [...prev, ...added]);
      }
    } catch (error) {
      Alert.alert('Could not upload files', String(error));
    }
  };

  const deleteResource = async (id: string) => {
    const resource = resources.find((item) => item.id === id);
    if (resource?.storagePath && supabase) {
      try {
        await removeStudentFiles([resource.storagePath]);
        const { error } = await supabase.from('resources').delete().eq('id', id);
        if (error) throw error;
      } catch (error) { Alert.alert('Could not delete file', String(error)); return; }
    }
    setResources((prev) => prev.filter((item) => item.id !== id));
  };

  const openResource = async (resource: Resource) => {
    if (!resource.storagePath) { Alert.alert('File unavailable', 'This file is not available in your account.'); return; }
    try { await Linking.openURL(await createStudentFileUrl(resource.storagePath)); }
    catch (error) { Alert.alert('Could not open file', String(error)); }
  };

  const saveProfile = async () => {
    if (supabase && userId) {
      const startDate = dateForDatabase(semesterStart);
      const endDate = dateForDatabase(semesterEnd);
      if (startDate === undefined || endDate === undefined) { Alert.alert('Check semester dates', 'Use dd/mm/yyyy for the start and end dates.'); return; }
      if (startDate && endDate && startDate > endDate) { Alert.alert('Check semester dates', 'The semester end date must be after the start date.'); return; }
      const profile = { id: userId, full_name: name.trim(), university, course_of_study: courseOfStudy, semester, semester_start: startDate, semester_end: endDate, updated_at: new Date().toISOString() };
      const { error } = await supabase.from('profiles').upsert(profile);
      if (error) { Alert.alert('Could not save profile', error.message); return; }
    }
    setFlow(profileReturn);
  };

  const clearResources = async () => {
    if (supabase && userId) {
      const { data, error } = await supabase.from('resources').select('id, storage_path').eq('user_id', userId).eq('file_kind', 'resource');
      if (error) { Alert.alert('Could not load your files', error.message); return; }
      try {
        await removeStudentFiles((data ?? []).map((row: any) => row.storage_path));
        const { error: deleteError } = await supabase.from('resources').delete().eq('user_id', userId).eq('file_kind', 'resource');
        if (deleteError) throw deleteError;
      } catch (error) { Alert.alert('Could not clear files', String(error)); return; }
    }
    setResources([]); Alert.alert('Resources cleared', 'Your uploaded course files have been removed.');
  };

  return <SafeAreaProvider><SafeAreaView style={styles.root} edges={['top', 'bottom']}>
    <StatusBar barStyle="light-content" backgroundColor={C.bg} />
    <Stars />
    <View style={styles.appLayer}>
      {!authReady && <View style={styles.centerScreen}><Brand large /><ActivityIndicator color={C.accent} style={{ marginTop: 24 }} /><Text style={styles.mutedText}>Restoring your Sapient account…</Text></View>}
      {authReady && <ScreenEntrance key={flow}>
      {flow === 'welcome' && <WelcomeScreen onCreate={() => setFlow('signup')} onLogin={() => setFlow('login')} />}
      {flow === 'signup' && <SignupScreen name={name} setName={setName} email={email} setEmail={setEmail} university={university} setUniversity={setUniversity} onPickUniversity={() => setUniversityPicker(true)} onContinue={finishSignup} onLogin={() => setFlow('login')} onBack={() => setFlow('welcome')} />}
      {flow === 'login' && <LoginScreen onBack={() => setFlow('welcome')} onLogin={signIn} onCreate={() => setFlow('signup')} />}
      {flow === 'verify' && <VerifyScreen email={email} onContinue={verifyEmail} onResend={resendSignupCode} onBack={() => setFlow('signup')} />}
      {flow === 'tour' && <TourScreen index={tourIndex} onNext={() => tourIndex === tourSlides.length - 1 ? setFlow('app') : setTourIndex((v) => v + 1)} onBack={() => setTourIndex((v) => Math.max(0, v - 1))} onSkip={() => setFlow('app')} />}
      {flow === 'app' && <MainApp
        tab={tab} setTab={setTab} name={name} university={university} courses={courses} setCourses={setCourses}
        userId={userId}
        classes={classes} setClasses={setClasses} resources={resources} setResources={setResources} pickResource={pickResource} deleteResource={deleteResource} openResource={openResource}
        sessions={sessions} setSessions={updateSessions} timetableFile={timetableFile} uploadTimetable={uploadTimetable}
        openTimetable={() => timetablePath ? openResource({ storagePath: timetablePath } as Resource) : Alert.alert('Timetable file', 'No timetable file has been uploaded yet.')}
        onSettings={() => setFlow('settings')} onProfile={() => { setProfileReturn('app'); setFlow('profile'); }} setupDone={setupDone} setSetupDone={setSetupDone}
      />}
      {flow === 'settings' && <SettingsScreen name={name} university={university} notifyClasses={notifyClasses} onToggleClasses={(enabled: boolean) => updateNotificationPreference('classes', enabled)} notifyStudy={notifyStudy} onToggleStudy={(enabled: boolean) => updateNotificationPreference('study', enabled)} onBack={() => setFlow('app')} onProfile={() => { setProfileReturn('settings'); setFlow('profile'); }} onLogout={signOut} onClear={clearResources} />}
      {flow === 'profile' && <ProfileScreen name={name} setName={setName} email={email} university={university} setUniversity={setUniversity} courseOfStudy={courseOfStudy} setCourseOfStudy={setCourseOfStudy} semester={semester} setSemester={setSemester} semesterStart={semesterStart} setSemesterStart={setSemesterStart} semesterEnd={semesterEnd} setSemesterEnd={setSemesterEnd} onPickUniversity={() => setUniversityPicker(true)} onBack={() => setFlow(profileReturn)} onSave={saveProfile} />}
      </ScreenEntrance>}
    </View>
    <Modal visible={universityPicker} transparent animationType="slide" onRequestClose={() => setUniversityPicker(false)}>
      <Pressable style={styles.scrim} onPress={() => setUniversityPicker(false)}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Choose your university</Text>
          {universities.map((school) => <Pressable key={school} onPress={() => { setUniversity(school); setUniversityPicker(false); }} style={styles.optionRow}><Text style={styles.optionText}>{school}</Text><Text style={{ color: university === school ? C.teal : C.quiet }}>{university === school ? '●' : '○'}</Text></Pressable>)}
        </View>
      </Pressable>
    </Modal>
  </SafeAreaView></SafeAreaProvider>;
}

function WelcomeScreen({ onCreate, onLogin }: any) {
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const motion = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    motion.start();
    return () => motion.stop();
  }, [float]);
  return <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.welcomeScroll} showsVerticalScrollIndicator={false}>
    <View style={styles.welcomeHeader}><Brand /><View style={styles.privateBadge}><View style={styles.privateDot} /><Text style={styles.privateBadgeText}>YOUR SPACE, IN SYNC</Text></View></View>
    <Animated.View style={[styles.welcomeArt, { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [5, -7] }) }] }]}>
      <View style={styles.orbGlow} />
      <View style={styles.orbRing} />
      <View style={styles.welcomeOrb}><Text style={styles.orbSymbol}>✦</Text></View>
      <View style={[styles.artBadge, styles.artBadgeTop]}><Text style={{ color: C.teal, fontSize: 18 }}>▦</Text><Text style={styles.artBadgeLabel}>WEEK</Text></View>
      <View style={[styles.artBadge, styles.artBadgeBottom]}><Text style={{ color: C.orange, fontSize: 18 }}>✧</Text><Text style={styles.artBadgeLabel}>FOCUS</Text></View>
    </Animated.View>
    <Text style={styles.heroEyebrow}>MAKE SPACE FOR WHAT MATTERS</Text>
    <Text style={styles.welcomeTitle}>Your semester,{'\n'}<Text style={{ color: C.accent }}>beautifully in sync.</Text></Text>
    <Text style={styles.welcomeBody}>Classes, course files and focused study time — all flowing together in one calm space.</Text>
    <View style={styles.featureRow}><Pill title="▦  Timetable" color={C.teal} /><Pill title="▤  Resources" color={C.orange} /><Pill title="✧  Study plan" color={C.pink} /></View>
    <View style={styles.welcomeActions}>
      <Button title="Create your account   →" onPress={onCreate} />
      <Pressable onPress={onLogin} style={styles.loginLink} accessibilityRole="button" accessibilityLabel="Already have an account? Sign in"><Text style={styles.linkText}>Already have an account? <Text style={{ color: C.text, fontWeight: '700' }}>Sign in</Text></Text></Pressable>
    </View>
  </ScrollView>;
}

function SignupScreen({ name, setName, email, setEmail, university, onPickUniversity, onContinue, onLogin, onBack }: any) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const submit = () => {
    if (password.length < 6) { Alert.alert('Password too short', 'Use at least 6 characters.'); return; }
    if (password !== confirmPassword) { Alert.alert('Passwords do not match', 'Check both password fields and try again.'); return; }
    onContinue(password);
  };
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onBack}><Text style={styles.backText}>‹  Back</Text></Pressable>
      <View style={styles.authBrandBlock}><Brand large /><Text style={styles.brandTagline}>Your academic space</Text></View>
      <Text style={styles.authTitle}>Create your account ✨</Text>
      <Text style={styles.authSubtitle}>One account. Your whole semester.</Text>
      <Field label="FULL NAME" value={name} onChangeText={setName} placeholder="Enter your full name" />
      <Field label="EMAIL" value={email} onChangeText={setEmail} placeholder="yourname@email.com" keyboardType="email-address" />
      <Field label="UNIVERSITY" value={university} placeholder="Select your university..." onPress={onPickUniversity} right={<UniversityChevron />} />
      <Field label="PASSWORD" value={password} onChangeText={setPassword} placeholder="Min. 6 characters" secureTextEntry={!showPassword} right={<PasswordToggle visible={showPassword} onPress={() => setShowPassword((v: boolean) => !v)} />} />
      <Field label="CONFIRM PASSWORD" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat your password" secureTextEntry={!showConfirmPassword} right={<PasswordToggle visible={showConfirmPassword} onPress={() => setShowConfirmPassword((v: boolean) => !v)} />} />
      <Text style={styles.formHint}>By continuing, you agree to Sapient's Terms and Privacy Policy.</Text>
      <Button title="Create Account" onPress={submit} />
      <Pressable onPress={onLogin} style={styles.loginLink} accessibilityRole="button" accessibilityLabel="Already have an account? Sign in">
        <Text style={styles.linkText}>Already have an account? <Text style={{ color: C.text, fontWeight: '700' }}>Sign in</Text></Text>
      </Pressable>
    </ScrollView>
  </KeyboardAvoidingView>;
}

function LoginScreen({ onBack, onLogin, onCreate }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onBack}><Text style={styles.backText}>‹  Back</Text></Pressable>
      <View style={styles.authBrandBlock}><Brand large /><Text style={styles.brandTagline}>Your academic space</Text></View>
      <Text style={styles.authTitle}>Welcome back</Text>
      <Text style={styles.authSubtitle}>Sign in to sync your courses and files</Text>
      <Field label="EMAIL" value={email} onChangeText={setEmail} placeholder="yourname@email.com" keyboardType="email-address" />
      <Field label="PASSWORD" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry={!showPassword} right={<PasswordToggle visible={showPassword} onPress={() => setShowPassword((v: boolean) => !v)} />} />
      <Button title="Sign in" onPress={() => onLogin(email, password)} />
      <Pressable onPress={onCreate} style={{ padding: 16 }} accessibilityRole="button" accessibilityLabel="New to Sapient? Create an account"><Text style={styles.linkText}>New to Sapient? <Text style={{ color: C.text }}>Create an account</Text></Text></Pressable>
    </ScrollView>
  </KeyboardAvoidingView>;
}

function VerifyScreen({ email, onContinue, onResend, onBack }: any) {
  const [code, setCode] = useState('');
  const codeInput = useRef<any>(null);
  const verify = () => {
    if (code.length !== 6) { Alert.alert('Enter your code', 'Type the 6-digit code to continue.'); return; }
    onContinue(code);
  };
  return <View style={styles.centerScreen}>
    <Pressable onPress={onBack} style={styles.backAbsolute}><Text style={styles.backText}>‹  Back</Text></Pressable>
    <Brand large /><Text style={styles.brandTagline}>Your academic space</Text>
    <View style={styles.mailOrb}><Text style={{ color: C.text, fontSize: 36 }}>✉</Text></View>
    <Text style={styles.welcomeTitle}>Check your inbox</Text>
    <Text style={styles.welcomeBody}>We sent a 6-digit code to</Text>
    <View style={styles.emailBadge}><Text style={{ color: C.text, fontWeight: '700' }}>{email || 'your email address'}</Text></View>
    <Pressable onPress={() => codeInput.current?.focus()} accessibilityLabel="Six-digit verification code" style={styles.otpRow}>
      {Array.from({ length: 6 }, (_, i) => <View key={i} style={[styles.otpCell, i === Math.min(code.length, 5) && styles.otpCellActive]}><Text style={styles.otpDigit}>{code[i] ?? ''}</Text></View>)}
      <TextInput ref={codeInput} value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} textContentType="oneTimeCode" autoComplete="one-time-code" caretHidden selectionColor="transparent" style={styles.otpHiddenInput} />
    </Pressable>
    <Pressable onPress={onResend} style={{ padding: 16 }}><Text style={styles.linkText}>Didn't receive it? <Text style={{ color: C.accent }}>Resend</Text></Text></Pressable>
    <Button title="Verify email  →" onPress={verify} style={{ marginTop: 12, width: '100%', maxWidth: 360 }} />
  </View>;
}

function TourScreen({ index, onNext, onBack, onSkip }: any) {
  const slide = tourSlides[index];
  const transition = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const touchStart = useRef(0);
  useEffect(() => {
    transition.setValue(0);
    const enter = Animated.spring(transition, { toValue: 1, speed: 20, bounciness: 4, useNativeDriver: true });
    enter.start();
    return () => enter.stop();
  }, [index, transition]);
  useEffect(() => {
    const motion = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 2300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 2300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    motion.start();
    return () => motion.stop();
  }, [float]);
  const swipe = (event: any) => {
    const distance = event.nativeEvent.pageX - touchStart.current;
    if (distance < -64) onNext();
    else if (distance > 64 && index > 0) onBack();
  };
  return <View style={[styles.centerScreen, styles.tourScreen]} onTouchStart={(event) => { touchStart.current = event.nativeEvent.pageX; }} onTouchEnd={swipe}>
    <View style={styles.tourHeader}><Brand /><Pressable onPress={onSkip} hitSlop={10} style={styles.skipButton}><Text style={styles.skipText}>Skip tour</Text><Text style={{ color: C.quiet, marginLeft: 4 }}>↗</Text></Pressable></View>
    <View style={styles.tourProgressTop}><Text style={styles.heroEyebrow}>YOUR ACADEMIC SPACE</Text><Text style={styles.tourStepCount}>0{index + 1}<Text style={{ color: C.quiet }}> / 0{tourSlides.length}</Text></Text></View>
    <View style={styles.tourProgressTrack}>{tourSlides.map((item: any, i: number) => <View key={i} style={[styles.tourProgressSegment, { backgroundColor: i <= index ? item.color : `${C.quiet}45` }]} />)}</View>
    <Animated.View style={[styles.tourContent, { opacity: transition, transform: [{ translateX: transition.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) }, { scale: transition.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] }]}>
      <Animated.View style={[styles.tourArt, { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [4, -7] }) }] }]}>
        <View style={[styles.tourGlow, { backgroundColor: `${slide.color}20` }]} />
        <View style={[styles.tourOrb, { borderColor: `${slide.color}55`, backgroundColor: `${slide.color}14` }]}><Text style={[styles.tourIcon, { color: slide.color }]}>{slide.icon}</Text></View>
        <View style={[styles.tourSpark, { backgroundColor: slide.color }]} />
      </Animated.View>
      <Text style={[styles.heroEyebrow, { color: slide.color, marginTop: 2 }]}>STEP 0{index + 1} · SAPIENT</Text>
      <Text style={styles.tourTitle}>{slide.title}</Text>
      <Text style={styles.tourBody}>{slide.body}</Text>
      <View style={[styles.tipBox, { borderColor: `${slide.color}45`, backgroundColor: `${slide.color}0c` }]}><View style={styles.tipHeading}><Text style={{ color: slide.color, fontSize: 15 }}>✦</Text><Text style={[styles.tipLabel, { color: slide.color }]}>A LITTLE TIP</Text></View><Text style={styles.tipText}>{slide.tip}</Text></View>
    </Animated.View>
    <View style={styles.tourFooter}>
      <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
        {index > 0 && <Button title="‹  Back" secondary onPress={onBack} style={{ width: 108 }} />}
        <Button title={index === tourSlides.length - 1 ? "Let's get started  ↗" : 'Continue  →'} onPress={onNext} style={{ flex: 1 }} />
      </View>
      <Text style={styles.tourFootnote}>SWIPE TO EXPLORE  ·  {index + 1} OF {tourSlides.length}</Text>
    </View>
  </View>;
}

function MainApp(props: any) {
  const { tab, setTab, name, university, userId, courses, setCourses, classes, setClasses, resources, setResources, pickResource, deleteResource, openResource, openTimetable, sessions, setSessions, timetableFile, uploadTimetable, onSettings, onProfile, setupDone, setSetupDone } = props;
  const [subscreen, setSubscreen] = useState<null | 'class' | 'course'>(null);
  const [courseDraft, setCourseDraft] = useState('');
  const [workload, setWorkload] = useState<'light' | 'medium' | 'heavy'>('medium');
  const [classCourse, setClassCourse] = useState('');
  const [classDay, setClassDay] = useState('Mon');
  const [classStart, setClassStart] = useState('08:00');
  const [classEnd, setClassEnd] = useState('10:00');
  const [classLocation, setClassLocation] = useState('');
  const [classLecturer, setClassLecturer] = useState('');
  const [selectedDay, setSelectedDay] = useState(days[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);
  const [expandedCourse, setExpandedCourse] = useState('');
  const [search, setSearch] = useState('');
  const [focusMethod, setFocusMethod] = useState('Pomodoro');
  const [duration, setDuration] = useState(25);
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [taskDraft, setTaskDraft] = useState('');
  const [tasks, setTasks] = useState<{ id: string; text: string; done: boolean }[]>([]);
  const [minutesStudied, setMinutesStudied] = useState(0);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSeconds((s) => {
      if (s <= 1) {
        clearInterval(timer);
        setRunning(false);
        setMinutesStudied((m) => m + duration);
        Alert.alert('Focus session complete', 'Nice work. Take a short break before your next session.');
        return duration * 60;
      }
      return s - 1;
    }), 1000);
    return () => clearInterval(timer);
  }, [running, duration]);

  const addCourse = async () => {
    if (!courseDraft.trim()) { Alert.alert('Course name needed', 'Add a course name to continue.'); return; }
    const colors = [C.accent, C.teal, C.orange, C.pink];
    const color = colors[courses.length % colors.length];
    let course: Course = { id: `${Date.now()}`, name: courseDraft.trim(), workload, color };
    if (userId && supabase) {
      const { data, error } = await supabase.from('courses').insert({ user_id: userId, name: course.name, workload, color }).select().single();
      if (error) { Alert.alert('Could not save course', error.message); return; }
      course = { id: data.id, name: data.name, workload: data.workload, color: data.color };
    }
    setCourses((prev: Course[]) => [...prev, course]);
    if (!expandedCourse) setExpandedCourse(course.name);
    setCourseDraft(''); setWorkload('medium'); setSubscreen(null);
  };

  const removeCourse = (course: Course) => Alert.alert('Remove this course?', `This will also remove its saved files and classes for ${course.name}.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      if (userId && supabase) {
        const { data: fileRows, error: loadError } = await supabase.from('resources').select('id, storage_path').eq('course_id', course.id);
        if (loadError) { Alert.alert('Could not remove course', loadError.message); return; }
        try {
          await removeStudentFiles((fileRows ?? []).map((row: any) => row.storage_path));
          const { error: classError } = await supabase.from('classes').delete().eq('course_id', course.id);
          if (classError) throw classError;
          const { error } = await supabase.from('courses').delete().eq('id', course.id);
          if (error) throw error;
        } catch (error) { Alert.alert('Could not remove course', String(error)); return; }
      }
      setCourses((prev: Course[]) => prev.filter((item) => item.id !== course.id));
      setResources((prev: Resource[]) => prev.filter((item) => item.course !== course.name));
      setClasses((prev: ClassItem[]) => prev.filter((item) => item.course !== course.name));
    } },
  ]);

  const addClass = async () => {
    const course = classCourse.trim();
    if (!course) { Alert.alert('Course needed', 'Select a course or enter a course name.'); return; }
    let item: ClassItem = { id: `${Date.now()}`, course, day: classDay, start: classStart, end: classEnd, location: classLocation || '', lecturer: classLecturer };
    if (userId && supabase) {
      const selectedCourse = courses.find((entry: Course) => entry.name === course);
      const { data, error } = await supabase.from('classes').insert({
        user_id: userId, course_id: selectedCourse?.id ?? null, course_name: course, day: classDay,
        start_time: classStart, end_time: classEnd, location: classLocation, lecturer: classLecturer,
      }).select().single();
      if (error) { Alert.alert('Could not save class', error.message); return; }
      item = { id: data.id, courseId: data.course_id, course: data.course_name, day: data.day, start: String(data.start_time).slice(0, 5), end: String(data.end_time).slice(0, 5), location: data.location, lecturer: data.lecturer };
    }
    setClasses((prev: ClassItem[]) => [...prev, item]);
    setClassCourse(''); setClassLocation(''); setClassLecturer(''); setSubscreen(null); setTab('Timetable'); setSelectedDay(classDay);
  };

  const addTask = () => {
    if (!taskDraft.trim()) return;
    setTasks((prev) => [...prev, { id: `${Date.now()}`, text: taskDraft.trim(), done: false }]);
    setTaskDraft('');
  };

  const generatePlan = () => {
    if (courses.length === 0) { Alert.alert('Add a course first', 'Your study plan will use your course list and workloads.'); setTab('Resources'); setSubscreen('course'); return; }
    const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
    const plan = courses.slice(0, 3).map((course: Course, i: number) => ({ id: `${Date.now()}-${i}`, day: days[(todayIndex + i) % 7], time: `${5 + i}:00 PM`, course: course.name, minutes: course.workload === 'heavy' ? 60 : 45 }));
    setSessions(plan);
  };

  const removeClass = async (id: string) => {
    if (userId && supabase) {
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) { Alert.alert('Could not remove class', error.message); return; }
    }
    setClasses((prev: ClassItem[]) => prev.filter((item) => item.id !== id));
  };
  const visibleResources = useMemo(() => resources.filter((r: Resource) => `${r.name} ${r.course}`.toLowerCase().includes(search.toLowerCase())), [resources, search]);

  return <View style={styles.mainRoot}>
    <View style={styles.topBar}>
      <Pressable onPress={() => setTab('Home')}><Brand /></Pressable>
      <View style={styles.topActions}><Pressable onPress={onProfile} style={styles.avatar}><Text style={styles.avatarText}>{(name || 'A').charAt(0).toUpperCase()}</Text></Pressable><Pressable onPress={onSettings} style={styles.settingsIcon}><Text style={{ color: C.muted, fontSize: 17 }}>☰</Text></Pressable></View>
    </View>

    {subscreen === 'class' ? <ScreenEntrance key="manual-class"><ManualClassScreen courses={courses} classCourse={classCourse} setClassCourse={setClassCourse} day={classDay} setDay={setClassDay} start={classStart} setStart={setClassStart} end={classEnd} setEnd={setClassEnd} location={classLocation} setLocation={setClassLocation} lecturer={classLecturer} setLecturer={setClassLecturer} onAdd={addClass} onCancel={() => setSubscreen(null)} /></ScreenEntrance>
      : subscreen === 'course' ? <ScreenEntrance key="add-course"><AddCourseScreen name={courseDraft} setName={setCourseDraft} workload={workload} setWorkload={setWorkload} courses={courses} onAdd={addCourse} onRemoveCourse={removeCourse} onCancel={() => setSubscreen(null)} /></ScreenEntrance>
      : <>
        <ScreenEntrance key={`tab-${tab}`} style={styles.contentScroll}><ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentPad} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {tab === 'Home' && <Dashboard name={name} university={university} courses={courses} classes={classes} resources={resources} sessions={sessions} setupDone={setupDone} onSetup={() => setSetupDone(true)} onTab={setTab} />}
          {tab === 'Timetable' && <TimetableScreen classes={classes} selectedDay={selectedDay} setSelectedDay={setSelectedDay} timetableFile={timetableFile} onOpenFile={openTimetable} onUpload={uploadTimetable} onAdd={() => setSubscreen('class')} onRemove={removeClass} />}
          {tab === 'Resources' && <ResourcesScreen courses={courses} resources={visibleResources} allResources={resources} expandedCourse={expandedCourse} setExpandedCourse={setExpandedCourse} search={search} setSearch={setSearch} onAddCourse={() => setSubscreen('course')} onUpload={pickResource} onDelete={deleteResource} onOpen={openResource} />}
          {tab === 'Study' && <StudyScreen methods={['Pomodoro', 'Active Recall', 'Spaced Repetition', 'Feynman']} focusMethod={focusMethod} setFocusMethod={setFocusMethod} duration={duration} setDuration={(n: number) => { setDuration(n); setSeconds(n * 60); }} seconds={seconds} running={running} setRunning={setRunning} tasks={tasks} taskDraft={taskDraft} setTaskDraft={setTaskDraft} onAddTask={addTask} onToggleTask={(id: string) => setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done: !t.done } : t))} sessions={sessions} setSessions={setSessions} onGenerate={generatePlan} minutesStudied={minutesStudied} />}
        </ScrollView></ScreenEntrance>
        <View style={styles.tabBar}>{(['Home', 'Timetable', 'Resources', 'Study'] as Tab[]).map((item, i) => {
          const icons = ['⌂', '▦', '▤', '◷'];
          return <TabButton key={item} item={item} icon={icons[i]} active={tab === item} onPress={() => setTab(item)} />;
        })}</View>
      </>}
  </View>;
}

function PageHeading({ eyebrow, title, action, onAction }: any) {
  return <View style={styles.pageHeading}><View>{eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}<Text style={styles.pageTitle}>{title}</Text></View>{action ? <Pressable onPress={onAction} style={styles.headerAction}><Text style={styles.headerActionText}>{action}</Text></Pressable> : null}</View>;
}

function Dashboard({ name, university, courses, classes, resources, sessions, setupDone, onSetup, onTab }: any) {
  const now = new Date();
  const today = days[now.getDay() === 0 ? 6 : now.getDay() - 1];
  const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const firstName = (name || 'there').trim().split(/\s+/)[0];
  const todayClasses = classes.filter((c: ClassItem) => c.day === today);
  const done = (setupDone ? 1 : 0) + (courses.length ? 1 : 0) + (classes.length ? 1 : 0);
  return <>
    <Reveal><View style={styles.greetingRow}><View style={{ flex: 1 }}><Text style={styles.heroEyebrow}>{date.toUpperCase()}</Text><Text style={styles.greeting}>Good {now.getHours() < 12 ? 'morning' : now.getHours() < 18 ? 'afternoon' : 'evening'}, {firstName} <Text style={{ color: C.teal }}>✦</Text></Text><Text style={styles.subGreeting}>A clear plan makes room for great work.</Text></View><View style={styles.datePill}><Text style={styles.dateText}>{today.toUpperCase()}</Text></View></View></Reveal>
    <Reveal delay={55}><Card style={styles.setupCard}>
      <View style={styles.setupTop}><View><Text style={styles.cardTitle}>Your semester, in motion</Text><Text style={styles.mutedText}>A few small steps to get fully set up</Text></View><Text style={styles.setupCount}>{done}<Text style={{ color: C.quiet, fontSize: 15 }}> / 3</Text></Text></View>
      <ProgressBar value={(done / 3) * 100} />
      <View style={styles.setupSteps}>
        <Pressable style={[styles.setupStep, setupDone && styles.setupStepDone]} onPress={onSetup}><Text style={styles.stepIcon}>{setupDone ? '✓' : '○'}</Text><Text style={styles.stepText}>Complete your profile</Text><Text style={styles.rowChevron}>›</Text></Pressable>
        <Pressable style={styles.setupStep} onPress={() => onTab('Resources')}><Text style={[styles.stepIcon, { color: C.orange }]}>▤</Text><Text style={styles.stepText}>Add your courses</Text><Text style={styles.rowChevron}>›</Text></Pressable>
        <Pressable style={styles.setupStep} onPress={() => onTab('Timetable')}><Text style={[styles.stepIcon, { color: C.accent }]}>▦</Text><Text style={styles.stepText}>Add your timetable</Text><Text style={styles.rowChevron}>›</Text></Pressable>
      </View>
    </Card></Reveal>
    <Reveal delay={100}><PageHeading eyebrow="YOUR DAY AT A GLANCE" title="Today's classes" action="Full week →" onAction={() => onTab('Timetable')} /></Reveal>
    <Reveal delay={145}><Card>
      {todayClasses.length ? todayClasses.map((item: ClassItem) => <View key={item.id} style={styles.classRow}><View style={[styles.classAccent, { backgroundColor: C.accent }]} /><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{item.course}</Text><Text style={styles.mutedText}>{item.start} – {item.end} · {item.location}</Text></View><Text style={styles.rowChevron}>›</Text></View>) : <View style={styles.dashboardEmpty}><Text style={styles.emptySymbol}>▦</Text><Text style={styles.emptyTitle}>A little space in your day</Text><Text style={styles.emptyBody}>Add your timetable and see everything coming up, at a glance.</Text><Button title="Add your timetable  →" onPress={() => onTab('Timetable')} style={{ marginTop: 14, maxWidth: 230 }} /></View>}
    </Card></Reveal>
    <Reveal delay={195}><View style={styles.twoColumns}>
      <Card style={{ flex: 1 }}><Text style={styles.eyebrow}>COURSES</Text><Text style={styles.statNumber}>{courses.length}</Text><Text style={styles.mutedText}>{courses.length ? 'Ready for your semester' : 'No courses added yet'}</Text><Pressable onPress={() => onTab('Resources')}><Text style={styles.inlineLink}>View courses →</Text></Pressable></Card>
      <Card style={{ flex: 1 }}><Text style={styles.eyebrow}>RESOURCES SAVED</Text><Text style={styles.statNumber}>{resources.length}</Text><Text style={styles.mutedText}>{resources.length ? 'Files in your library' : 'No files uploaded yet'}</Text><Pressable onPress={() => onTab('Resources')}><Text style={styles.inlineLink}>Open resources →</Text></Pressable></Card>
    </View></Reveal>
    <Reveal delay={240}><Card style={styles.studyPrompt}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>PERSONAL STUDY</Text><Text style={styles.cardTitle}>A little focus goes a long way.</Text><Text style={styles.mutedText}>{sessions.length ? `${sessions.length} sessions in your plan` : 'Start a timer or build a study plan.'}</Text></View><Button title="Study →" onPress={() => onTab('Study')} style={{ width: 116 }} /></Card></Reveal>
    <Reveal delay={285}><Card><Text style={styles.eyebrow}>A NOTE TO SELF</Text><Text style={styles.quote}>“An investment in knowledge pays the best interest.”</Text><Text style={styles.mutedText}>— Benjamin Franklin</Text></Card></Reveal>
  </>;
}

function TimetableScreen({ classes, selectedDay, setSelectedDay, timetableFile, onOpenFile, onUpload, onAdd, onRemove }: any) {
  const dayClasses = classes.filter((c: ClassItem) => c.day === selectedDay).sort((a: ClassItem, b: ClassItem) => a.start.localeCompare(b.start));
  return <>
    <PageHeading eyebrow="YOUR WEEK" title="Timetable" action="＋ Add class" onAction={onAdd} />
    <View style={styles.sectionIntro}><Pill title="✦ Weekly view" color={C.accent} /><Text style={styles.mutedText}>{classes.length} {classes.length === 1 ? 'class' : 'classes'} added</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
      {days.map((day) => <Pressable key={day} onPress={() => setSelectedDay(day)} style={[styles.dayChip, selectedDay === day && styles.dayChipActive]}><Text style={[styles.dayChipText, selectedDay === day && { color: C.text }]}>{day}</Text><Text style={[styles.dayChipCount, selectedDay === day && { color: C.teal }]}>{classes.filter((c: ClassItem) => c.day === day).length}</Text></Pressable>)}
    </ScrollView>
    {dayClasses.length ? <View style={{ gap: 10, marginTop: 8 }}>{dayClasses.map((item: ClassItem) => <Card key={item.id} style={styles.timetableClass}><View style={styles.timeBlock}><Text style={styles.timeText}>{item.start}</Text><Text style={styles.timeDash}>to {item.end}</Text></View><View style={styles.classVerticalAccent} /><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{item.course}</Text><Text style={styles.mutedText}>{item.location}</Text>{item.lecturer ? <Text style={styles.quietText}>{item.lecturer}</Text> : null}</View><Pressable onPress={() => onRemove(item.id)}><Text style={styles.removeText}>×</Text></Pressable></Card>)}</View>
      : <Card style={{ marginTop: 8 }}><EmptyState icon="▦" title={`Nothing scheduled on ${selectedDay}`} body="Add a class manually or attach your semester timetable to get started." /><Button title="＋ Add class manually" onPress={onAdd} secondary style={{ marginTop: 12 }} /><Button title="Upload timetable" onPress={onUpload} style={{ marginTop: 10 }} /></Card>}
    {timetableFile ? <Card style={styles.fileCard}><Text style={styles.fileIcon}>▧</Text><View style={{ flex: 1 }}><Text style={styles.cardTitle}>Timetable attached</Text><Text style={styles.mutedText} numberOfLines={1}>{timetableFile}</Text></View><Pressable onPress={onOpenFile} style={{ paddingHorizontal: 8 }}><Text style={styles.inlineLink}>Open</Text></Pressable><Pressable onPress={onUpload}><Text style={styles.inlineLink}>Replace</Text></Pressable></Card> : <Pressable onPress={onUpload} style={styles.uploadStrip}><Text style={styles.uploadGlyph}>↑</Text><View style={{ flex: 1 }}><Text style={styles.cardTitle}>Upload your semester timetable</Text><Text style={styles.mutedText}>PDF, JPG or PNG</Text></View><Text style={styles.rowChevron}>›</Text></Pressable>}
    <Text style={styles.helperText}>Your timetable file is stored privately in your account. Add or edit individual classes to keep the week up to date.</Text>
  </>;
}

function ManualClassScreen({ courses, classCourse, setClassCourse, day, setDay, start, setStart, end, setEnd, location, setLocation, lecturer, setLecturer, onAdd, onCancel }: any) {
  const [manualCourse, setManualCourse] = useState('');
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.formPage} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onCancel}><Text style={styles.backText}>‹  Timetable</Text></Pressable>
      <PageHeading eyebrow="WEEKLY SCHEDULE" title="Add a class" />
      <Card>
        <Label>COURSE</Label>
        {courses.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>{courses.map((course: Course) => <Pressable key={course.id} onPress={() => { setClassCourse(course.name); setManualCourse(''); }} style={[styles.choicePill, classCourse === course.name && styles.choicePillActive]}><Text style={styles.choiceText}>{course.name}</Text></Pressable>)}</ScrollView> : null}
        <Field value={manualCourse} onChangeText={(v: string) => { setManualCourse(v); setClassCourse(v); }} placeholder="Or type a course name..." />
        <Label>DAY</Label>
        <View style={styles.dayWrap}>{days.map((d) => <Pressable key={d} onPress={() => setDay(d)} style={[styles.daySmall, day === d && styles.daySmallActive]}><Text style={[styles.daySmallText, day === d && { color: C.text }]}>{d}</Text></Pressable>)}</View>
        <View style={styles.twoColumns}><View style={{ flex: 1 }}><Field label="START TIME" value={start} onChangeText={setStart} placeholder="08:00" /></View><View style={{ flex: 1 }}><Field label="END TIME" value={end} onChangeText={setEnd} placeholder="10:00" /></View></View>
        <Field label="LOCATION (OPTIONAL)" value={location} onChangeText={setLocation} placeholder="e.g. LT1, Room 204" />
        <Field label="LECTURER (OPTIONAL)" value={lecturer} onChangeText={setLecturer} placeholder="e.g. Dr. Mensah" />
        <View style={{ flexDirection: 'row', gap: 10 }}><Button title="Cancel" secondary onPress={onCancel} style={{ flex: 1 }} /><Button title="Add class" onPress={onAdd} style={{ flex: 1 }} /></View>
      </Card>
    </ScrollView>
  </KeyboardAvoidingView>;
}

function ResourcesScreen({ courses, resources, allResources, expandedCourse, setExpandedCourse, search, setSearch, onAddCourse, onUpload, onDelete, onOpen }: any) {
  return <>
    <PageHeading eyebrow="YOUR STUDY LIBRARY" title="Resources" action="＋ Courses" onAction={onAddCourse} />
    <Field value={search} onChangeText={setSearch} placeholder="⌕  Search all your files..." />
    {!courses.length ? <Card><EmptyState icon="▤" title="No courses yet" body="Add the courses you're taking so you can organise notes and files by subject." /><Button title="＋ Add your courses" onPress={onAddCourse} style={{ marginTop: 14 }} /></Card> : <>
      <View style={styles.courseCountLine}><Text style={styles.mutedText}>{courses.length} {courses.length === 1 ? 'course' : 'courses'}</Text><Text style={styles.quietText}>Tap a course to view its files</Text></View>
      {courses.map((course: Course) => {
        const items = resources.filter((r: Resource) => r.course === course.name);
        const isExpanded = expandedCourse === course.name || !expandedCourse;
        return <Card key={course.id} style={{ padding: 0, overflow: 'hidden' }}>
          <Pressable onPress={() => setExpandedCourse(isExpanded ? '__none__' : course.name)} style={styles.courseHeader}>
            <View style={[styles.courseDot, { backgroundColor: course.color }]} /><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{course.name}</Text><Text style={styles.quietText}>{course.workload} workload</Text></View><Text style={styles.mutedText}>{items.length} {items.length === 1 ? 'file' : 'files'}</Text><Text style={styles.rowChevron}>{isExpanded ? '⌃' : '⌄'}</Text>
          </Pressable>
          {isExpanded && <Reveal style={{ width: '100%' }}><View style={styles.courseFiles}>
            <Pressable onPress={() => onUpload(course.name)} style={styles.uploadBox}><Text style={styles.uploadGlyph}>＋</Text><Text style={styles.uploadTitle}>Upload files</Text><Text style={styles.quietText}>PDF · Word · PPT · Excel · Images</Text></Pressable>
            {items.length ? items.filter((r: Resource) => resources.some((visible: Resource) => visible.id === r.id)).map((r: Resource) => <View key={r.id} style={styles.resourceRow}><Pressable onPress={() => onOpen(r)} style={styles.resourcePreviewButton} accessibilityRole="button" accessibilityLabel={`Preview ${r.name}`}><ResourcePreview resource={r} /></Pressable><Pressable onPress={() => onOpen(r)} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`Open ${r.name}`}><Text style={styles.cardTitle} numberOfLines={1}>{r.name}</Text><Text style={styles.quietText}>{r.size} · tap to open</Text></Pressable><Pressable onPress={() => onDelete(r.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Delete ${r.name}`}><Text style={styles.removeText}>×</Text></Pressable></View>) : <Text style={styles.noFilesText}>No files yet for this course</Text>}
          </View></Reveal>}
        </Card>;
      })}
      {allResources.length > 0 && <Text style={styles.helperText}>{allResources.length} files saved across your courses</Text>}
    </>}
  </>;
}

function ResourcePreview({ resource }: { resource: Resource }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const isImage = Boolean(resource.mimeType?.startsWith('image/') && resource.storagePath);
  useEffect(() => {
    let active = true;
    if (isImage && resource.storagePath) {
      createStudentFileUrl(resource.storagePath, 3600)
        .then((url) => { if (active) setImageUrl(url); })
        .catch(() => {});
    }
    return () => { active = false; };
  }, [isImage, resource.storagePath]);

  if (imageUrl) return <Image source={{ uri: imageUrl }} style={styles.filePreviewImage} resizeMode="cover" accessibilityLabel={`Preview of ${resource.name}`} />;

  const extension = resource.name.match(/\.([^.]+)$/)?.[1]?.toUpperCase() ?? 'FILE';
  const typeLabel = extension.length <= 4 ? extension : extension.slice(0, 4);
  const color = resource.mimeType?.includes('pdf') ? C.orange
    : resource.mimeType?.includes('spreadsheet') || resource.mimeType?.includes('excel') ? C.green
      : resource.mimeType?.includes('presentation') || resource.mimeType?.includes('powerpoint') ? C.pink
        : C.teal;
  return <View style={styles.filePreviewFallback}>
    <Text style={[styles.filePreviewGlyph, { color }]}>{resource.mimeType?.includes('pdf') ? '▤' : '▧'}</Text>
    <Text style={[styles.filePreviewType, { color }]} numberOfLines={1}>{typeLabel}</Text>
  </View>;
}

function AddCourseScreen({ name, setName, workload, setWorkload, courses, onAdd, onRemoveCourse, onCancel }: any) {
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.formPage} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onCancel}><Text style={styles.backText}>‹  Resources</Text></Pressable>
      <Brand large /><Text style={styles.brandTagline}>Your academic space</Text>
      <View style={{ alignItems: 'center', marginTop: 26 }}><View style={styles.progressDots}><View style={styles.progressDotActive} /><View style={styles.progressDotIdle} /></View><Text style={styles.authTitle}>Add your courses 📚</Text><Text style={[styles.authSubtitle, { textAlign: 'center' }]}>Add the courses you're taking this semester so Sapient can personalise your experience.</Text></View>
      <View style={styles.tipBox}><Text style={{ color: C.teal, fontWeight: '700' }}>✦  PRO TIP</Text><Text style={styles.tipText}>Add each course and set its workload. You can change these any time.</Text></View>
      {courses.length > 0 && <View style={{ gap: 9, marginBottom: 14 }}>{courses.map((course: Course) => <Card key={course.id} style={styles.savedCourse}><View style={[styles.courseDot, { backgroundColor: course.color }]} /><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{course.name}</Text><Text style={styles.quietText}>Workload · {course.workload}</Text></View><Pressable onPress={() => onRemoveCourse(course)} hitSlop={8}><Text style={styles.removeText}>×</Text></Pressable></Card>)}</View>}
      <Card><Field label="COURSE NAME" value={name} onChangeText={setName} placeholder="e.g. Introduction to Programming" /><Label>WORKLOAD</Label><View style={styles.workloadRow}>{(['light', 'medium', 'heavy'] as const).map((v) => <Pressable key={v} onPress={() => setWorkload(v)} style={[styles.workloadChoice, workload === v && styles.workloadChoiceActive]}><Text style={[styles.workloadText, workload === v && { color: v === 'heavy' ? C.orange : C.text }]}>{v}</Text></Pressable>)}</View><Button title="＋ Add course" onPress={onAdd} style={{ marginTop: 10 }} /></Card>
      <Button title="Done" secondary onPress={onCancel} style={{ marginTop: 12 }} />
    </ScrollView>
  </KeyboardAvoidingView>;
}

function StudyScreen({ methods, focusMethod, setFocusMethod, duration, setDuration, seconds, running, setRunning, tasks, taskDraft, setTaskDraft, onAddTask, onToggleTask, sessions, setSessions, onGenerate, minutesStudied }: any) {
  const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const [custom, setCustom] = useState('');
  const pulse = useRef(new Animated.Value(1)).current;
  const done = tasks.filter((t: any) => t.done).length;
  useEffect(() => {
    if (!running) {
      Animated.spring(pulse, { toValue: 1, speed: 18, bounciness: 3, useNativeDriver: true }).start();
      return;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.045, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse, running]);
  return <>
    <PageHeading eyebrow="FOCUS & PROGRESS" title="Study" />
    <Card style={styles.timerCard}>
      <Text style={styles.eyebrow}>FOCUS TIMER</Text>
      <Text style={[styles.label, { marginTop: 18 }]}>STUDY METHOD</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 7 }}>
        {methods.map((method: string) => <Pressable key={method} onPress={() => setFocusMethod(method)} style={[styles.methodChip, focusMethod === method && styles.methodChipActive]}><Text style={[styles.methodText, focusMethod === method && { color: C.text }]}>{method}</Text></Pressable>)}
      </ScrollView>
      <Animated.View style={[styles.timerRing, { transform: [{ scale: pulse }] }]}><Text style={styles.timerDigits}>{time}</Text><Text style={[styles.timerState, running && { color: C.teal }]}>{running ? 'IN THE ZONE' : 'READY'}</Text></Animated.View>
      <View style={styles.durationControls}><Text style={styles.mutedText}>Set timer</Text>{[25, 45, 60].map((n) => <Pressable key={n} onPress={() => { setDuration(n); setCustom(''); }} style={[styles.durationChip, duration === n && !custom && styles.durationChipActive]}><Text style={styles.durationText}>{n} min</Text></Pressable>)}<TextInput value={custom} onChangeText={(v) => { const n = Number(v.replace(/\D/g, '').slice(0, 3)); setCustom(v.replace(/\D/g, '').slice(0, 3)); if (n > 0) setDuration(n); }} keyboardType="number-pad" placeholder="Custom" placeholderTextColor={C.quiet} style={[styles.durationChip, { width: 82, color: C.text }]} />
      </View>
      <View style={styles.timerButtons}><Button title={running ? 'Pause' : 'Start focus'} onPress={() => setRunning((v: boolean) => !v)} style={{ flex: 1 }} /><Button title="Reset" secondary onPress={() => { setRunning(false); setDuration(duration); }} style={{ width: 104 }} /></View>
      <Text style={styles.helperText}>Starting a focus session counts toward your weekly study goal.</Text>
    </Card>
    <Card>
      <View style={styles.sectionHeader}><Text style={styles.eyebrow}>TODAY'S TASKS</Text><Text style={styles.quietText}>{done}/{tasks.length}</Text></View>
      {tasks.length ? tasks.map((task: any) => <Pressable key={task.id} onPress={() => onToggleTask(task.id)} style={styles.taskRow}><View style={[styles.checkbox, task.done && styles.checkboxDone]}><Text style={{ color: C.text }}>{task.done ? '✓' : ''}</Text></View><Text style={[styles.taskText, task.done && styles.taskDone]}>{task.text}</Text></Pressable>) : <Text style={styles.emptyTaskText}>No tasks yet — add one below ↓</Text>}
      <View style={styles.addTaskRow}><TextInput value={taskDraft} onChangeText={setTaskDraft} placeholder="＋ Add a study task..." placeholderTextColor={C.quiet} onSubmitEditing={onAddTask} style={styles.taskInput} /><Pressable onPress={onAddTask} style={styles.addTaskButton}><Text style={styles.addTaskText}>Add</Text></Pressable></View>
    </Card>
    <Card>
      <View style={styles.sectionHeader}><View><Text style={styles.eyebrow}>PERSONAL STUDY PLAN</Text><Text style={styles.mutedText}>Built around your classes and workload</Text></View><Pill title="✦ Plan" color={C.accent} /></View>
      {sessions.length ? sessions.map((session: StudySession) => <View key={session.id} style={styles.sessionRow}><View style={[styles.classVerticalAccent, { backgroundColor: C.pink }]} /><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{session.course}</Text><Text style={styles.mutedText}>{session.day} · {session.time}</Text></View><Text style={styles.tealText}>{session.minutes} min</Text></View>) : <EmptyState icon="✧" title="Let's build your study schedule" body="Generate a simple plan based on your course list and workloads." />}
      <Button title={sessions.length ? '↻ Regenerate plan' : '✦ Generate study plan'} onPress={onGenerate} style={{ marginTop: 10 }} />
      {sessions.length > 0 && <Pressable onPress={() => setSessions([])} style={{ padding: 12, alignItems: 'center' }}><Text style={styles.quietText}>Clear plan</Text></Pressable>}
    </Card>
    <View style={styles.twoColumns}><Card style={{ flex: 1 }}><Text style={styles.eyebrow}>STUDY STREAK</Text><Text style={styles.statNumber}>{minutesStudied ? '1' : '0'} <Text style={{ fontSize: 16, color: C.muted }}>days</Text></Text><Text style={styles.mutedText}>{minutesStudied ? 'Session completed today' : 'Start a timer to begin'}</Text></Card><Card style={{ flex: 1 }}><Text style={styles.eyebrow}>THIS WEEK</Text><Text style={styles.statNumber}>{Math.floor(minutesStudied / 60)}h {minutesStudied % 60}m</Text><Text style={styles.mutedText}>Goal: 12h / week</Text><ProgressBar value={minutesStudied / 720 * 100} color={C.accent} /></Card></View>
  </>;
}

function SettingsScreen({ name, university, notifyClasses, onToggleClasses, notifyStudy, onToggleStudy, onBack, onProfile, onLogout, onClear }: any) {
  return <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.contentPad} showsVerticalScrollIndicator={false}>
    <View style={styles.topBar}><Pressable onPress={onBack}><Text style={styles.backText}>‹  Back</Text></Pressable><Brand /></View>
    <PageHeading eyebrow="ACCOUNT & PREFERENCES" title="Settings" />
    <Pressable onPress={onProfile} style={styles.profileCard}><View style={styles.avatarLarge}><Text style={styles.avatarText}>{(name || 'A').charAt(0).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{name}</Text><Text style={styles.mutedText}>{university}</Text></View><Text style={styles.rowChevron}>›</Text></Pressable>
    <Text style={styles.sectionLabel}>ACCOUNT</Text><Card style={{ padding: 0, overflow: 'hidden' }}><SettingRow icon="♙" title="Edit profile" subtitle="Update your name and semester details" onPress={onProfile} /><SettingRow icon="✉" title="Email address" subtitle="Manage your account email" /></Card>
    <Text style={styles.sectionLabel}>NOTIFICATIONS</Text><Card style={{ padding: 0, overflow: 'hidden' }}><SettingRow icon="♧" title="Class reminders" subtitle="A reminder 15 minutes before each class" toggle={notifyClasses} onToggle={() => onToggleClasses(!notifyClasses)} /><SettingRow icon="▤" title="Study session alerts" subtitle="A reminder 10 minutes before each planned session" toggle={notifyStudy} onToggle={() => onToggleStudy(!notifyStudy)} /></Card>
    <Text style={styles.sectionLabel}>PLAN</Text><Card><Text style={styles.cardTitle}>Free plan</Text><Text style={styles.mutedText}>Timetable, course resources and focus timer</Text><Text style={styles.planLine}>✓  Study tracking and course uploads</Text><Text style={styles.planLine}>✓  3 study plan generations each month</Text><Text style={styles.planMuted}>＋  Upgrade for reports and more storage</Text><Button title="Explore Sapient Pro ✨" onPress={() => Alert.alert('Coming soon', 'Sapient Pro plans will be available soon.')} style={{ marginTop: 14 }} /></Card>
    <Text style={styles.sectionLabel}>DATA & PRIVACY</Text><Card style={{ padding: 0, overflow: 'hidden' }}><SettingRow icon="⌫" title="Clear all resources" subtitle="Remove uploaded files from your library" danger onPress={onClear} /><SettingRow icon="⇥" title="Log out" subtitle="Return to the welcome screen" danger onPress={onLogout} /></Card>
    <Text style={styles.footerNote}>Sapient v1.0 · Your academic space</Text>
  </ScrollView>;
}

function SettingRow({ icon, title, subtitle, onPress, toggle, onToggle, danger }: any) {
  return <Pressable onPress={onToggle || onPress} style={styles.settingRow}><Text style={[styles.settingIcon, danger && { color: C.red }]}>{icon}</Text><View style={{ flex: 1 }}><Text style={[styles.cardTitle, danger && { color: C.red }]}>{title}</Text>{subtitle ? <Text style={styles.mutedText}>{subtitle}</Text> : null}</View>{typeof toggle === 'boolean' ? <View style={[styles.switch, toggle && styles.switchOn]}><View style={[styles.switchThumb, toggle && styles.switchThumbOn]} /></View> : <Text style={styles.rowChevron}>›</Text>}</Pressable>;
}

function ProfileScreen({ name, setName, email, university, setUniversity, courseOfStudy, setCourseOfStudy, semester, setSemester, semesterStart, setSemesterStart, semesterEnd, setSemesterEnd, onPickUniversity, onBack, onSave }: any) {
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.formPage} keyboardShouldPersistTaps="handled">
      <View style={styles.topBar}><Pressable onPress={onBack}><Text style={styles.backText}>‹  Back</Text></Pressable><Brand /></View>
      <View style={{ alignItems: 'center', marginBottom: 26 }}><View style={styles.avatarProfile}><Text style={styles.avatarText}>{(name || 'A').charAt(0).toUpperCase()}</Text></View><Text style={styles.profileName}>{name}</Text><Text style={styles.mutedText}>{university} · {email}</Text></View>
      <PageHeading eyebrow="PROFILE" title="Your details" />
      <Card>
        <Field label="FULL NAME" value={name} onChangeText={setName} placeholder="Your name" />
        <Field label="COURSE OF STUDY" value={courseOfStudy} onChangeText={setCourseOfStudy} placeholder="e.g. Information Technology" />
        <Field label="CURRENT SEMESTER" value={semester} onChangeText={setSemester} placeholder="e.g. Semester 2 — Year 2" />
        <Field label="UNIVERSITY" value={university} onPress={onPickUniversity} placeholder="Select university" right={<UniversityChevron />} />
        <Field label="SEMESTER START DATE" value={semesterStart} onChangeText={setSemesterStart} placeholder="dd/mm/yyyy" />
        <Field label="SEMESTER END DATE" value={semesterEnd} onChangeText={setSemesterEnd} placeholder="dd/mm/yyyy" />
        <Text style={styles.helperText}>Update your dates at the start of each semester to keep your progress accurate.</Text>
        <Button title="Save changes" onPress={onSave} />
      </Card>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  appLayer: { flex: 1, zIndex: 1 },
  centerScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26, paddingTop: 44, paddingBottom: 18 },
  brand: { color: C.text, fontSize: 29, fontWeight: '800', letterSpacing: -1.1 },
  brandLarge: { fontSize: 40 },
  brandTagline: { color: C.muted, fontSize: 16, marginTop: 3, marginBottom: 4 },
  welcomeScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingTop: 22, paddingBottom: 28 },
  welcomeHeader: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 },
  privateBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, borderColor: `${C.teal}35`, backgroundColor: `${C.teal}0c`, paddingHorizontal: 10, paddingVertical: 7, gap: 7 },
  privateDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.teal },
  privateBadgeText: { color: C.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  welcomeArt: { width: 236, height: 214, alignItems: 'center', justifyContent: 'center', marginTop: 1, marginBottom: 10 },
  orbGlow: { width: 180, height: 180, borderRadius: 100, backgroundColor: `${C.accent}13`, position: 'absolute', shadowColor: C.accent, shadowOpacity: 0.65, shadowRadius: 48, shadowOffset: { width: 0, height: 0 } },
  orbRing: { width: 170, height: 170, borderRadius: 90, borderWidth: 1, borderColor: `${C.accent}36`, position: 'absolute' },
  welcomeOrb: { width: 126, height: 126, borderRadius: 43, borderWidth: 1, borderColor: `${C.accent}90`, backgroundColor: '#244a38', justifyContent: 'center', alignItems: 'center', shadowColor: C.accent, shadowOpacity: 0.48, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  orbSymbol: { color: '#c9f4db', fontSize: 53, textShadowColor: `${C.accent}aa`, textShadowRadius: 18 },
  artBadge: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: `${C.border}dd`, backgroundColor: '#142b21f5', borderRadius: 13, paddingHorizontal: 10, paddingVertical: 7, shadowColor: '#020906', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  artBadgeTop: { top: 21, right: -1 },
  artBadgeBottom: { bottom: 18, left: -2 },
  artBadgeLabel: { color: C.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  heroEyebrow: { color: C.quiet, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  welcomeTitle: { color: C.text, fontSize: 32, lineHeight: 40, fontWeight: '800', textAlign: 'center', marginTop: 13, letterSpacing: -0.8 },
  welcomeBody: { color: C.muted, fontSize: 17, lineHeight: 25, textAlign: 'center', marginTop: 10, maxWidth: 340 },
  featureRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 21 },
  welcomeActions: { width: '100%', marginTop: 27 },
  loginLink: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 7 },
  pill: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#ffffff07' },
  pillText: { fontSize: 11, fontWeight: '700' },
  button: { minHeight: 54, borderRadius: 17, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accentStrong, borderWidth: 1, borderColor: `${C.accent}aa`, shadowColor: C.accent, shadowOpacity: 0.26, shadowRadius: 15, shadowOffset: { width: 0, height: 7 }, elevation: 7 },
  buttonSecondary: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, shadowOpacity: 0.08, elevation: 2 },
  buttonText: { color: C.text, fontSize: 17, fontWeight: '700' },
  buttonTextSecondary: { color: C.muted },
  linkText: { color: C.muted, fontSize: 16 },
  authScroll: { flexGrow: 1, padding: 24, paddingTop: 18, paddingBottom: 30, justifyContent: 'center' },
  backText: { color: C.muted, fontSize: 16, fontWeight: '600' },
  authBrandBlock: { alignItems: 'center', marginTop: 17, marginBottom: 4 },
  authTitle: { color: C.text, fontSize: 27, lineHeight: 34, fontWeight: '800', textAlign: 'center', marginTop: 28 },
  authSubtitle: { color: C.muted, fontSize: 17, lineHeight: 24, textAlign: 'center', marginTop: 5, marginBottom: 24 },
  label: { color: C.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 7 },
  field: { flexDirection: 'row', minHeight: 54, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.card2, paddingHorizontal: 15 },
  fieldFocused: { borderColor: C.accent, backgroundColor: '#183527', shadowColor: C.accent, shadowOpacity: 0.16, shadowRadius: 9, shadowOffset: { width: 0, height: 0 }, elevation: 2 },
  input: { color: C.text, flex: 1, fontSize: 17, paddingVertical: 13 },
  fieldRight: { color: C.quiet, fontSize: 18, marginLeft: 8 },
  passwordToggle: { width: 40, height: 44, marginRight: -7, alignItems: 'center', justifyContent: 'center' },
  eyeShape: { width: 21, height: 14, borderWidth: 1.8, borderColor: C.muted, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  eyeIris: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.muted },
  eyeSlash: { position: 'absolute', width: 27, height: 2, borderRadius: 1, backgroundColor: C.muted, transform: [{ rotate: '45deg' }] },
  dropdownChevron: { width: 28, height: 40, marginRight: -6, alignItems: 'center', justifyContent: 'center' },
  dropdownChevronLine: { position: 'absolute', width: 9, height: 2.5, borderRadius: 2, backgroundColor: C.muted },
  dropdownChevronLeft: { transform: [{ translateX: -3 }, { translateY: 1 }, { rotate: '45deg' }] },
  dropdownChevronRight: { transform: [{ translateX: 3 }, { translateY: 1 }, { rotate: '-45deg' }] },
  formHint: { color: C.quiet, fontSize: 13, lineHeight: 19, marginTop: -5, marginBottom: 18 },
  backAbsolute: { position: 'absolute', top: 25, left: 24 },
  mailOrb: { width: 96, height: 96, borderRadius: 31, borderWidth: 1, borderColor: `${C.accent}99`, backgroundColor: '#244a38', alignItems: 'center', justifyContent: 'center', marginTop: 42, shadowColor: C.accent, shadowOpacity: 0.34, shadowRadius: 21, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  emailBadge: { borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 24, paddingVertical: 10, paddingHorizontal: 17, marginTop: 18 },
  codeInput: { width: '100%', maxWidth: 360, height: 66, marginTop: 30, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 15, color: C.text, textAlign: 'center', fontSize: 25, letterSpacing: 12 },
  otpRow: { width: '100%', maxWidth: 360, flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 27, position: 'relative' },
  otpCell: { flex: 1, maxWidth: 54, height: 62, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: `${C.card}ee`, alignItems: 'center', justifyContent: 'center' },
  otpCellActive: { borderColor: C.accent, backgroundColor: '#1c3d2d', shadowColor: C.accent, shadowOpacity: 0.23, shadowRadius: 11, shadowOffset: { width: 0, height: 0 }, elevation: 3 },
  otpDigit: { color: C.text, fontSize: 23, fontWeight: '700', fontVariant: ['tabular-nums'] },
  otpHiddenInput: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, opacity: 0.01, color: 'transparent', fontSize: 1 },
  tourHeader: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', position: 'absolute', top: 16 },
  tourScreen: { paddingTop: 70, paddingBottom: 14 },
  skipButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff08', borderColor: C.border, borderWidth: 1, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7 },
  skipText: { color: C.muted, fontWeight: '700', fontSize: 11 },
  tourProgressTop: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  tourStepCount: { color: C.text, fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  tourProgressTrack: { width: '100%', flexDirection: 'row', gap: 6, marginTop: 11 },
  tourProgressSegment: { height: 4, flex: 1, borderRadius: 3 },
  tourContent: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', paddingTop: 5 },
  tourArt: { height: 140, width: '100%', alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  tourGlow: { width: 136, height: 136, borderRadius: 80, position: 'absolute', shadowColor: C.accent, shadowOpacity: 0.7, shadowRadius: 40, shadowOffset: { width: 0, height: 0 } },
  tourOrb: { width: 120, height: 120, borderRadius: 63, borderWidth: 1, alignItems: 'center', justifyContent: 'center', shadowColor: C.accent, shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 7 }, elevation: 5 },
  tourSpark: { position: 'absolute', right: '31%', top: 31, width: 7, height: 7, borderRadius: 4 },
  tourIcon: { fontSize: 47, fontWeight: '700' },
  tourTitle: { color: C.text, fontSize: 29, lineHeight: 36, fontWeight: '800', textAlign: 'center', marginTop: 9, letterSpacing: -0.6, maxWidth: 340 },
  tourBody: { color: C.muted, fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: 7, maxWidth: 350 },
  tipBox: { width: '100%', borderRadius: 17, backgroundColor: `${C.teal}12`, borderColor: `${C.teal}35`, borderWidth: 1, padding: 12, marginTop: 17, alignItems: 'flex-start' },
  tipHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tipLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  tipText: { color: C.muted, fontSize: 13, lineHeight: 18, textAlign: 'left', marginTop: 5 },
  tourFooter: { width: '100%', marginTop: 13, alignItems: 'center' },
  tourFootnote: { color: C.quiet, fontSize: 8, fontWeight: '700', letterSpacing: 1.2, marginTop: 12 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 25 },
  dot: { width: 7, height: 7, borderRadius: 5, backgroundColor: C.quiet },
  mainRoot: { flex: 1 },
  topBar: { minHeight: 61, paddingHorizontal: 20, paddingBottom: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: 22, borderWidth: 1, borderColor: `${C.teal}88`, backgroundColor: '#187459', alignItems: 'center', justifyContent: 'center', shadowColor: C.teal, shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  avatarText: { color: C.text, fontSize: 17, fontWeight: '800' },
  settingsIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff08' },
  contentScroll: { flex: 1 },
  contentPad: { paddingHorizontal: 18, paddingTop: 13, paddingBottom: 25, gap: 15 },
  tabBar: { marginHorizontal: 15, marginBottom: Platform.OS === 'ios' ? 5 : 9, borderRadius: 22, borderWidth: 1, borderColor: `${C.border}dd`, backgroundColor: '#10241bee', padding: 5, flexDirection: 'row', justifyContent: 'space-between', shadowColor: '#020906', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 9 },
  tabItem: { flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 17 },
  tabItemActiveFill: { borderRadius: 17, backgroundColor: '#286747', borderWidth: 1, borderColor: '#4eaf7b' },
  tabIcon: { color: C.quiet, fontSize: 26, lineHeight: 28, fontWeight: '700' },
  studyTabIcon: { fontSize: 33, lineHeight: 35 },
  tabLabel: { color: C.quiet, fontSize: 14, lineHeight: 17, marginTop: 2, fontWeight: '700' },
  card: { backgroundColor: `${C.card}f5`, borderColor: `${C.border}dd`, borderWidth: 1, borderRadius: 21, padding: 17, shadowColor: '#020906', shadowOpacity: 0.22, shadowRadius: 15, shadowOffset: { width: 0, height: 7 }, elevation: 4 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  greeting: { color: C.text, fontSize: 27, lineHeight: 35, fontWeight: '800', marginTop: 6, letterSpacing: -0.5 },
  subGreeting: { color: C.muted, fontSize: 15, lineHeight: 21, marginTop: 4 },
  datePill: { backgroundColor: `${C.teal}12`, borderWidth: 1, borderColor: `${C.teal}42`, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12, maxWidth: 84 },
  dateText: { color: C.teal, fontSize: 10, fontWeight: '800', textAlign: 'center', letterSpacing: 1 },
  setupCard: { backgroundColor: '#193629', borderColor: '#37654a' },
  setupTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: C.text, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  mutedText: { color: C.muted, fontSize: 14, lineHeight: 20, marginTop: 3 },
  setupCount: { color: C.text, fontSize: 24, fontWeight: '800' },
  progressTrack: { height: 6, borderRadius: 4, backgroundColor: '#30483a', overflow: 'hidden', marginTop: 15 },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: C.teal },
  setupSteps: { gap: 8, marginTop: 14 },
  setupStep: { borderRadius: 14, borderWidth: 1, borderColor: `${C.border}cc`, backgroundColor: `${C.card2}aa`, minHeight: 49, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10 },
  setupStepDone: { borderColor: `${C.teal}55`, backgroundColor: `${C.teal}14` },
  stepIcon: { color: C.teal, fontSize: 17, fontWeight: '700' },
  stepText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  pageHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 9, marginBottom: 1 },
  eyebrow: { color: C.quiet, fontSize: 11, letterSpacing: 1.1, fontWeight: '700' },
  pageTitle: { color: C.text, fontSize: 23, lineHeight: 30, fontWeight: '800', marginTop: 3 },
  headerAction: { borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 9 },
  headerActionText: { color: C.muted, fontSize: 13, fontWeight: '700' },
  dashboardEmpty: { minHeight: 180, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  emptySymbol: { color: C.quiet, fontSize: 34, marginBottom: 9 },
  emptyTitle: { color: C.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptyBody: { color: C.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 5, maxWidth: 290 },
  emptyState: { minHeight: 168, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9, paddingVertical: 17 },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card2, marginBottom: 12 },
  classRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7 },
  classAccent: { width: 4, alignSelf: 'stretch', minHeight: 42, borderRadius: 4 },
  rowChevron: { color: C.quiet, fontSize: 24, paddingHorizontal: 3 },
  inlineLink: { color: '#9be9bc', fontSize: 14, fontWeight: '700', marginTop: 12 },
  twoColumns: { flexDirection: 'row', gap: 10 },
  statNumber: { color: C.text, fontSize: 27, fontWeight: '800', marginTop: 9 },
  studyPrompt: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quote: { color: C.text, fontSize: 15, fontWeight: '600', lineHeight: 23, marginTop: 17, marginBottom: 5 },
  sectionIntro: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  dayChip: { minWidth: 47, height: 52, borderRadius: 13, borderWidth: 1, borderColor: C.border, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
  dayChipActive: { borderColor: C.accent, backgroundColor: `${C.accent}45` },
  dayChipText: { color: C.muted, fontWeight: '700', fontSize: 14 },
  dayChipCount: { color: C.quiet, fontSize: 10, marginTop: 2 },
  timetableClass: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeBlock: { width: 57 },
  timeText: { color: C.text, fontWeight: '700', fontSize: 14 },
  timeDash: { color: C.quiet, fontSize: 10, marginTop: 3 },
  classVerticalAccent: { width: 3, minHeight: 46, borderRadius: 4, backgroundColor: C.accent },
  removeText: { color: C.red, fontSize: 26, paddingHorizontal: 5 },
  uploadStrip: { borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 15, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 11 },
  uploadGlyph: { color: C.accent, fontSize: 26, fontWeight: '600' },
  fileCard: { marginTop: 11, flexDirection: 'row', alignItems: 'center', gap: 11 },
  resourcePreviewButton: { width: 58, height: 62, borderRadius: 10, overflow: 'hidden' },
  filePreviewFallback: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center', padding: 4 },
  filePreviewImage: { width: 58, height: 62, borderRadius: 10, backgroundColor: C.card2 },
  filePreviewGlyph: { fontSize: 25, fontWeight: '700' },
  filePreviewType: { fontSize: 10, fontWeight: '800', marginTop: 1, letterSpacing: 0.4 },
  fileIcon: { color: C.teal, fontSize: 27 },
  helperText: { color: C.quiet, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 2, paddingHorizontal: 10 },
  formPage: { padding: 19, paddingTop: 12, paddingBottom: 25, gap: 12 },
  choicePill: { borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: C.card2 },
  choicePillActive: { borderColor: C.accent, backgroundColor: `${C.accent}44` },
  choiceText: { color: C.muted, fontSize: 12, fontWeight: '600' },
  dayWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  daySmall: { minWidth: 42, paddingVertical: 8, paddingHorizontal: 9, alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.card2 },
  daySmallActive: { backgroundColor: C.accent, borderColor: C.accent },
  daySmallText: { color: C.muted, fontSize: 11, fontWeight: '700' },
  progressDots: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 1 },
  progressDotActive: { width: 25, height: 7, borderRadius: 5, backgroundColor: C.accent },
  progressDotIdle: { width: 7, height: 7, borderRadius: 5, backgroundColor: C.teal },
  savedCourse: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  courseDot: { width: 11, height: 11, borderRadius: 6 },
  tealText: { color: C.teal, fontSize: 13, fontWeight: '700' },
  workloadRow: { flexDirection: 'row', gap: 8, marginBottom: 9 },
  workloadChoice: { borderWidth: 1, borderColor: C.border, backgroundColor: C.card2, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  workloadChoiceActive: { borderColor: C.orange, backgroundColor: `${C.orange}18` },
  workloadText: { color: C.quiet, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  courseCountLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: -5 },
  quietText: { color: C.quiet, fontSize: 13, lineHeight: 19, marginTop: 3 },
  courseHeader: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  courseFiles: { borderTopWidth: 1, borderTopColor: C.border, padding: 12 },
  uploadBox: { minHeight: 83, borderWidth: 1, borderStyle: 'dashed', borderColor: `${C.accent}80`, borderRadius: 14, backgroundColor: `${C.accent}14`, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  uploadTitle: { color: '#9be9bc', fontSize: 15, fontWeight: '700', marginTop: 2 },
  noFilesText: { textAlign: 'center', color: C.quiet, fontSize: 13, paddingVertical: 12 },
  resourceRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: `${C.bg}66`, padding: 11, borderRadius: 12, marginTop: 7 },
  timerCard: { alignItems: 'stretch' },
  methodChip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 18, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  methodChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  methodText: { color: C.muted, fontSize: 11, fontWeight: '700' },
  timerRing: { alignSelf: 'center', width: 164, height: 164, borderRadius: 85, borderWidth: 7, borderColor: '#3c936d', alignItems: 'center', justifyContent: 'center', marginTop: 19, marginBottom: 13, backgroundColor: `${C.bg}77` },
  timerDigits: { color: C.text, fontSize: 37, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timerState: { color: C.quiet, fontSize: 10, fontWeight: '700', letterSpacing: 1.1, marginTop: 2 },
  durationControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' },
  durationChip: { borderRadius: 16, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, paddingHorizontal: 9, paddingVertical: 7, fontSize: 11, color: C.muted, textAlign: 'center', overflow: 'hidden' },
  durationChipActive: { borderColor: C.accent, backgroundColor: `${C.accent}33` },
  durationText: { color: C.muted, fontSize: 11, fontWeight: '600' },
  timerButtons: { flexDirection: 'row', gap: 9, marginTop: 13 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emptyTaskText: { color: C.quiet, textAlign: 'center', paddingVertical: 19, fontSize: 13 },
  addTaskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 11 },
  taskInput: { flex: 1, minHeight: 43, backgroundColor: C.card2, borderRadius: 12, paddingHorizontal: 12, color: C.text, fontSize: 14, borderWidth: 1, borderColor: C.border },
  addTaskButton: { paddingHorizontal: 13, height: 43, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent, borderRadius: 12 },
  addTaskText: { color: C.text, fontWeight: '700', fontSize: 12 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9 },
  checkbox: { height: 21, width: 21, borderRadius: 6, borderWidth: 1, borderColor: C.quiet, alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: C.teal, borderColor: C.teal },
  taskText: { color: C.text, fontSize: 14, flex: 1 },
  taskDone: { color: C.quiet, textDecorationLine: 'line-through' },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  profileCard: { borderRadius: 17, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  avatarLarge: { width: 48, height: 48, borderRadius: 25, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { color: C.muted, fontSize: 11, letterSpacing: 1, fontWeight: '700', marginTop: 8, marginBottom: -7, marginLeft: 2 },
  settingRow: { minHeight: 66, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  settingIcon: { width: 27, textAlign: 'center', color: C.muted, fontSize: 20 },
  switch: { width: 43, height: 25, borderRadius: 15, backgroundColor: C.quiet, padding: 3, justifyContent: 'center' },
  switchOn: { backgroundColor: C.accent },
  switchThumb: { width: 19, height: 19, borderRadius: 10, backgroundColor: C.text },
  switchThumbOn: { alignSelf: 'flex-end' },
  planLine: { color: C.teal, fontSize: 13, marginTop: 11 },
  planMuted: { color: C.quiet, fontSize: 13, marginTop: 9 },
  footerNote: { color: C.quiet, fontSize: 11, textAlign: 'center', paddingVertical: 15 },
  avatarProfile: { width: 80, height: 80, borderRadius: 42, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center', marginTop: 9, marginBottom: 9 },
  profileName: { color: C.text, fontSize: 20, fontWeight: '800' },
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#020906bb' },
  sheet: { backgroundColor: C.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, borderWidth: 1, borderColor: C.border },
  sheetTitle: { color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 10 },
  optionRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border },
  optionText: { color: C.text, fontSize: 15 },
});
