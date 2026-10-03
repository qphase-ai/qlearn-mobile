import { Image } from 'expo-image';
import { memo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text as RNText, View, type TextStyle } from 'react-native';
import type { Token, Tokens } from 'marked';

import { Text } from '@/components/ui';
import { MonoFont, Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isSafeHttpUrl, openExternalUrl } from '@/utils/url';

import { CodeView } from './CodeView';

/**
 * Renders marked tokens as native views. Raw HTML is never interpreted: html
 * tokens render as their literal text, and only http(s) links and images are
 * honoured (same guarantees as the web's react-markdown without rehype-raw).
 */

const HEADING: Record<number, TextStyle> = {
  1: Typography.title,
  2: Typography.title,
  3: { ...Typography.heading, fontSize: 19, lineHeight: 26 },
  4: Typography.heading,
  5: Typography.label,
  6: Typography.label,
};

function Inline({ tokens }: { tokens: Token[] | undefined }) {
  const theme = useTheme();
  if (!tokens) return null;
  return (
    <>
      {tokens.map((token, i) => {
        switch (token.type) {
          case 'strong':
            return (
              <RNText key={i} style={styles.strong}>
                <Inline tokens={(token as Tokens.Strong).tokens} />
              </RNText>
            );
          case 'em':
            return (
              <RNText key={i} style={styles.em}>
                <Inline tokens={(token as Tokens.Em).tokens} />
              </RNText>
            );
          case 'del':
            return (
              <RNText key={i} style={styles.del}>
                <Inline tokens={(token as Tokens.Del).tokens} />
              </RNText>
            );
          case 'codespan':
            return (
              <RNText key={i} style={[styles.codespan, { backgroundColor: theme.overlay }]}>
                {decode((token as Tokens.Codespan).text)}
              </RNText>
            );
          case 'br':
            return <RNText key={i}>{'\n'}</RNText>;
          case 'link': {
            const link = token as Tokens.Link;
            const safe = isSafeHttpUrl(link.href);
            return (
              <RNText
                key={i}
                accessibilityRole={safe ? 'link' : undefined}
                onPress={safe ? () => void openExternalUrl(link.href) : undefined}
                style={safe ? [styles.link, { color: theme.primary }] : undefined}>
                <Inline tokens={link.tokens} />
              </RNText>
            );
          }
          case 'image': {
            const image = token as Tokens.Image;
            return image.text ? <RNText key={i}>{image.text}</RNText> : null;
          }
          case 'text': {
            const text = token as Tokens.Text;
            return text.tokens ? (
              <Inline key={i} tokens={text.tokens} />
            ) : (
              <RNText key={i}>{decode(text.text)}</RNText>
            );
          }
          case 'escape':
            return <RNText key={i}>{(token as Tokens.Escape).text}</RNText>;
          default:
            return <RNText key={i}>{decode(token.raw)}</RNText>;
        }
      })}
    </>
  );
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

/** marked keeps entity-escaped text in some tokens; show the characters. */
export function decode(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m);
}

function soleImage(paragraph: Tokens.Paragraph): Tokens.Image | null {
  const parts = paragraph.tokens.filter((t) => !(t.type === 'text' && !t.raw.trim()));
  return parts.length === 1 && parts[0].type === 'image' ? (parts[0] as Tokens.Image) : null;
}

function Block({ token }: { token: Token }): ReactNode {
  const theme = useTheme();
  switch (token.type) {
    case 'heading': {
      const heading = token as Tokens.Heading;
      return (
        <Text accessibilityRole="header" style={[HEADING[heading.depth] ?? Typography.heading, styles.heading]}>
          <Inline tokens={heading.tokens} />
        </Text>
      );
    }
    case 'paragraph': {
      const paragraph = token as Tokens.Paragraph;
      const image = soleImage(paragraph);
      if (image) {
        return isSafeHttpUrl(image.href) ? (
          <Image
            source={{ uri: image.href }}
            accessibilityLabel={image.text || undefined}
            contentFit="contain"
            style={[styles.image, { borderColor: theme.border }]}
          />
        ) : null;
      }
      return (
        <Text>
          <Inline tokens={paragraph.tokens} />
        </Text>
      );
    }
    case 'text': {
      const text = token as Tokens.Text;
      return <Text>{text.tokens ? <Inline tokens={text.tokens} /> : decode(text.text)}</Text>;
    }
    case 'code': {
      const code = token as Tokens.Code;
      return <CodeView code={code.text} language={code.lang} />;
    }
    case 'blockquote':
      return (
        <View style={[styles.quote, { borderLeftColor: theme.primary }]}>
          <Blocks tokens={(token as Tokens.Blockquote).tokens} />
        </View>
      );
    case 'list': {
      const list = token as Tokens.List;
      const start = typeof list.start === 'number' ? list.start : 1;
      return (
        <View style={styles.list}>
          {list.items.map((item, i) => (
            <View key={i} style={styles.listItem}>
              <Text color="muted" style={styles.bullet}>
                {item.task ? (item.checked ? '☑' : '☐') : list.ordered ? `${start + i}.` : '•'}
              </Text>
              <View style={styles.listBody}>
                <Blocks tokens={item.tokens} />
              </View>
            </View>
          ))}
        </View>
      );
    }
    case 'table': {
      const table = token as Tokens.Table;
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={[styles.table, { borderColor: theme.border }]}>
            {[table.header, ...table.rows].map((row, r) => (
              <View
                key={r}
                style={[styles.tableRow, { borderColor: theme.border }, r === 0 && { backgroundColor: theme.overlay }]}>
                {row.map((cell, c) => (
                  <Text key={c} variant="label" style={[styles.tableCell, r === 0 && styles.strong]}>
                    <Inline tokens={cell.tokens} />
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      );
    }
    case 'hr':
      return <View style={[styles.hr, { backgroundColor: theme.border }]} />;
    case 'space':
    case 'def':
      return null;
    default:
      // html and anything unknown: literal text, never markup.
      return token.raw.trim() ? <Text>{token.raw.trim()}</Text> : null;
  }
}

function Blocks({ tokens }: { tokens: Token[] }) {
  return (
    <>
      {tokens.map((token, i) => (
        <Block key={i} token={token} />
      ))}
    </>
  );
}

export const NativeMarkdown = memo(function NativeMarkdown({ tokens }: { tokens: Token[] }) {
  return (
    <View style={styles.root}>
      <Blocks tokens={tokens} />
    </View>
  );
});

const styles = StyleSheet.create({
  root: { gap: Spacing.md },
  heading: { marginTop: Spacing.sm },
  strong: { fontWeight: '700' },
  em: { fontStyle: 'italic' },
  del: { textDecorationLine: 'line-through' },
  codespan: { fontFamily: MonoFont, fontSize: 14 },
  link: { textDecorationLine: 'underline' },
  quote: { borderLeftWidth: 3, paddingLeft: Spacing.md, gap: Spacing.sm },
  list: { gap: Spacing.xs },
  listItem: { flexDirection: 'row', gap: Spacing.sm },
  bullet: { minWidth: 18 },
  listBody: { flex: 1, gap: Spacing.xs },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.sm },
  tableRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tableCell: { minWidth: 96, padding: Spacing.sm },
  hr: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.sm },
  image: { width: '100%', aspectRatio: 16 / 9, borderRadius: Radii.md, borderWidth: StyleSheet.hairlineWidth },
});
