import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConfigErrorScreen } from '@/components/ConfigErrorScreen';
import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { useColorSchemeName } from '@/hooks/use-theme';
import { EnvError, getEnv } from '@/lib/env';
import { createQueryClient } from '@/lib/query/client';

void SplashScreen.preventAutoHideAsync();

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
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { session, isLoading } = useAuth();
  const scheme = useColorSchemeName();

  // Keep the splash up until the persisted session has been read, so a
  // signed-in student never sees the login screen flash.
  useEffect(() => {
    if (!isLoading) void SplashScreen.hideAsync();
  }, [isLoading]);

  if (isLoading) return null;

  return (
    <ThemeProvider value={navTheme(scheme)}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
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
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
