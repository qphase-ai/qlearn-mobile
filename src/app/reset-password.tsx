import { useMutation } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { Banner, Button, LoadingState, Screen, Text, TextField } from '@/components/ui';
import { completeAuthFromUrl, updatePassword } from '@/features/auth/auth-api';
import { useAuth } from '@/features/auth/AuthProvider';
import { authErrorMessage } from '@/features/auth/errors';
import { validateNewPassword, validatePasswordMatch } from '@/features/auth/validation';

/**
 * Target of the recovery email link (`qlearn://reset-password?code=…`).
 * Exchanges the code for a recovery session, then lets the student set a new
 * password. Reachable signed in or out (see app/_layout.tsx).
 */
export default function ResetPasswordScreen() {
  const url = Linking.useLinkingURL();
  const { session } = useAuth();
  const exchanged = useRef(false);
  const exchange = useMutation({ mutationFn: completeAuthFromUrl });

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const update = useMutation({ mutationFn: () => updatePassword(password) });

  useEffect(() => {
    if (!url || exchanged.current || !url.includes('reset-password')) return;
    exchanged.current = true;
    exchange.mutate(url);
  }, [url, exchange]);

  function submit() {
    const error = validateNewPassword(password) ?? validatePasswordMatch(password, confirm);
    setFieldError(error);
    if (!error) update.mutate();
  }

  if (exchange.isPending) return <LoadingState label="Verifying your reset link…" />;

  if (update.isSuccess) {
    return (
      <Screen edges={[]}>
        <Text variant="title">Password updated</Text>
        <Text color="muted">You&apos;re signed in with your new password.</Text>
        <Button label="Continue" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen edges={[]}>
        <Banner
          tone="error"
          message={
            exchange.error
              ? authErrorMessage(exchange.error)
              : 'Open the reset link from your email on this device to continue.'
          }
        />
        <Button label="Request a new link" onPress={() => router.replace('/forgot-password')} />
      </Screen>
    );
  }

  return (
    <Screen keyboard edges={[]}>
      <Text variant="title">Choose a new password</Text>
      {update.error ? <Banner tone="error" message={authErrorMessage(update.error)} /> : null}
      <TextField
        label="New password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextField
        label="Confirm password"
        value={confirm}
        onChangeText={setConfirm}
        error={fieldError}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={submit}
      />
      <Button label="Update password" onPress={submit} loading={update.isPending} />
    </Screen>
  );
}
