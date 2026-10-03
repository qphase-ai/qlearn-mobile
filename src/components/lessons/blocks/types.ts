import type { LessonBlock, LessonBlockType } from '@/types/contracts';

export type BlockProps<T extends LessonBlockType> = Extract<LessonBlock, { blockType: T }>;
