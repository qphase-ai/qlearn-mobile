import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ScreenProps {
  scroll?: boolean;
  /** Lift content above the keyboard (forms). */
  keyboard?: boolean;
  edges?: Edge[];
  contentStyle?: ViewStyle;
}

const MAX_CONTENT_WIDTH = 640;

export function Screen({
  children,
  scroll = true,
  keyboard = false,
  edges = ['top'],
  contentStyle,
}: PropsWithChildren<ScreenProps>) {
  const theme = useTheme();
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.fill, { backgroundColor: theme.background }]}>
      {keyboard ? (
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
});
