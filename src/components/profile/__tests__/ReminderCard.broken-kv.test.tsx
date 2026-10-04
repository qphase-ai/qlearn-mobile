import { fireEvent, render, screen } from '@testing-library/react-native';

import { usePreferencesStore } from '@/stores/preferences-store';

import { ReminderCard } from '../ReminderCard';

// Reading the persisted preferences fails, so zustand never reports them
// hydrated. The card must not wait on that forever.
jest.mock('expo-sqlite/kv-store', () => {
  const api = {
    getItem: jest.fn(async () => {
      throw new Error('disk I/O');
    }),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  };
  return { __esModule: true, default: api, Storage: api, AsyncStorage: api };
});

it('stays usable when the preferences restore fails', async () => {
  expect(usePreferencesStore.persist.hasHydrated()).toBe(false);
  await render(<ReminderCard />);
  await fireEvent(screen.getByLabelText('Daily study reminder'), 'valueChange', true);

  expect(await screen.findByText('Every day at 19:00.')).toBeTruthy();
  expect(screen.getByLabelText('Daily study reminder').props.disabled).toBe(false);
});

it('renders a malformed stored preference as off', async () => {
  usePreferencesStore.setState({ reminder: 'garbage' as never });
  await render(<ReminderCard />);
  expect(screen.getByText('Off. Turn it on to get a reminder at 19:00.')).toBeTruthy();
});
