import type { RealtimeChannel } from '@supabase/supabase-js';

import { getSupabase } from '@/lib/supabase/client';

/**
 * Subscribe to a Supabase Realtime broadcast channel published by FastAPI
 * (backend/app/services/realtime_service.py). Broadcasts are not replayed,
 * so callers must await `ready` (channel joined) BEFORE triggering the work
 * that publishes, i.e. subscribe before POST.
 */
export interface BroadcastSubscription {
  /** Resolves once the channel has joined; rejects if it can't. */
  ready: Promise<void>;
  unsubscribe: () => void;
}

export const JOIN_TIMEOUT_MS = 8_000;

export function subscribeBroadcast(
  channelName: string,
  handlers: Record<string, (payload: unknown) => void>
): BroadcastSubscription {
  const supabase = getSupabase();
  let channel: RealtimeChannel | null = supabase.channel(channelName);
  for (const [event, handler] of Object.entries(handlers)) {
    channel = channel.on('broadcast', { event }, ({ payload }) => handler(payload));
  }

  const ready = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Realtime connection timed out')), JOIN_TIMEOUT_MS);
    channel?.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer);
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        clearTimeout(timer);
        reject(new Error(`Realtime channel ${status.toLowerCase()}`));
      }
    });
  });
  // Callers may never await `ready` after unsubscribing; don't surface that as unhandled.
  ready.catch(() => undefined);

  return {
    ready,
    unsubscribe: () => {
      if (channel) void supabase.removeChannel(channel);
      channel = null;
    },
  };
}
