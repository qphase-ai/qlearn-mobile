import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '../Button';

describe('Button', () => {
  it('fires onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Sign in" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is disabled and busy while loading', async () => {
    const onPress = jest.fn();
    await render(<Button label="Sign in" onPress={onPress} loading />);
    const button = screen.getByRole('button', { name: 'Sign in' });
    expect(button).toBeDisabled();
    expect(screen.getByTestId('button-spinner')).toBeTruthy();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
