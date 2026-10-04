import { onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';

import { isOnlineState, setupOnlineManager } from '../online';

const network = jest.requireMock('expo-network') as { __emit: (state: object) => void };

afterEach(() => onlineManager.setOnline(true));

describe('isOnlineState', () => {
  it('is offline only on a definite no', () => {
    expect(isOnlineState({ isConnected: true, isInternetReachable: true })).toBe(true);
    expect(isOnlineState({})).toBe(true);
    expect(isOnlineState({ isConnected: false })).toBe(false);
    expect(isOnlineState({ isConnected: true, isInternetReachable: false })).toBe(false);
  });
});

describe('setupOnlineManager', () => {
  it('ignores the initial read once a newer change has arrived', async () => {
    let resolveInitial!: (state: Network.NetworkState) => void;
    (Network.getNetworkStateAsync as jest.Mock).mockReturnValueOnce(new Promise((r) => (resolveInitial = r)));
    setupOnlineManager();

    network.__emit({ isConnected: false });
    resolveInitial({ isConnected: true, isInternetReachable: true });
    await new Promise((r) => setTimeout(r, 0));

    expect(onlineManager.isOnline()).toBe(false);
  });

  it('applies the initial read when nothing changed first', async () => {
    (Network.getNetworkStateAsync as jest.Mock).mockResolvedValueOnce({ isConnected: false });
    setupOnlineManager();
    await new Promise((r) => setTimeout(r, 0));
    expect(onlineManager.isOnline()).toBe(false);
  });
});
