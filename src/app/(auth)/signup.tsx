import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import { AuthHeader } from '@/components/auth/AuthHeader';
import { Banner, Button, Screen, TextField } from '@/components/ui';
import { signUp } from '@/features/auth/auth-api';
import { authErrorMessage } from '@/features/auth/errors';
import { validateEmail, validateNewPassword } from '@/features/auth/validation';

export default function SignupScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string | null; password?: string | null }>({});

  const signup = useMutation({ mutationFn: () => signUp(email, password, displayName) });

  function submit() {
    const errors = { email: validateEmail(email), password: validateNewPassword(password) };
    setFieldErrors(errors);
    if (errors.email || errors.password) return;
    signup.mutate();
  }

  if (signup.data?.needsConfirmation) {
    return (
      <Screen edges={[]}>
        <AuthHeader title="Check your email" subtitle={`We sent a confirmation link to ${email.trim()}. Confirm your address, then sign in.`} />
        <Button label="Back to sign in" onPress={() => router.replace('/login')} />
      </Screen>
    );
  }

  return (
    <Screen keyboard edges={[]}>
      <AuthHeader title="Start learning" subtitle="One account for Q-Learn on the web and on your phone." />

      {signup.error ? <Banner tone="error" message={authErrorMessage(signup.error)} /> : null}

      <TextField
        label="Name (optional)"
        value={displayName}
        onChangeText={setDisplayName}
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
      />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={fieldErrors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={fieldErrors.password}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <Button label="Create account" onPress={submit} loading={signup.isPending} />
    </Screen>
  );
}
