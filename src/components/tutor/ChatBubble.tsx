import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Markdown } from '@/components/lessons/markdown/Markdown';
import { Button, Text } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Citation } from '@/types/contracts';
import { isSafeHttpUrl, openExternalUrl } from '@/utils/url';

export function UserBubble({ content }: { content: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.user, { backgroundColor: theme.overlay, borderColor: theme.border }]}>
      <Text selectable>{content}</Text>
    </View>
  );
}

/**
 * Finished answers render as Markdown + math (same renderer as lessons).
 * While streaming, plain text: re-rendering KaTeX per token would be wasteful.
 */
export const AssistantBubble = memo(function AssistantBubble({
  content,
  citations,
  streaming = false,
}: {
  content: string;
  citations?: Citation[];
  streaming?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.assistant}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={14} color={theme.primary} />
        <Text variant="caption" color="primary" style={styles.name}>
          Q-LEARN TUTOR
        </Text>
      </View>
      {streaming ? (
        content ? (
          <Text accessibilityLiveRegion="polite">{content}▍</Text>
        ) : (
          <View style={styles.thinking} accessibilityLabel="The tutor is thinking">
            <ActivityIndicator size="small" color={theme.primary} />
            <Text variant="label" color="muted">
              Thinking…
            </Text>
          </View>
        )
      ) : (
        <Markdown source={content} />
      )}
      {!streaming && citations?.length ? <CitationChips citations={citations} /> : null}
    </View>
  );
});

export function CitationChips({ citations }: { citations: Citation[] }) {
  const theme = useTheme();
  return (
    <View style={styles.citations} accessibilityLabel="Sources">
      {citations.map((c, i) => {
        const linked = isSafeHttpUrl(c.url);
        return (
          <Pressable
            key={`${c.title}-${i}`}
            disabled={!linked}
            accessibilityRole={linked ? 'link' : 'text'}
            onPress={() => void openExternalUrl(c.url)}
            style={[styles.chip, { borderColor: theme.border }]}>
            <Text variant="caption" color={linked ? 'primary' : 'muted'} numberOfLines={1}>
              {`[${i + 1}] ${c.title}${linked ? ' ↗' : ''}`}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ErrorBubble({ message, onRetry }: { message: string; onRetry: () => void }) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={[styles.error, { borderColor: theme.error, backgroundColor: theme.overlay }]}>
      <Text variant="label" color="error">
        {message}
      </Text>
      <Button label="Try again" variant="secondary" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  user: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    borderRadius: Radii.lg,
    borderBottomRightRadius: Radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  assistant: { gap: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  name: { letterSpacing: 1, fontWeight: '700' },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  citations: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    maxWidth: '100%',
    borderWidth: 1,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs + 2,
  },
  error: { borderWidth: 1, borderRadius: Radii.md, padding: Spacing.md, gap: Spacing.sm },
});
