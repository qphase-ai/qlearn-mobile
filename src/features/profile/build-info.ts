import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

export interface BuildInfoSource {
  version: string | undefined;
  isDev: boolean;
  updatesEnabled: boolean;
  channel: string | null;
  updateId: string | null;
  isEmbeddedLaunch: boolean;
}

export interface BuildInfo {
  version: string;
  channel: string;
  update: string;
}

/**
 * The Profile "About" rows. expo-updates is disabled in development (Expo Go,
 * dev client) and in a store build without an `updates.url`, and then the
 * channel and update id are null.
 */
export function describeBuild(source: BuildInfoSource): BuildInfo {
  const version = source.version ?? 'Unknown';
  if (source.isDev) return { version, channel: 'Development', update: 'Development build' };
  if (!source.updatesEnabled) return { version, channel: 'None (updates off)', update: 'Embedded (updates off)' };
  const shortId = source.updateId ? source.updateId.slice(0, 8) : null;
  return {
    version,
    channel: source.channel ?? 'None',
    update: source.isEmbeddedLaunch ? `Embedded${shortId ? ` · ${shortId}` : ''}` : (shortId ?? 'Unknown'),
  };
}

export function getBuildInfo(): BuildInfo {
  return describeBuild({
    version: Constants.expoConfig?.version,
    isDev: __DEV__,
    updatesEnabled: Updates.isEnabled,
    channel: Updates.channel,
    updateId: Updates.updateId,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
  });
}
