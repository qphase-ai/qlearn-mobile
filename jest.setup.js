// Deterministic public config for tests; never real values.
process.env.EXPO_PUBLIC_API_URL = 'https://api.test';
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://supabase.test';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// In-memory SecureStore so storage logic is exercised for real.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    __store: store,
    getItemAsync: jest.fn(async (key) => (store.has(key) ? store.get(key) : null)),
    setItemAsync: jest.fn(async (key, value) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key) => {
      store.delete(key);
    }),
  };
});

jest.mock('expo-sqlite/kv-store', () => {
  const store = new Map();
  const api = {
    getItem: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
    setItem: jest.fn(async (k, v) => {
      store.set(k, v);
    }),
    removeItem: jest.fn(async (k) => {
      store.delete(k);
    }),
  };
  return { __esModule: true, default: api, Storage: api, AsyncStorage: api };
});

// Worklets has no native runtime under Jest: use its official mock. It runs
// `scheduleOnRN`/`runOnJS` callbacks on the JS thread via `queueMicrotask`
// (not synchronously, so tests flush them, e.g. with `await act(async () => {})`),
// and it replaces the global `requestAnimationFrame` with a mock that passes
// a timestamp to its callbacks.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

// No native network module under Jest: online by default. Tests drive
// connectivity through TanStack's `onlineManager.setOnline` or `__emit`.
jest.mock('expo-network', () => {
  const listeners = new Set();
  return {
    __emit: (state) => listeners.forEach((l) => l(state)),
    getNetworkStateAsync: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
    addNetworkStateListener: jest.fn((listener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    }),
  };
});

// No native notifications module under Jest. Permission granted by default;
// tests override per case and drive taps through `__respond`.
jest.mock('expo-notifications', () => {
  const responseListeners = new Set();
  return {
    __respond: (response) => responseListeners.forEach((l) => l(response)),
    DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
    SchedulableTriggerInputTypes: { DAILY: 'daily' },
    AndroidImportance: { DEFAULT: 3 },
    IosAuthorizationStatus: { NOT_DETERMINED: 0, DENIED: 1, AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(async () => null),
    getPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true, canAskAgain: true, expires: 'never' })),
    requestPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true, canAskAgain: true, expires: 'never' })),
    scheduleNotificationAsync: jest.fn(async (request) => request.identifier ?? 'id'),
    cancelScheduledNotificationAsync: jest.fn(async () => undefined),
    getLastNotificationResponse: jest.fn(() => null),
    clearLastNotificationResponse: jest.fn(),
    addNotificationResponseReceivedListener: jest.fn((listener) => {
      responseListeners.add(listener);
      return { remove: () => responseListeners.delete(listener) };
    }),
  };
});
