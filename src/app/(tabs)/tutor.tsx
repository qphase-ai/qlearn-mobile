import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AssistantBubble, ErrorBubble, UserBubble } from '@/components/tutor/ChatBubble';
import { ErrorState, LoadingState, Text } from '@/components/ui';
import { MIN_TOUCH, Radii, Spacing, Typography } from '@/constants/theme';
import { suggestedPrompts } from '@/features/tutor/prompts';
import { TutorError, useTutorChat } from '@/features/tutor/useTutorChat';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { useTutorStore } from '@/stores/tutor-store';
import type { Citation } from '@/types/contracts';

type Item =
  | { key: string; kind: 'user'; content: string }
  | { key: string; kind: 'assistant'; content: string; citations: Citation[]; streaming: boolean }
  | { key: string; kind: 'error'; message: string };

const MAX_LENGTH = 2000;

export default function TutorScreen() {
  const theme = useTheme();
  const { sessionId, session, messages, pending, send, retry, isStreaming } = useTutorChat();
  const context = useTutorStore((s) => s.context);
  const setContext = useTutorStore((s) => s.setContext);
  const startNewConversation = useTutorStore((s) => s.startNewConversation);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<Item>>(null);

  const items = useMemo<Item[]>(() => {
    const list: Item[] = messages.map((m, i) =>
      m.role === 'user'
        ? { key: `m${i}`, kind: 'user', content: m.content }
        : { key: `m${i}`, kind: 'assistant', content: m.content, citations: m.citations ?? [], streaming: false }
    );
    if (pending) {
      list.push({ key: 'pending-q', kind: 'user', content: pending.question });
      if (pending.status === 'streaming') {
        list.push({ key: 'pending-a', kind: 'assistant', content: pending.answer, citations: [], streaming: true });
      } else {
        const message = pending.error instanceof TutorError ? pending.error.message : toUserMessage(pending.error);
        list.push({ key: 'pending-e', kind: 'error', message });
      }
    }
    return list;
  }, [messages, pending]);

  const submit = useCallback(
    (text: string) => {
      if (!text.trim() || isStreaming) return;
      void send(text);
      setDraft('');
    },
    [isStreaming, send]
  );

  const renderItem = useCallback(
    ({ item }: { item: Item }) => {
      if (item.kind === 'user') return <UserBubble content={item.content} />;
      if (item.kind === 'error') return <ErrorBubble message={item.message} onRetry={retry} />;
      return <AssistantBubble content={item.content} citations={item.citations} streaming={item.streaming} />;
    },
    [retry]
  );

  const loadingHistory = !!sessionId && session.isPending && !pending;

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text variant="title" accessibilityRole="header">
          AI Tutor
        </Text>
        <View style={styles.headerActions}>
          <IconButton icon="time-outline" label="Conversation history" onPress={() => router.push('/tutor/history')} />
          <IconButton
            icon="create-outline"
            label="New conversation"
            disabled={isStreaming}
            onPress={() => startNewConversation()}
          />
        </View>
      </View>

      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {loadingHistory ? (
          <LoadingState label="Loading conversation…" />
        ) : session.isError && !pending ? (
          <ErrorState error={session.error} onRetry={() => void session.refetch()} />
        ) : (
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            contentContainerStyle={[styles.list, items.length === 0 && styles.fill]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onContentSizeChange={() => items.length && listRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="sparkles-outline" size={32} color={theme.primary} />
                <Text variant="heading" style={styles.center}>
                  Ask anything about quantum computing
                </Text>
                <Text color="muted" style={styles.center}>
                  Answers are grounded in Q-Learn&apos;s curriculum, with sources.
                </Text>
                <View style={styles.prompts}>
                  {suggestedPrompts(context).map((prompt) => (
                    <Pressable
                      key={prompt}
                      accessibilityRole="button"
                      onPress={() => submit(prompt)}
                      style={({ pressed }) => [
                        styles.prompt,
                        { borderColor: theme.border, backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 },
                      ]}>
                      <Text variant="label">{prompt}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            }
          />
        )}

        <View style={[styles.composer, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
          {context ? (
            <View style={[styles.contextChip, { borderColor: theme.primary, backgroundColor: theme.overlay }]}>
              <Ionicons
                name={context.kind === 'circuit' ? 'git-network-outline' : 'book-outline'}
                size={14}
                color={theme.primary}
              />
              <Text variant="caption" style={styles.contextText} numberOfLines={1}>
                {context.kind === 'circuit' ? `Asking about circuit: ${context.title}` : `Lesson: ${context.title}`}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove context"
                hitSlop={12}
                onPress={() => setContext(null)}>
                <Ionicons name="close" size={16} color={theme.muted} />
              </Pressable>
            </View>
          ) : null}
          <View style={styles.inputRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Ask the AI Tutor…"
              placeholderTextColor={theme.muted}
              accessibilityLabel="Ask the AI Tutor"
              multiline
              maxLength={MAX_LENGTH}
              editable={!isStreaming}
              style={[
                styles.input,
                Typography.body,
                { color: theme.foreground, backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send"
              accessibilityState={{ disabled: isStreaming || !draft.trim() }}
              disabled={isStreaming || !draft.trim()}
              onPress={() => submit(draft)}
              style={[
                styles.send,
                { backgroundColor: theme.primary, opacity: isStreaming || !draft.trim() ? 0.4 : 1 },
              ]}>
              <Ionicons name="arrow-up" size={20} color={theme.onPrimary} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.iconButton, { opacity: disabled ? 0.4 : 1 }]}>
      <Ionicons name={icon} size={22} color={theme.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerActions: { flexDirection: 'row' },
  iconButton: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.lg, gap: Spacing.lg },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingVertical: Spacing.xl },
  center: { textAlign: 'center' },
  prompts: { alignSelf: 'stretch', gap: Spacing.sm, marginTop: Spacing.sm },
  prompt: { borderWidth: 1, borderRadius: Radii.md, padding: Spacing.md, minHeight: MIN_TOUCH },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, padding: Spacing.md, gap: Spacing.sm },
  contextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderWidth: 1,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs + 2,
  },
  contextText: { flexShrink: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  input: {
    flex: 1,
    minHeight: MIN_TOUCH,
    maxHeight: 140,
    borderWidth: 1,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm + 2,
    paddingBottom: Spacing.sm + 2,
  },
  send: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
});
