import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthHeader } from '@/components/auth/AuthHeader';
import { Banner, Button, Screen, Text, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { signIn, signInWithGoogle } from '@/features/auth/auth-api';
import { authErrorMessage } from '@/features/auth/errors';
import { validateEmail, validatePasswordPresent } from '@/features/auth/validation';
import { useTheme } from '@/hooks/use-theme';

export default function LoginScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string | null; password?: string | null }>({});

  // On success the auth guard swaps the stack to the tabs; no navigation here.
  const emailLogin = useMutation({ mutationFn: () => signIn(email, password) });
  const google = useMutation({ mutationFn: signInWithGoogle });
  const error = emailLogin.error ?? google.error;
  const busy = emailLogin.isPending || google.isPending;

  function submit() {
    const errors = { email: validateEmail(email), password: validatePasswordPresent(password) };
    setFieldErrors(errors);
    if (errors.email || errors.password) return;
    google.reset();
    emailLogin.mutate();
  }

  return (
    <Screen keyboard>
      <AuthHeader title="Welcome back" subtitle="Sign in with your Q-Learn account. It's the same one you use on the web." />

      {error ? <Banner tone="error" message={authErrorMessage(error)} /> : null}

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
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <Link href="/forgot-password" style={[styles.link, { color: theme.primary }]}>
        Forgot password?
      </Link>

      <Button label="Sign in" onPress={submit} loading={emailLogin.isPending} disabled={busy} />

      <View style={styles.divider}>
        <View style={[styles.rule, { backgroundColor: theme.border }]} />
        <Text variant="caption" color="muted">
          or
        </Text>
        <View style={[styles.rule, { backgroundColor: theme.border }]} />
      </View>

      <Button
        label="Continue with Google"
        variant="secondary"
        icon={<Ionicons name="logo-google" size={18} color={theme.foreground} />}
        onPress={() => {
          emailLogin.reset();
          google.mutate();
        }}
        loading={google.isPending}
        disabled={busy}
      />

      <View style={styles.footer}>
        <Text variant="label" color="muted">
          New to Q-Learn?
        </Text>
        <Link href="/signup" style={[styles.link, { color: theme.primary }]}>
          Create an account
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { fontSize: 14, fontWeight: '600', paddingVertical: Spacing.sm },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.xs },
});
