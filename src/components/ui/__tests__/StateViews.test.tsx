import { fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError } from '@/lib/api/errors';

import { EmptyState, ErrorState } from '../StateViews';

describe('ErrorState', () => {
  it('shows a student-friendly message and retries', async () => {
    const onRetry = jest.fn();
    await render(<ErrorState error={new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'x' })} onRetry={onRetry} />);
    expect(screen.getByText(/offline/i)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('omits retry when no handler is given', async () => {
    await render(<ErrorState error={new Error('x')} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('EmptyState', () => {
  it('renders title and message', async () => {
    await render(<EmptyState title="Nothing yet" message="Come back later" />);
    expect(screen.getByText('Nothing yet')).toBeTruthy();
    expect(screen.getByText('Come back later')).toBeTruthy();
  });
});
