import { conversationTitle, MAX_CONVERSATIONS, useTutorStore } from '../tutor-store';

// jest.mock calls are hoisted above the imports by babel-jest.
jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `session-${++n}` };
});

beforeEach(() => useTutorStore.setState({ activeSessionId: null, conversations: [], context: null }));

describe('tutor store', () => {
  it('creates a session once and reuses it for the conversation', () => {
    const first = useTutorStore.getState().ensureSession();
    expect(useTutorStore.getState().ensureSession()).toBe(first);
    useTutorStore.getState().startNewConversation();
    expect(useTutorStore.getState().ensureSession()).not.toBe(first);
  });

  it('indexes conversations newest first, keeping the first question as title', () => {
    const { recordMessage } = useTutorStore.getState();
    recordMessage('a', 'What is a qubit?', 1);
    recordMessage('b', 'Explain entanglement', 2);
    recordMessage('a', 'And superposition?', 3);
    expect(useTutorStore.getState().conversations).toEqual([
      { id: 'a', title: 'What is a qubit?', updatedAt: 3 },
      { id: 'b', title: 'Explain entanglement', updatedAt: 2 },
    ]);
  });

  it('caps the index', () => {
    for (let i = 0; i < MAX_CONVERSATIONS + 5; i++) useTutorStore.getState().recordMessage(`s${i}`, `q${i}`, i);
    const list = useTutorStore.getState().conversations;
    expect(list).toHaveLength(MAX_CONVERSATIONS);
    expect(list[0].id).toBe(`s${MAX_CONVERSATIONS + 4}`);
  });

  it('closes the open conversation when it is removed', () => {
    useTutorStore.setState({ activeSessionId: 'a', conversations: [{ id: 'a', title: 'x', updatedAt: 1 }] });
    useTutorStore.getState().removeConversation('a');
    expect(useTutorStore.getState()).toMatchObject({ activeSessionId: null, conversations: [] });
  });

  it('builds one-line, bounded titles', () => {
    expect(conversationTitle('  What   is\na qubit? ')).toBe('What is a qubit?');
    expect(conversationTitle('x'.repeat(200))).toHaveLength(80);
  });
});
