import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenTitle } from '@/components/ScreenTitle';
import { ContinueLearningCard } from '@/components/home/ContinueLearningCard';
import { Card, ErrorState, LoadingState, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { displayNameFor } from '@/features/profile/display-name';
import { learningKeys } from '@/features/learning/hooks';
import { ACCOUNT_OFFLINE, useMe } from '@/features/profile/hooks';
import { useTheme } from '@/hooks/use-theme';
import { isWaitingForNetwork } from '@/lib/query/online';

/**
 * Home answers "what should I do right now?": the next lesson in the
 * student's course, derived from backend progress exactly as the web does.
 * Nothing here is invented: no streaks, XP or recommendations until the
 * backend provides them.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const me = useMe();
  const queryClient = useQueryClient();

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={me.isRefetching}
            onRefresh={() => {
              void me.refetch();
              void queryClient.invalidateQueries({ queryKey: learningKeys.all });
            }}
            tintColor={theme.primary}
          />
        }>
        <ScreenTitle title={`Hi, ${displayNameFor(user)}`} subtitle="Ready to keep learning quantum computing?" />

        <ContinueLearningCard />

        <Card>
          <View style={styles.row}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.primary} />
            <Text variant="heading">Your account</Text>
          </View>
          {me.isPending ? (
            isWaitingForNetwork(me) ? (
              <Text color="muted">{ACCOUNT_OFFLINE}</Text>
            ) : (
              <LoadingState label="Connecting to Q-Learn…" />
            )
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
