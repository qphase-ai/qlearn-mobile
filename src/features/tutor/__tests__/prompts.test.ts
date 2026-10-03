import { DEFAULT_PROMPTS, suggestedPrompts } from '../prompts';

describe('suggestedPrompts', () => {
  it('defaults to general prompts', () => {
    expect(suggestedPrompts(null)).toEqual(DEFAULT_PROMPTS);
  });

  it('names the lesson in the visible text', () => {
    const prompts = suggestedPrompts({ kind: 'lesson', lessonId: 'l1', title: 'Bell states' });
    expect(prompts.every((p) => p.includes('Bell states'))).toBe(true);
  });

  it('offers circuit prompts when a circuit is attached', () => {
    expect(suggestedPrompts({ kind: 'circuit', title: 'Bell', source: 'qc' })[0]).toBe('Explain my circuit');
  });
});
