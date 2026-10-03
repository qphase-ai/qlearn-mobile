import { Lexer, type Token, type Tokens } from 'marked';

import type { CircuitSpec } from '@/types/contracts';

/**
 * Split lesson Markdown into render chunks:
 *   native  → marked tokens rendered with React Native views (most content)
 *   math    → Markdown containing `$…$` / `$$…$$`, rendered with KaTeX in a
 *             DOM component (the web's exact remark-math + rehype-katex stack)
 *   circuit → a ```circuit fence holding a CircuitSpec JSON (web convention)
 * Consecutive chunks of the same kind are merged to keep the view count low.
 */

export type MarkdownChunk =
  | { kind: 'native'; tokens: Token[] }
  | { kind: 'math'; source: string }
  | { kind: 'circuit'; spec: CircuitSpec };

const DISPLAY_MATH = /\$\$[\s\S]+?\$\$/;
// Inline $x$: not escaped, no space just inside the delimiters (remark-math rules).
const INLINE_MATH = /(^|[^\\$])\$[^\s$](?:[^$\n]*?[^\s\\$])?\$(?!\d)/;

export function containsMath(markdown: string): boolean {
  return DISPLAY_MATH.test(markdown) || INLINE_MATH.test(markdown);
}

function parseCircuit(text: string): CircuitSpec | null {
  try {
    const spec = JSON.parse(text) as CircuitSpec;
    return spec && typeof spec.qubits === 'number' && Array.isArray(spec.gates) ? spec : null;
  } catch {
    return null;
  }
}

export function chunkMarkdown(markdown: string): MarkdownChunk[] {
  const tokens = new Lexer({ gfm: true }).lex(markdown ?? '');
  const chunks: MarkdownChunk[] = [];

  const push = (chunk: MarkdownChunk) => {
    const last = chunks[chunks.length - 1];
    if (last?.kind === 'native' && chunk.kind === 'native') last.tokens.push(...chunk.tokens);
    else if (last?.kind === 'math' && chunk.kind === 'math') last.source += chunk.source;
    else chunks.push(chunk);
  };

  for (const token of tokens) {
    if (token.type === 'space' || token.type === 'def') continue;
    if (token.type === 'code') {
      const code = token as Tokens.Code;
      const spec = code.lang === 'circuit' ? parseCircuit(code.text) : null;
      push(spec ? { kind: 'circuit', spec } : { kind: 'native', tokens: [token] });
      continue;
    }
    if (containsMath(token.raw)) {
      push({ kind: 'math', source: token.raw.endsWith('\n') ? token.raw : `${token.raw}\n\n` });
      continue;
    }
    push({ kind: 'native', tokens: [token] });
  }
  return chunks;
}
