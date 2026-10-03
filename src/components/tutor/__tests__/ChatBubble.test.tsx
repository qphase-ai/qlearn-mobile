import { fireEvent, render, screen } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';

import { AssistantBubble } from '../ChatBubble';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('@/components/lessons/markdown/MathMarkdown', () => {
  const { Text } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ source }: { source: string }) => <Text>{source}</Text> };
});

describe('AssistantBubble', () => {
  it('shows a thinking state before the first token', async () => {
    await render(<AssistantBubble content="" streaming />);
    expect(screen.getByText('Thinking…')).toBeTruthy();
  });

  it('streams plain text with a cursor', async () => {
    await render(<AssistantBubble content="**Partial**" streaming />);
    expect(screen.getByText('**Partial**▍')).toBeTruthy();
  });

  it('renders finished answers as Markdown with citation links', async () => {
    await render(
      <AssistantBubble
        content="A **qubit** is a two-level system."
        citations={[
          { title: 'Qiskit docs', url: 'https://qiskit.org', score: 0.9 },
          { title: 'Lesson 1.1', url: null, score: 0.7 },
        ]}
      />
    );
    expect(screen.getByText('qubit')).toBeTruthy();
    await fireEvent.press(screen.getByText('[1] Qiskit docs ↗'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://qiskit.org');
    expect(screen.getByText('[2] Lesson 1.1')).toBeTruthy();
  });
});
