import Storage from 'expo-sqlite/kv-store';
import { router } from 'expo-router';
import { act, cleanup, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { AppState, Text } from 'react-native';

import AuthLayout from '@/app/(auth)/_layout';
import LoginScreen from '@/app/(auth)/login';
import TabsLayout from '@/app/(tabs)/_layout';
import * as NativeIntent from '@/app/+native-intent';
import NotFoundScreen from '@/app/+not-found';
import RootLayout from '@/app/_layout';
import AuthCallback from '@/app/auth/callback';
import LessonScreen from '@/app/lesson/[id]';
import LevelScreen from '@/app/level/[id]';
import ResetPasswordScreen from '@/app/reset-password';
import type { CourseDetail, LessonDetail } from '@/types/contracts';

import { REMINDER_ID } from '@/features/notifications/reminders';
import { resetNotificationRoutingForTests } from '@/features/notifications/useNotificationRouting';
import { DEFAULT_REMINDER, usePreferencesStore } from '@/stores/preferences-store';

import { PENDING_HREF_KEY, PENDING_HREF_TTL_MS, resetPendingHrefForTests } from '../pending-href';

type AuthListener = (event: string, session: unknown) => void;

const session = { access_token: 't', user: { id: 'u1', email: 'a@b.co' } };

let mockSession: typeof session | null = null;
let mockSignedOutAtLaunch = false;
const mockListeners = new Set<AuthListener>();

function mockEmit(event: string): void {
  mockListeners.forEach((listener) => listener(event, mockSession));
}

const mockAuth = {
  getSession: jest.fn(async () => ({ data: { session: mockSession } })),
  onAuthStateChange: jest.fn((cb: AuthListener) => {
    mockListeners.add(cb);
    // auth-js emits SIGNED_OUT during init when the stored refresh token fails.
    if (mockSignedOutAtLaunch) void Promise.resolve().then(() => cb('SIGNED_OUT', null));
    return { data: { subscription: { unsubscribe: () => mockListeners.delete(cb) } } };
  }),
  signInWithPassword: jest.fn(async () => {
    mockSession = session;
    mockEmit('SIGNED_IN');
    return { error: null };
  }),
};

jest.mock('@/lib/supabase/client', () => ({
  getSupabase: () => ({ auth: mockAuth }),
  getAccessToken: jest.fn(async () => null),
}));

let mockContentSource: 'legacy' | 'cms' = 'legacy';
jest.mock('@/lib/env', () => {
  const actual = jest.requireActual('@/lib/env');
  return { ...actual, getEnv: () => ({ ...actual.getEnv(), contentSource: mockContentSource }) };
});

const LESSON = '0b6f1f6e-1111-4c1e-9f00-000000000001';
const LEVEL = '0b6f1f6e-2222-4c1e-9f00-000000000002';
const COURSE = '0b6f1f6e-3333-4c1e-9f00-000000000003';

const mockGetLesson = jest.fn(
  async (id: string): Promise<LessonDetail> => ({
    id,
    module_id: LEVEL,
    title: 'What is a qubit?',
    content: null,
    lesson_type: 'text',
    is_pro: false,
    concepts: [],
  })
);
// A function, not a const: jest.mock factories are hoisted above the id constants.
function mockCourse(): CourseDetail {
  return {
    id: COURSE,
    title: 'Quantum basics',
    description: null,
    difficulty: 'beginner',
    modules: [{ id: LEVEL, title: 'Superposition', order_index: 0, lessons: [] }],
  };
}
jest.mock('@/lib/api/endpoints/learning', () => ({
  listCourses: jest.fn(async () => [mockCourse()]),
  getCourse: jest.fn(async () => mockCourse()),
  getLesson: (id: string) => mockGetLesson(id),
  getProgress: jest.fn(async () => []),
  updateLessonProgress: jest.fn(),
}));

const stub = (label: string) =>
  function Stub() {
    return <Text>{label}</Text>;
  };

// The real root layout, guards, auth screens and deep-link routes; tab
// screens are stubs.
const routes = {
  _layout: RootLayout,
  '+native-intent': NativeIntent,
  '+not-found': NotFoundScreen,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': stub('Home screen'),
  '(tabs)/learn': stub('Learn screen'),
  '(tabs)/build': stub('Build screen'),
  '(tabs)/tutor': stub('Tutor screen'),
  '(tabs)/profile': stub('Profile screen'),
  '(auth)/_layout': AuthLayout,
  '(auth)/login': LoginScreen,
  '(auth)/signup': stub('Signup screen'),
  '(auth)/forgot-password': stub('Forgot screen'),
  'lesson/[id]': LessonScreen,
  'level/[id]': LevelScreen,
  'tutor/history': stub('History screen'),
  'reset-password': ResetPasswordScreen,
  'auth/callback': AuthCallback,
};

async function open(url: string) {
  const result = renderRouter(routes, { initialUrl: url });
  await result;
  // Not `result` itself: it is a thenable (RNTL's async render), so returning
  // it from an async function would unwrap it and drop the router helpers.
  return { getPathname: () => result.getPathname(), getRouterState: () => result.getRouterState() };
}

async function signInWithEmail() {
  await fireEvent.changeText(await screen.findByLabelText('Email'), 'a@b.co');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'secret');
  await fireEvent.press(screen.getByText('Sign in'));
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockSession = null;
  mockSignedOutAtLaunch = false;
  mockContentSource = 'legacy';
  mockListeners.clear();
  resetPendingHrefForTests();
  resetNotificationRoutingForTests();
  usePreferencesStore.setState({ reminder: DEFAULT_REMINDER, reminderBlocked: false });
  await Storage.removeItem(PENDING_HREF_KEY);
});

function tapNotification(url: string) {
  const notifications = jest.requireMock('expo-notifications');
  notifications.__respond({
    actionIdentifier: notifications.DEFAULT_ACTION_IDENTIFIER,
    notification: { date: Date.now(), request: { identifier: REMINDER_ID, content: { data: { url } }, trigger: null } },
  });
}

describe('deep links, signed in', () => {
  beforeEach(() => {
    mockSession = session;
  });

  it.each([
    ['/', 'Home screen', '/'],
    ['/learn', 'Learn screen', '/learn'],
    ['/build', 'Build screen', '/build'],
    ['/tutor', 'Tutor screen', '/tutor'],
    ['/profile', 'Profile screen', '/profile'],
  ])('opens %s', async (url, text, pathname) => {
    const result = await open(url);
    expect(await screen.findByText(text)).toBeTruthy();
    expect(result.getPathname()).toBe(pathname);
  });

  it('opens a lesson', async () => {
    const result = await open(`/lesson/${LESSON}`);
    expect(await screen.findByText('What is a qubit?')).toBeTruthy();
    expect(result.getPathname()).toBe(`/lesson/${LESSON}`);
  });

  it('opens a level, with or without a course id', async () => {
    await open(`/level/${LEVEL}?courseId=${COURSE}`);
    expect(await screen.findByText('Superposition')).toBeTruthy();
    await cleanup();
    await open(`/level/${LEVEL}`);
    expect(await screen.findByText('Superposition')).toBeTruthy();
  });

  it.each([`/lesson/not-a-uuid`, `/lesson/payload:12`, `/level/1;drop`, `/lesson/${LESSON}?courseId=..%2F`])(
    'rejects the invalid id in %s without fetching',
    async (url) => {
      await open(url);
      expect(await screen.findByText('Link not supported')).toBeTruthy();
      expect(mockGetLesson).not.toHaveBeenCalled();
    }
  );

  it('sends the OAuth callback home', async () => {
    const result = await open('/auth/callback');
    expect(await screen.findByText('Home screen')).toBeTruthy();
    expect(result.getPathname()).toBe('/');
  });

  it.each(['/quiz/abc', '/circuit/abc'])('shows not-found for the unsupported root %s', async (url) => {
    await open(url);
    expect(await screen.findByText('Link not supported')).toBeTruthy();
    expect(screen.getByText(/isn't supported in the Q-Learn app yet/)).toBeTruthy();
  });
});

describe('study reminder, root layout', () => {
  it('syncs the reminder schedule on a signed-in launch', async () => {
    mockSession = session;
    usePreferencesStore.setState({ reminder: { enabled: true, hour: 18, minute: 30 } });
    await open('/');
    await screen.findByText('Home screen');
    const notifications = jest.requireMock('expo-notifications');
    await waitFor(() =>
      expect(notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: REMINDER_ID, trigger: expect.objectContaining({ hour: 18, minute: 30 }) })
      )
    );
  });

  it('syncs again when the app returns to the foreground', async () => {
    mockSession = session;
    const appStateListeners: ((state: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appStateListeners.push(listener as (state: string) => void);
      return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
    });
    usePreferencesStore.setState({ reminder: { enabled: true, hour: 18, minute: 30 } });
    await open('/');
    await screen.findByText('Home screen');
    const notifications = jest.requireMock('expo-notifications');
    await waitFor(() => expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1));

    // Notifications turned off in Settings while the app was in the background.
    notifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied', granted: false, canAskAgain: false });
    await act(async () => appStateListeners.forEach((listener) => listener('active')));

    await waitFor(() => expect(usePreferencesStore.getState().reminder.enabled).toBe(false));
    expect(usePreferencesStore.getState().reminderBlocked).toBe(true);
    jest.restoreAllMocks();
  });

  it('routes a tap while running', async () => {
    mockSession = session;
    const result = await open('/learn');
    await screen.findByText('Learn screen');
    await act(async () => tapNotification('/'));
    expect(await screen.findByText('Home screen')).toBeTruthy();
    expect(result.getPathname()).toBe('/');
  });

  it('keeps a signed-out tap until after sign-in', async () => {
    const result = await open('/');
    await screen.findByLabelText('Email');
    await act(async () => tapNotification(`/lesson/${LESSON}`));
    await signInWithEmail();
    expect(await screen.findByText('What is a qubit?')).toBeTruthy();
    expect(result.getPathname()).toBe(`/lesson/${LESSON}`);
  });
});

describe('deep links, signed out', () => {
  it('signs in first, then lands on the lesson once', async () => {
    const result = await open(`/lesson/${LESSON}`);
    await signInWithEmail();
    expect(await screen.findByText('What is a qubit?')).toBeTruthy();
    expect(result.getPathname()).toBe(`/lesson/${LESSON}`);
    await waitFor(async () => expect(await Storage.getItem(PENDING_HREF_KEY)).toBeNull());
  });

  it('keeps the link through a launch-time SIGNED_OUT (expired refresh token)', async () => {
    mockSignedOutAtLaunch = true;
    const result = await open(`/lesson/${LESSON}`);
    await signInWithEmail();
    expect(await screen.findByText('What is a qubit?')).toBeTruthy();
    expect(result.getPathname()).toBe(`/lesson/${LESSON}`);
  });

  it('lands on the target after the Google flow routes through auth/callback', async () => {
    const result = await open(`/lesson/${LESSON}`);
    expect(await screen.findByLabelText('Email')).toBeTruthy();
    // Android: the OAuth redirect also reaches the router while signed out.
    await act(async () => router.navigate('/auth/callback?code=x'));
    expect(await screen.findByLabelText('Email')).toBeTruthy();
    // Back to the existing login, not a second one stacked on top.
    const root = result.getRouterState()?.routes[0]?.state;
    expect(root?.routes.map((r) => r.name)).toEqual(['(auth)']);

    await act(async () => {
      mockSession = session;
      mockEmit('SIGNED_IN');
    });
    expect(await screen.findByText('What is a qubit?')).toBeTruthy();
    expect(result.getPathname()).toBe(`/lesson/${LESSON}`);
  });

  it('opens a CMS payload: lesson after sign-in', async () => {
    mockContentSource = 'cms';
    await open('/lesson/payload%3A12');
    await signInWithEmail();
    expect(await screen.findByText('What is a qubit?')).toBeTruthy();
    expect(mockGetLesson).toHaveBeenCalledWith('payload:12');
  });

  it('remembers the link on disk while signed out', async () => {
    await open(`/level/${LEVEL}?courseId=${COURSE}`);
    expect(await screen.findByLabelText('Email')).toBeTruthy();
    const saved = JSON.parse((await Storage.getItem(PENDING_HREF_KEY)) ?? 'null');
    expect(saved.href).toBe(`/level/${LEVEL}?courseId=${COURSE}`);
  });

  it('replays a link opened before a cold start', async () => {
    await Storage.setItem(PENDING_HREF_KEY, JSON.stringify({ href: `/level/${LEVEL}`, savedAt: Date.now() }));
    const result = await open('/');
    await signInWithEmail();
    expect(await screen.findByText('Superposition')).toBeTruthy();
    expect(result.getPathname()).toBe(`/level/${LEVEL}`);
  });

  it('ignores an expired link', async () => {
    const savedAt = Date.now() - PENDING_HREF_TTL_MS - 1;
    await Storage.setItem(PENDING_HREF_KEY, JSON.stringify({ href: `/level/${LEVEL}`, savedAt }));
    const result = await open('/');
    await signInWithEmail();
    expect(await screen.findByText('Home screen')).toBeTruthy();
    expect(result.getPathname()).toBe('/');
  });

  it('keeps the reset-password link working and never stores it', async () => {
    await open('/reset-password');
    expect(await screen.findByText('Request a new link')).toBeTruthy();
    expect(await Storage.getItem(PENDING_HREF_KEY)).toBeNull();
  });

  it('sends the OAuth callback to login and never stores it', async () => {
    await open('/auth/callback');
    expect(await screen.findByLabelText('Email')).toBeTruthy();
    expect(await Storage.getItem(PENDING_HREF_KEY)).toBeNull();
  });

  it('does not store an invalid link', async () => {
    await open('/lesson/not-a-uuid');
    expect(await screen.findByLabelText('Email')).toBeTruthy();
    expect(await Storage.getItem(PENDING_HREF_KEY)).toBeNull();
  });
});
