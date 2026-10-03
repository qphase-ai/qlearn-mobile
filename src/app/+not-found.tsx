import { router } from 'expo-router';

import { Button, EmptyState, Screen } from '@/components/ui';

export default function NotFoundScreen() {
  return (
    <Screen edges={[]}>
      <EmptyState icon="compass-outline" title="Page not found" message="This link doesn't match anything in Q-Learn." />
      <Button label="Go home" onPress={() => router.replace('/')} />
    </Screen>
  );
}
