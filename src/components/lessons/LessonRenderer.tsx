import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { LessonBlock, LessonBlockType, LessonDetail } from '@/types/contracts';

import { CalloutBlock } from './blocks/CalloutBlock';
import { CircuitBlock } from './blocks/CircuitBlock';
import { CodeBlock } from './blocks/CodeBlock';
import { HeadingBlock } from './blocks/HeadingBlock';
import { ImageBlock } from './blocks/ImageBlock';
import { MarkdownBlock } from './blocks/MarkdownBlock';
import { MathBlock } from './blocks/MathBlock';
import { QuizBlock } from './blocks/QuizBlock';
import { SimulationBlock } from './blocks/SimulationBlock';
import { TextBlock } from './blocks/TextBlock';
import type { BlockProps } from './blocks/types';
import { Markdown } from './markdown/Markdown';

/**
 * The closed block registry: mirrors cms/src/blocks/lessonBlocks.ts and the
 * web's components/learn/blocks. Add a block type in all three together.
 */
export const BlockRegistry: { [T in LessonBlockType]: ComponentType<BlockProps<T>> } = {
  heading: HeadingBlock,
  text: TextBlock,
  markdown: MarkdownBlock,
  math: MathBlock,
  image: ImageBlock,
  code: CodeBlock,
  callout: CalloutBlock,
  circuit: CircuitBlock,
  quiz: QuizBlock,
  simulation: SimulationBlock,
};

export function LessonBlocks({ blocks }: { blocks: LessonBlock[] }) {
  return (
    <View style={styles.root}>
      {blocks.map((block, i) => {
        const Component = BlockRegistry[block.blockType] as ComponentType<LessonBlock> | undefined;
        // Unknown block types (newer CMS than app) degrade, never crash.
        return Component ? <Component key={block.id ?? i} {...block} /> : null;
      })}
    </View>
  );
}

/** CMS lessons render their blocks; legacy lessons their Markdown content. */
export function LessonRenderer({ lesson }: { lesson: Pick<LessonDetail, 'blocks' | 'content'> }) {
  if (lesson.blocks?.length) return <LessonBlocks blocks={lesson.blocks} />;
  return <Markdown source={lesson.content ?? ''} />;
}

export function hasLessonContent(lesson: Pick<LessonDetail, 'blocks' | 'content'>): boolean {
  return Boolean(lesson.blocks?.length || lesson.content?.trim());
}

const styles = StyleSheet.create({ root: { gap: Spacing.lg } });
