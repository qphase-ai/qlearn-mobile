import { onlineManager, type FetchStatus } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { useSyncExternalStore } from 'react';

import { ApiError } from '@/lib/api/errors';

/** Unknown counts as online: only a definite "no" pauses queries. */
export function isOnlineState(state: Network.NetworkState): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

/**
 * Feed TanStack Query's onlineManager from the OS network state, so queries
 * and the lesson-completion mutation pause offline and resume on reconnect.
 */
export function setupOnlineManager(): void {
  onlineManager.setEventListener((setOnline) => {
    // The initial read can resolve after a newer change event: ignore it then.
    let changed = false;
    const sub = Network.addNetworkStateListener((state) => {
      changed = true;
      setOnline(isOnlineState(state));
    });
    Network.getNetworkStateAsync()
      .then((state) => {
        if (!changed) setOnline(isOnlineState(state));
      })
      .catch(() => undefined);
    return () => sub.remove();
  });
}

const subscribe = (onChange: () => void) => onlineManager.subscribe(onChange);
const getSnapshot = () => onlineManager.isOnline();

export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Shown where a query has nothing cached; `toUserMessage` gives the offline copy. */
export const OFFLINE_ERROR = new ApiError({ status: 0, code: 'NETWORK_ERROR', message: "You're offline." });

/**
 * Nothing cached and paused until the network returns. Show OFFLINE_ERROR
 * instead of a spinner that would never finish.
 */
export function isWaitingForNetwork(query: { isPending: boolean; fetchStatus: FetchStatus }): boolean {
  return query.isPending && query.fetchStatus === 'paused';
}
