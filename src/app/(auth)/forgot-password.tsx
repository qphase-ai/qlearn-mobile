import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import { AuthHeader } from '@/components/auth/AuthHeader';
import { Banner, Button, Screen, TextField } from '@/components/ui';
import { sendPasswordReset } from '@/features/auth/auth-api';
import { authErrorMessage } from '@/features/auth/errors';
import { validateEmail } from '@/features/auth/validation';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const reset = useMutation({ mutationFn: () => sendPasswordReset(email) });

  function submit() {
    const error = validateEmail(email);
    setEmailError(error);
    if (!error) reset.mutate();
  }

  if (reset.isSuccess) {
    return (
      <Screen edges={[]}>
        <AuthHeader
          title="Check your email"
          subtitle={`If an account exists for ${email.trim()}, we've sent a reset link. Open it on this device to choose a new password.`}
        />
        <Button label="Back to sign in" onPress={() => router.replace('/login')} />
      </Screen>
    );
  }

  return (
    <Screen keyboard edges={[]}>
      <AuthHeader title="Reset your password" subtitle="We'll email you a link to choose a new one." />
      {reset.error ? <Banner tone="error" message={authErrorMessage(reset.error)} /> : null}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={emailError}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={submit}
      />
      <Button label="Send reset link" onPress={submit} loading={reset.isPending} />
    </Screen>
  );
}
