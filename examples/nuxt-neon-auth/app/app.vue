<script setup lang="ts">
import Header from '~/components/Header.vue';

useHead({
  htmlAttrs: { lang: 'en' },
  titleTemplate: title => title ? `${title} · Notely` : 'Notely · Neon Auth for Nuxt',
  meta: [
    {
      name: 'description',
      content: 'A Nuxt 4 example for Neon Auth, organizations and user-scoped notes.',
    },
  ],
});
</script>

<template>
  <UApp>
    <div class="flex min-h-dvh flex-col bg-default">
      <Header />
      <UMain class="flex-1">
        <NuxtPage />
      </UMain>
      <UFooter>
        <template #left>
          <p class="text-sm text-muted">
            Neon Auth + Nuxt 4 + Nuxt UI
          </p>
        </template>
        <template #right>
          <span class="text-sm text-muted">Uses Nuxt UI components.</span>
        </template>
      </UFooter>
    </div>
  </UApp>
</template>
