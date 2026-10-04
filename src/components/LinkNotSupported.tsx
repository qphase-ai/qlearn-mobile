import { router } from 'expo-router';

import { Button, EmptyState, Screen } from '@/components/ui';

/** Unknown paths and deep links with an invalid id (see features/linking/links.ts). */
export function LinkNotSupported() {
  return (
    <Screen edges={[]}>
      <EmptyState
        icon="compass-outline"
        title="Link not supported"
        message="This link isn't supported in the Q-Learn app yet, or it points to something that doesn't exist."
      />
      <Button label="Go home" onPress={() => router.replace('/')} />
    </Screen>
  );
}
