import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import TutorScreen from '@/app/(tabs)/tutor';
import { suggestedPrompts } from '@/features/tutor/prompts';

const mockSend = jest.fn();
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));
jest.mock('@/features/tutor/useTutorChat', () => ({
  ...jest.requireActual('@/features/tutor/useTutorChat'),
  useTutorChat: () => ({
    sessionId: null,
    session: { isPending: true, isError: false, fetchStatus: 'idle', error: null, refetch: jest.fn() },
    messages: [],
    pending: null,
    send: mockSend,
    retry: jest.fn(),
    isStreaming: false,
  }),
}));

afterEach(() => onlineManager.setOnline(true));
beforeEach(() => mockSend.mockReset());

describe('TutorScreen composer', () => {
  it('disables Send offline and says why', async () => {
    await render(<TutorScreen />);
    await fireEvent.changeText(screen.getByLabelText('Ask the AI Tutor'), 'What is a qubit?');
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();

    await act(async () => onlineManager.setOnline(false));

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.getByText("You're offline. The AI Tutor needs a connection to answer.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('disables the suggested prompts offline', async () => {
    const [prompt] = suggestedPrompts(null);
    await render(<TutorScreen />);
    await act(async () => onlineManager.setOnline(false));
    expect(screen.getByRole('button', { name: prompt })).toBeDisabled();
    await fireEvent.press(screen.getByText(prompt));
    expect(mockSend).not.toHaveBeenCalled();
  });
});
