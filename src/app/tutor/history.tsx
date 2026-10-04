import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, listContentStyle, Screen, Text } from '@/components/ui';
import { MIN_TOUCH, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTutorStore } from '@/stores/tutor-store';
import { relativeTime } from '@/utils/time';

/**
 * Conversations started on this device. The messages live on the server; the
 * list is local until the backend offers `GET /tutor/sessions` (audit §13).
 */
export default function TutorHistoryScreen() {
  const theme = useTheme();
  const conversations = useTutorStore((s) => s.conversations);
  const activeSessionId = useTutorStore((s) => s.activeSessionId);
  const openConversation = useTutorStore((s) => s.openConversation);
  const removeConversation = useTutorStore((s) => s.removeConversation);

  if (conversations.length === 0) {
    return (
      <Screen edges={[]}>
        <EmptyState icon="chatbubbles-outline" title="No conversations yet" message="Questions you ask the tutor will appear here." />
      </Screen>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={[styles.fill, { backgroundColor: theme.background }]}>
      <FlatList
        contentContainerStyle={listContentStyle}
        data={conversations}
        keyExtractor={(c) => c.id}
        // Rows read this outside `data`: re-render them when it changes.
        extraData={activeSessionId}
        ListHeaderComponentStyle={styles.header}
        ListHeaderComponent={
          <Text variant="caption" color="muted">
            Conversations started on this device.
          </Text>
        }
        renderItem={({ item: c }) => (
          <View style={[styles.row, { borderBottomColor: theme.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open conversation: ${c.title}`}
              style={styles.body}
              onPress={() => {
                openConversation(c.id);
                router.back();
              }}>
              <Text variant="label" numberOfLines={2} style={c.id === activeSessionId ? styles.active : undefined}>
                {c.title}
              </Text>
              <Text variant="caption" color="muted">
                {c.id === activeSessionId ? 'Open now · ' : ''}
                {relativeTime(c.updatedAt)}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove conversation: ${c.title}`}
              hitSlop={8}
              onPress={() => removeConversation(c.id)}
              style={styles.remove}>
              <Ionicons name="trash-outline" size={18} color={theme.muted} />
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { marginBottom: Spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH + 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  body: { flex: 1, gap: 2, paddingVertical: Spacing.sm },
  active: { fontWeight: '700' },
  remove: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
});
