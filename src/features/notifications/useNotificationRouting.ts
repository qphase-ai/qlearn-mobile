import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { openAppLink } from '@/features/linking/pending-href';

/** Responses already routed in this process (the cold-start one can also reach the listener). */
const handled = new Set<string>();

function handleResponse(response: Notifications.NotificationResponse): void {
  if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
  const { notification } = response;
  const key = `${notification.request.identifier}:${notification.date}`;
  if (handled.has(key)) return;
  handled.add(key);
  // Handled once: a remount or JS reload must not route it again.
  Notifications.clearLastNotificationResponse();
  const url = notification.request.content.data?.url;
  // openAppLink validates the link, and while signed out (or before the
  // session is read) keeps it for after sign-in.
  if (typeof url === 'string') openAppLink(url);
}

/**
 * Root navigator hook: routes notification taps, both the one that launched
 * the app (cold start) and taps while it runs.
 */
export function useNotificationRouting(): void {
  useEffect(() => {
    const last = Notifications.getLastNotificationResponse();
    if (last) handleResponse(last);
    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => sub.remove();
  }, []);
}

/** Test-only: forget routed responses (simulates a new process). */
export function resetNotificationRoutingForTests(): void {
  handled.clear();
}
