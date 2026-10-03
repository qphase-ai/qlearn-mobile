import { chunkMarkdown, containsMath } from '../chunks';

describe('containsMath', () => {
  it('detects inline and display math', () => {
    expect(containsMath('The state $|0\\rangle$ is a basis state')).toBe(true);
    expect(containsMath('$$\nH = \\frac{1}{\\sqrt2}\n$$')).toBe(true);
  });

  it('ignores prices, escapes and lone dollars', () => {
    expect(containsMath('It costs $5 and $10 today')).toBe(false);
    expect(containsMath('Escaped \\$x\\$ is not math')).toBe(false);
    expect(containsMath('Just a $ sign')).toBe(false);
  });
});

describe('chunkMarkdown', () => {
  it('keeps plain Markdown native and merges neighbours', () => {
    const chunks = chunkMarkdown('# Title\n\nSome text.\n\n- a\n- b');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].kind).toBe('native');
    if (chunks[0].kind === 'native') {
      expect(chunks[0].tokens.map((t) => t.type)).toEqual(['heading', 'paragraph', 'list']);
    }
  });

  it('routes math paragraphs to the math renderer', () => {
    const chunks = chunkMarkdown('Intro.\n\nA qubit $|\\psi\\rangle$ here.\n\n$$\nx^2\n$$\n\nOutro.');
    expect(chunks.map((c) => c.kind)).toEqual(['native', 'math', 'native']);
    if (chunks[1].kind === 'math') {
      expect(chunks[1].source).toContain('|\\psi\\rangle');
      expect(chunks[1].source).toContain('x^2');
    }
  });

  it('never treats code as math', () => {
    const chunks = chunkMarkdown('```python\nprint("$x$")\n```');
    expect(chunks.map((c) => c.kind)).toEqual(['native']);
  });

  it('turns ```circuit fences into diagrams and falls back on bad JSON', () => {
    const spec = { qubits: 2, classical_bits: 2, gates: [{ type: 'H', targets: [0] }] };
    const ok = chunkMarkdown('```circuit\n' + JSON.stringify(spec) + '\n```');
    expect(ok).toEqual([{ kind: 'circuit', spec }]);

    const bad = chunkMarkdown('```circuit\n{not json\n```');
    expect(bad.map((c) => c.kind)).toEqual(['native']);
  });

  it('handles empty input', () => {
    expect(chunkMarkdown('')).toEqual([]);
  });
});
