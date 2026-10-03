import type { CourseDetail } from '@/types/contracts';

/** Two levels, deliberately out of order to exercise sorting. */
export const course: CourseDetail = {
  id: 'c1',
  title: 'Quantum Foundations',
  description: null,
  difficulty: 'beginner',
  modules: [
    {
      id: 'm2',
      title: 'Gates',
      order_index: 1,
      lessons: [
        { id: 'l4', title: 'CNOT', lesson_type: 'circuit', is_pro: false, order_index: 1 },
        { id: 'l3', title: 'Hadamard gate', lesson_type: 'text', is_pro: false, order_index: 0 },
      ],
    },
    {
      id: 'm1',
      title: 'Qubits',
      order_index: 0,
      lessons: [
        { id: 'l1', title: 'What is a qubit?', lesson_type: 'text', is_pro: false, order_index: 0 },
        { id: 'l2', title: 'Superposition', lesson_type: 'quiz', is_pro: false, order_index: 1 },
      ],
    },
  ],
};
