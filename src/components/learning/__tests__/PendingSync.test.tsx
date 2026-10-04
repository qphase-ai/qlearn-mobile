import { render, screen } from '@testing-library/react-native';

import { LessonRow } from '../LessonRow';
import { LevelCard } from '../LevelCard';

describe('pending-sync markers', () => {
  it('marks a queued completion as waiting to sync, not completed', async () => {
    await render(<LessonRow number="1.1" title="Qubits" type="text" completed pendingSync onPress={jest.fn()} />);
    expect(screen.getByText('Waiting to sync')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lesson 1.1, Qubits, completed, waiting to sync' })).toBeTruthy();
  });

  it('keeps a server-saved completion plain', async () => {
    await render(<LessonRow number="1.1" title="Qubits" type="text" completed onPress={jest.fn()} />);
    expect(screen.queryByText('Waiting to sync')).toBeNull();
    expect(screen.getByRole('button', { name: 'Lesson 1.1, Qubits, completed' })).toBeTruthy();
  });

  it('says how many of a level’s completions are waiting to sync', async () => {
    await render(
      <LevelCard label="Level 1" title="Qubits" done={3} total={8} pending={1} locked={false} onPress={jest.fn()} />
    );
    expect(screen.getByText('3 of 8 lessons complete · 1 waiting to sync')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Level 1: Qubits. 3 of 8 lessons complete · 1 waiting to sync' })
    ).toBeTruthy();
  });
});
