import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CircuitDiagram } from '@/components/circuit/CircuitDiagram';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { openExternalUrl } from '@/utils/url';

import { chunkMarkdown } from './chunks';
import MathMarkdown from './MathMarkdown';
import { NativeMarkdown } from './NativeMarkdown';

/** Lesson Markdown: native where possible, KaTeX only where there is math. */
export const Markdown = memo(function Markdown({ source }: { source: string }) {
  const theme = useTheme();
  const chunks = useMemo(() => chunkMarkdown(source), [source]);
  const colors = useMemo(
    () => ({ foreground: theme.foreground, muted: theme.muted, primary: theme.primary, overlay: theme.overlay }),
    [theme]
  );

  return (
    <View style={styles.root}>
      {chunks.map((chunk, i) => {
        if (chunk.kind === 'native') return <NativeMarkdown key={i} tokens={chunk.tokens} />;
        if (chunk.kind === 'circuit') return <CircuitDiagram key={i} spec={chunk.spec} />;
        return (
          <MathMarkdown
            key={i}
            source={chunk.source}
            colors={colors}
            fontSize={Typography.body.fontSize}
            onOpenLink={openExternalUrl}
            dom={{ matchContents: true, scrollEnabled: false, style: styles.dom }}
          />
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { gap: Spacing.md },
  dom: { backgroundColor: 'transparent' },
});
