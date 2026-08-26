<script setup lang="ts">
const sessionState = useAuthSession();
const signedIn = computed(() => Boolean(sessionState.data.value?.user));

useSeoMeta({ title: 'Neon Auth for Nuxt' });
</script>

<template>
  <div>
    <UPageHero
      headline="Nuxt 4 integration"
      title="Neon Auth and Postgres in Nuxt"
      description="A Neon Auth example using Nuxt server routes, Nitro middleware, Nuxt UI, organizations and user-scoped notes."
      :links="[
        {
          label: signedIn ? 'Open dashboard' : 'Create an account',
          to: signedIn ? '/dashboard' : '/auth/sign-up',
          icon: 'i-lucide-arrow-right',
          trailing: true
        },
        {
          label: 'Try iframe OAuth',
          to: '/iframe-test',
          color: 'neutral',
          variant: 'subtle',
          icon: 'i-lucide-panels-top-left'
        }
      ]"
    >
      <UPageCard
        title="Auth flows in this example"
        description="SSR session hydration, same-origin auth proxying, protected Nitro routes and responsive components."
        icon="i-lucide-shield-check"
        spotlight
        class="mx-auto max-w-xl"
      >
        <div class="grid grid-cols-2 gap-3">
          <UBadge label="Email + password" variant="soft" />
          <UBadge label="Google + GitHub OAuth" color="secondary" variant="soft" />
          <UBadge label="Email OTP" color="info" variant="soft" />
          <UBadge label="Organizations" color="success" variant="soft" />
        </div>
      </UPageCard>
    </UPageHero>

    <UPageSection
      id="features"
      headline="Implementation"
      title="Nuxt routes and components"
      description="The example uses Nuxt routes and components for auth proxying, data loading and navigation."
      :features="[
        {
          title: 'SSR-aware sessions',
          description: 'The Vue client uses Nuxt useFetch for server rendering and reactive client updates.',
          icon: 'i-lucide-server-cog'
        },
        {
          title: 'Protected Nitro routes',
          description: 'Global server middleware protects pages and finalizes OAuth verifier callbacks.',
          icon: 'i-lucide-route'
        },
        {
          title: 'User-scoped Postgres',
          description: 'Drizzle APIs only select, create and delete notes belonging to the signed-in user.',
          icon: 'i-lucide-database'
        }
      ]"
    />

    <UContainer class="pb-16">
      <UPageCTA
        title="Try the example"
        description="Sign up, create an organization and save your first note."
        :links="[
          { label: 'My notes', to: '/notes', icon: 'i-lucide-sticky-note' },
          { label: 'Account settings', to: '/account/settings', color: 'neutral', variant: 'subtle' }
        ]"
      />
    </UContainer>
  </div>
</template>
