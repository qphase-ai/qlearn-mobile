import { onlineManager } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { setupOnlineManager } from '@/lib/query/online';

import { OfflineBanner } from '../OfflineBanner';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const network = jest.requireMock('expo-network') as { __emit: (state: object) => void };

afterEach(() => onlineManager.setOnline(true));

async function renderBanner() {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <OfflineBanner />
    </SafeAreaProvider>
  );
}

describe('OfflineBanner', () => {
  it('stays hidden while online', async () => {
    await renderBanner();
    expect(screen.queryByText(/You're offline/)).toBeNull();
  });

  it('follows the connection', async () => {
    await renderBanner();
    await act(async () => onlineManager.setOnline(false));
    expect(screen.getByText("You're offline. Showing saved content.")).toBeTruthy();
    await act(async () => onlineManager.setOnline(true));
    expect(screen.queryByText(/You're offline/)).toBeNull();
  });

  it('is driven by expo-network once the online manager is set up', async () => {
    setupOnlineManager();
    await renderBanner();
    await act(async () => network.__emit({ isConnected: true, isInternetReachable: false }));
    expect(screen.getByText("You're offline. Showing saved content.")).toBeTruthy();
    await act(async () => network.__emit({ isConnected: true, isInternetReachable: true }));
    expect(screen.queryByText(/You're offline/)).toBeNull();
  });
});
