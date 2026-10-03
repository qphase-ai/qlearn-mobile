import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isSafeHttpUrl } from '@/utils/url';

import type { BlockProps } from './types';

export function ImageBlock({ image, caption }: BlockProps<'image'>) {
  const theme = useTheme();
  // An unpopulated relation (bare id) or a non-http URL is not renderable.
  if (!image || typeof image !== 'object' || !isSafeHttpUrl(image.url)) return null;
  const aspectRatio = image.width && image.height ? image.width / image.height : 16 / 9;
  return (
    <View style={styles.root}>
      <Image
        source={{ uri: image.url }}
        accessibilityLabel={image.alt || caption || undefined}
        contentFit="contain"
        transition={150}
        style={[styles.image, { aspectRatio, borderColor: theme.border }]}
      />
      {caption ? (
        <Text variant="caption" color="muted" style={styles.caption}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.xs },
  image: { width: '100%', borderRadius: Radii.md, borderWidth: StyleSheet.hairlineWidth },
  caption: { textAlign: 'center' },
});
