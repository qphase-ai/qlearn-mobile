import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenTitle } from '@/components/ScreenTitle';
import { Button, Card, ErrorState, LoadingState, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { displayNameFor } from '@/features/profile/display-name';
import { useMe } from '@/features/profile/hooks';
import { useTheme } from '@/hooks/use-theme';

/**
 * Home answers "what should I do right now?". In Phase 1 it confirms the
 * account is connected to the Q-Learn backend. Curriculum progress and the
 * next-lesson card arrive in Phase 2. Nothing here is invented: no streaks,
 * XP or recommendations until the backend provides them.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const me = useMe();

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={me.isRefetching} onRefresh={() => void me.refetch()} tintColor={theme.primary} />
        }>
        <ScreenTitle title={`Hi, ${displayNameFor(user)}`} subtitle="Ready to keep learning quantum computing?" />

        <Card>
          <Text variant="heading">Continue learning</Text>
          <Text color="muted">
            Your curriculum, progress and next lesson will appear here. This is the next part of the app we&apos;re building.
          </Text>
          <Button label="Open Learn" variant="secondary" onPress={() => router.navigate('/learn')} />
        </Card>

        <Card>
          <View style={styles.row}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.primary} />
            <Text variant="heading">Your account</Text>
          </View>
          {me.isPending ? (
            <LoadingState label="Connecting to Q-Learn…" />
          ) : me.isError ? (
            <ErrorState error={me.error} onRetry={() => void me.refetch()} retrying={me.isRefetching} />
          ) : (
            <Text color="muted">
              Signed in as {me.data.email}. Your progress syncs with Q-Learn on the web.
            </Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
