import { Markdown } from '../markdown/Markdown';

import type { BlockProps } from './types';

export function MarkdownBlock({ body }: BlockProps<'markdown'>) {
  return <Markdown source={body} />;
}
