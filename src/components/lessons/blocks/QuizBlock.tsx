import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { MIN_TOUCH, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { BlockProps } from './types';

/**
 * Inline check-your-understanding question, as on the web. It is an
 * ungraded self-check: nothing is sent to the backend or counted toward
 * mastery. Graded practice needs the server-side quiz API (audit §13).
 */
export function QuizBlock({ question, options, correctAnswer, hint, explanation }: BlockProps<'quiz'>) {
  const theme = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const correct = submitted && selected === correctAnswer;

  return (
    <Card accessibilityLabel="Check your understanding">
      <Text variant="caption" color="muted">
        CHECK YOUR UNDERSTANDING · NOT GRADED
      </Text>
      <Text variant="heading">{question}</Text>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {options.map((option, i) => {
          const isSelected = selected === option.text;
          const isAnswer = submitted && option.text === correctAnswer;
          const borderColor = isAnswer ? theme.success : isSelected ? theme.primary : theme.border;
          return (
            <Pressable
              key={option.id ?? i}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, disabled: submitted }}
              disabled={submitted}
              onPress={() => setSelected(option.text)}
              style={[styles.option, { borderColor, backgroundColor: isSelected ? theme.overlay : 'transparent' }]}>
              <Text variant="label">{option.text}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.actions}>
        {submitted ? (
          <Button
            label="Try again"
            variant="ghost"
            onPress={() => {
              setSubmitted(false);
              setSelected(null);
            }}
          />
        ) : (
          <Button label="Check answer" variant="secondary" disabled={!selected} onPress={() => setSubmitted(true)} />
        )}
        {hint && !submitted ? (
          <Button label={showHint ? 'Hide hint' : 'Hint'} variant="ghost" onPress={() => setShowHint((v) => !v)} />
        ) : null}
      </View>
      {showHint && hint && !submitted ? (
        <Text variant="label" color="warning">
          {hint}
        </Text>
      ) : null}
      {submitted ? (
        <View accessibilityLiveRegion="polite" style={styles.feedback}>
          <Text variant="label" color={correct ? 'success' : 'error'} style={styles.verdict}>
            {correct ? 'Correct!' : 'Not quite.'}
          </Text>
          {explanation ? (
            <Text variant="label" color="muted">
              {explanation}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  options: { gap: Spacing.sm },
  option: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  feedback: { gap: Spacing.xs },
  verdict: { fontWeight: '700' },
});
