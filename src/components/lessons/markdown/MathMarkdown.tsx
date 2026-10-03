'use dom';

import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

/**
 * Markdown that contains math, rendered in a DOM component with the web's
 * exact pipeline (react-markdown + remark-math + rehype-katex). KaTeX emits
 * MathML only, which iOS WebKit and Android's Chromium WebView render
 * natively, so no KaTeX fonts or CSS ship in the bundle. react-markdown never
 * renders raw HTML. Links are handed to the native side instead of
 * navigating the webview.
 */

export interface MathMarkdownProps {
  source: string;
  colors: { foreground: string; muted: string; primary: string; overlay: string };
  fontSize: number;
  onOpenLink: (url: string) => Promise<void>;
  dom?: import('expo/dom').DOMProps;
}

export default function MathMarkdown({ source, colors, fontSize, onOpenLink }: MathMarkdownProps) {
  const components: Components = {
    a: ({ href, children }) => (
      <span
        role="link"
        style={{ color: colors.primary, textDecoration: 'underline', cursor: 'pointer' }}
        onClick={() => href && void onOpenLink(href)}>
        {children}
      </span>
    ),
    img: ({ alt }) => <span>{alt}</span>,
    code: ({ children }) => (
      <code style={{ background: colors.overlay, borderRadius: 4, padding: '0 3px' }}>{children}</code>
    ),
  };

  return (
    <div
      style={{
        color: colors.foreground,
        fontFamily: '-apple-system, system-ui, Roboto, sans-serif',
        fontSize,
        lineHeight: 1.5,
        background: 'transparent',
        overflowX: 'auto',
        overflowWrap: 'anywhere',
      }}>
      <style>{'html,body{margin:0;padding:0;background:transparent}p{margin:0 0 12px}p:last-child{margin-bottom:0}math[display="block"]{overflow-x:auto;margin:8px 0}'}</style>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { output: 'mathml', throwOnError: false }]]}
        components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
