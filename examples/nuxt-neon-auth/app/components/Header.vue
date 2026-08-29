<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui';

defineOptions({ name: 'AppHeader' });

const route = useRoute();
const config = useRuntimeConfig();
const toast = useToast();
const sessionState = useAuthSession();
const session = computed(() => sessionState.data.value);

const navigation = computed<NavigationMenuItem[]>(() => {
  const items: NavigationMenuItem[] = [
    { label: 'Iframe Test', icon: 'i-lucide-panels-top-left', to: '/iframe-test' },
  ];

  if (session.value?.user) {
    items.push(
      { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/dashboard' },
      { label: 'Organizations', icon: 'i-lucide-building-2', to: '/account/organizations' },
      { label: 'Notes', icon: 'i-lucide-sticky-note', to: '/notes' },
    );

    if (
      session.value.user.role === 'admin' &&
      config.public.adminPortalUrl
    ) {
      items.push({
        label: 'Admin',
        icon: 'i-lucide-shield-check',
        to: config.public.adminPortalUrl,
        target: '_blank',
      });
    }
  }

  return items.map(item => ({
    ...item,
    active: item.to === route.path,
  }));
});

async function signOut() {
  try {
    const result = await authClient.signOut();
    throwIfAuthError(result, 'Could not sign out');
    await sessionState.refetch();
    await navigateTo('/');
  } catch (error) {
    toast.add({
      title: 'Sign out failed',
      description: authErrorMessage(error, 'Please try again.'),
      color: 'error',
      icon: 'i-lucide-circle-alert',
    });
  }
}

const userMenu = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: session.value?.user.name || session.value?.user.email || 'Account',
      icon: 'i-lucide-user',
      type: 'label',
    },
  ],
  [
    { label: 'Account Settings', icon: 'i-lucide-settings', to: '/account/settings' },
    { label: 'Security', icon: 'i-lucide-lock-keyhole', to: '/account/security' },
  ],
  [
    {
      label: 'Sign Out',
      icon: 'i-lucide-log-out',
      color: 'error',
      onSelect: signOut,
    },
  ],
]);
</script>

<template>
  <UHeader>
    <template #title>
      <NuxtLink to="/" class="flex items-center gap-2" aria-label="Notely home">
        <UIcon name="i-lucide-sparkles" class="size-5 text-primary" />
        <span class="font-semibold text-highlighted">Notely</span>
      </NuxtLink>
    </template>

    <UNavigationMenu :items="navigation" />

    <template #right>
      <UButton
        icon="i-simple-icons-github"
        aria-label="View source on GitHub"
        color="neutral"
        variant="ghost"
        to="https://github.com/neondatabase/neon-js/tree/main/examples/nuxt-neon-auth"
        target="_blank"
      />
      <UColorModeSelect
        size="sm"
        color="neutral"
        variant="ghost"
        class="w-32"
      />

      <UDropdownMenu v-if="session?.user" :items="userMenu">
        <UButton
          color="neutral"
          variant="ghost"
          square
          aria-label="Open user menu"
        >
          <span data-slot="avatar" class="inline-flex">
            <UAvatar
              :src="session.user.image || undefined"
              :alt="session.user.name || session.user.email"
              :text="(session.user.name || session.user.email).slice(0, 2)"
              size="sm"
            />
          </span>
        </UButton>
      </UDropdownMenu>

      <UButton
        v-else
        label="Sign In"
        to="/auth/sign-in"
        color="neutral"
        variant="ghost"
      />
    </template>

    <template #body>
      <UNavigationMenu
        :items="navigation"
        orientation="vertical"
        class="-mx-2.5"
      />
      <UButton
        v-if="!session?.user"
        class="mt-4"
        label="Sign In"
        to="/auth/sign-in"
        block
      />
    </template>
  </UHeader>
</template>
