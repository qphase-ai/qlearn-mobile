import { focusManager, useIsRestoring } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConfigErrorScreen } from '@/components/ConfigErrorScreen';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { usePendingHrefReplay } from '@/features/linking/usePendingHrefReplay';
import { useColorSchemeName } from '@/hooks/use-theme';
import { EnvError, getEnv } from '@/lib/env';
import { createQueryClient } from '@/lib/query/client';
import { setupOnlineManager } from '@/lib/query/online';
import { persistOptions } from '@/lib/query/persist';

void SplashScreen.preventAutoHideAsync();
setupOnlineManager();

function navTheme(scheme: 'light' | 'dark'): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const c = Colors[scheme];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.primary,
      background: c.background,
      card: c.surface,
      text: c.foreground,
      border: c.border,
      notification: c.accent,
    },
  };
}

function configError(): string | null {
  try {
    getEnv();
    return null;
  } catch (err) {
    if (err instanceof EnvError) return err.message;
    throw err;
  }
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const [envError] = useState(configError);

  // Refetch stale queries when the app returns to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
    });
    return () => sub.remove();
  }, []);

  if (envError) {
    void SplashScreen.hideAsync();
    return <ConfigErrorScreen message={envError} />;
  }

  return (
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
          onSuccess={() => {
            // Send completions queued before the last restart (each resyncs
            // progress when it settles, see lib/query/client.ts). Offline this
            // resolves at once; the client's online subscription resumes them
            // on reconnect. Not returned: the provider holds `isRestoring`
            // until onSuccess settles.
            void queryClient.resumePausedMutations();
          }}>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { session, isLoading } = useAuth();
  const isRestoring = useIsRestoring();
  const scheme = useColorSchemeName();
  const ready = !isLoading && !isRestoring;
  usePendingHrefReplay(ready, !!session);

  // Keep the splash up until the persisted session and the offline cache have
  // been read, so a signed-in student never sees the login screen or a
  // spinner over content that is on the device.
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider value={navTheme(scheme)}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View style={styles.fill}>
        {session ? <OfflineBanner /> : null}
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={!!session}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="level/[id]" options={{ headerShown: true, title: '', headerBackTitle: 'Learn' }} />
            <Stack.Screen name="lesson/[id]" options={{ headerShown: true, title: '', headerBackTitle: 'Back' }} />
            <Stack.Screen name="tutor/history" options={{ headerShown: true, title: 'Conversations', headerBackTitle: 'Tutor' }} />
          </Stack.Protected>
          <Stack.Protected guard={!session}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          {/* Deep-link targets: reachable in either auth state. */}
          <Stack.Screen
            name="reset-password"
            options={{ headerShown: true, title: 'Reset password', headerBackTitle: 'Back' }}
          />
          <Stack.Screen name="auth/callback" />
          <Stack.Screen name="+not-found" options={{ headerShown: true, title: 'Not found' }} />
        </Stack>
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
