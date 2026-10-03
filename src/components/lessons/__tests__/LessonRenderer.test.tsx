import { fireEvent, render, screen } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';

import type { LessonBlock } from '@/types/contracts';

import { LessonRenderer } from '../LessonRenderer';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
// The KaTeX DOM component runs in a webview; render its source as text here.
jest.mock('../markdown/MathMarkdown', () => {
  const { Text } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ source }: { source: string }) => <Text testID="math">{source}</Text> };
});

describe('LessonRenderer', () => {
  it('renders legacy Markdown natively, with math and circuits routed out', async () => {
    const spec = JSON.stringify({ qubits: 2, classical_bits: 2, gates: [{ type: 'H', targets: [0] }] });
    await render(
      <LessonRenderer
        lesson={{
          blocks: undefined,
          content: `## Superposition\n\nA qubit can be **both**.\n\nThe state $|+\\rangle$ is balanced.\n\n\`\`\`circuit\n${spec}\n\`\`\``,
        }}
      />
    );
    expect(screen.getByRole('header')).toHaveTextContent('Superposition');
    expect(screen.getByText('both')).toBeTruthy();
    expect(screen.getByTestId('math')).toHaveTextContent(/\|\+\\rangle/);
    expect(screen.getByTestId('circuit-diagram')).toBeTruthy();
  });

  it('renders raw HTML as literal text and only opens safe links', async () => {
    await render(
      <LessonRenderer
        lesson={{
          content: '<script>alert(1)</script>\n\n[docs](https://qiskit.org) and [bad](javascript:alert(1))',
        }}
      />
    );
    expect(screen.getByText('<script>alert(1)</script>')).toBeTruthy();
    await fireEvent.press(screen.getByText('bad'));
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('docs'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://qiskit.org');
  });

  it('renders CMS blocks and skips unknown block types', async () => {
    const blocks = [
      { blockType: 'heading', text: 'Gates', level: '2' },
      { blockType: 'callout', variant: 'tip', title: null, body: 'Try it yourself.' },
      { blockType: 'hologram', foo: 1 },
      { blockType: 'code', language: 'python', code: 'qc.h(0)', filename: 'bell.py' },
    ] as unknown as LessonBlock[];
    await render(<LessonRenderer lesson={{ blocks, content: null }} />);
    expect(screen.getByText('Gates')).toBeTruthy();
    expect(screen.getByText('Tip')).toBeTruthy();
    expect(screen.getByText('Try it yourself.')).toBeTruthy();
    expect(screen.getByText('bell.py')).toBeTruthy();
    expect(screen.getByText('qc.h(0)')).toBeTruthy();
  });

  it('runs the ungraded self-check quiz locally', async () => {
    const blocks: LessonBlock[] = [
      {
        blockType: 'quiz',
        question: 'What does H do to |0⟩?',
        questionType: 'multiple_choice',
        options: [{ text: 'Creates |+⟩' }, { text: 'Flips to |1⟩' }],
        correctAnswer: 'Creates |+⟩',
        explanation: 'H maps |0⟩ to an equal superposition.',
      },
    ];
    await render(<LessonRenderer lesson={{ blocks, content: null }} />);
    expect(screen.getByText(/NOT GRADED/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Flips to |1⟩'));
    await fireEvent.press(screen.getByRole('button', { name: 'Check answer' }));
    expect(screen.getByText('Not quite.')).toBeTruthy();
    expect(screen.getByText('H maps |0⟩ to an equal superposition.')).toBeTruthy();
  });
});
