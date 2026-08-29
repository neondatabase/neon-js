<script setup lang="ts">
const sessionState = useAuthSession();
const session = computed(() => sessionState.data.value);

watchEffect(() => {
  if (
    import.meta.client &&
    !sessionState.isPending.value &&
    !session.value?.user
  ) {
    navigateTo('/auth/sign-in?redirect=/dashboard');
  }
});

const expiresAt = computed(() => {
  const value = session.value?.session.expiresAt;
  return value
    ? new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(value))
    : 'Unknown';
});

useSeoMeta({ title: 'Dashboard' });
</script>

<template>
  <UContainer class="py-10">
    <div v-if="sessionState.isPending.value" class="flex justify-center py-24">
      <UProgress class="max-w-sm" animation="carousel" />
    </div>

    <template v-else-if="session?.user">
      <UPageHeader
        title="Dashboard"
        description="View your account, session and app links."
      />

      <UPageGrid class="mt-8">
        <UPageCard title="Account Info" icon="i-lucide-user-round">
          <dl class="space-y-3 text-sm">
            <div>
              <dt class="text-muted">Email</dt>
              <dd class="font-medium text-highlighted">{{ session.user.email }}</dd>
            </div>
            <div>
              <dt class="text-muted">Name</dt>
              <dd class="font-medium text-highlighted">{{ session.user.name || 'Not set' }}</dd>
            </div>
            <div>
              <dt class="text-muted">User ID</dt>
              <dd class="break-all font-mono text-xs text-toned">{{ session.user.id }}</dd>
            </div>
          </dl>
          <template #footer>
            <UButton label="Manage Account" to="/account/settings" color="neutral" variant="outline" block />
          </template>
        </UPageCard>

        <UPageCard title="Session" icon="i-lucide-shield-check">
          <dl class="space-y-3 text-sm">
            <div>
              <dt class="text-muted">Status</dt>
              <dd class="mt-1 flex items-center gap-2 font-medium text-highlighted">
                <span class="size-2 rounded-full bg-success" aria-hidden="true" />
                Active
              </dd>
            </div>
            <div>
              <dt class="text-muted">Session ID</dt>
              <dd class="break-all font-mono text-xs text-toned">{{ session.session.id }}</dd>
            </div>
            <div>
              <dt class="text-muted">Expires</dt>
              <dd class="font-medium text-highlighted">{{ expiresAt }}</dd>
            </div>
          </dl>
        </UPageCard>

        <UPageCard title="Quick Actions" icon="i-lucide-zap">
          <div class="space-y-2">
            <UButton label="Settings" icon="i-lucide-settings" to="/account/settings" color="neutral" variant="outline" block />
            <UButton label="Security" icon="i-lucide-lock-keyhole" to="/account/security" color="neutral" variant="outline" block />
            <UButton label="Organizations" icon="i-lucide-building-2" to="/account/organizations" color="neutral" variant="outline" block />
            <UButton label="Notes" icon="i-lucide-sticky-note" to="/notes" color="neutral" variant="outline" block />
          </div>
        </UPageCard>
      </UPageGrid>
    </template>
  </UContainer>
</template>
