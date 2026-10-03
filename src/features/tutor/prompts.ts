import type { TutorContext } from '@/stores/tutor-store';

/**
 * Starter questions shown on an empty conversation. They are sent exactly as
 * displayed, so lesson prompts name the lesson in the visible text. The
 * backend currently ignores `lesson_id` (audit §8).
 */
export const DEFAULT_PROMPTS = [
  'Explain superposition with an example',
  'What is quantum entanglement?',
  'Show me a Bell state circuit',
];

export function suggestedPrompts(context: TutorContext | null): string[] {
  if (context?.kind === 'lesson') {
    return [
      `Explain the key idea of “${context.title}” in simple terms`,
      `Give me an intuitive example for “${context.title}”`,
      `What should I understand before “${context.title}”?`,
    ];
  }
  if (context?.kind === 'circuit') {
    return ['Explain my circuit', 'What will I see when I measure it?', 'How could I modify this circuit?'];
  }
  return DEFAULT_PROMPTS;
}
