<script setup lang="ts">
const testRoutes = [
  { label: 'Sign In', path: '/auth/sign-in' },
  { label: 'Sign Up', path: '/auth/sign-up' },
  { label: 'Forgot Password', path: '/auth/forgot-password' },
] as const;

const iframeSrc = ref('/auth/sign-in');

useSeoMeta({ title: 'Iframe OAuth Test' });
</script>

<template>
  <UContainer class="max-w-6xl py-10">
    <UPageHeader
      title="SSO in iframe test"
      description="Use the embedded Nuxt auth flow to test OAuth popup behavior in a sandboxed iframe."
    />

    <UAlert
      class="mt-6"
      title="@neondatabase/auth supports OAuth inside iframes"
      description="The SDK detects the iframe, opens Google OAuth in a popup and returns the session verifier through postMessage."
      color="info"
      variant="soft"
      icon="i-lucide-sparkles"
      :actions="[{
        label: 'View package',
        to: 'https://www.npmjs.com/package/@neondatabase/auth',
        target: '_blank',
        color: 'neutral',
        variant: 'outline'
      }]"
    />

    <div class="mt-6 flex flex-wrap items-center gap-3">
      <span class="text-sm text-muted">Test route:</span>
      <UButton
        v-for="item in testRoutes"
        :key="item.path"
        :label="item.label"
        size="sm"
        color="neutral"
        :variant="iframeSrc === item.path ? 'soft' : 'outline'"
        @click="iframeSrc = item.path"
      />
    </div>

    <UCard class="mt-4 overflow-hidden" :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <code class="text-sm text-muted">iframe src: {{ iframeSrc }}</code>
      </template>
      <iframe
        :key="iframeSrc"
        :src="iframeSrc"
        title="Auth iframe test"
        class="block h-[600px] w-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </UCard>

    <UCard class="mt-6">
      <template #header>
        <h2 class="font-semibold text-highlighted">What to test</h2>
      </template>
      <ul class="list-disc space-y-2 pl-5 text-sm text-muted">
        <li>Click the Google button inside the iframe and confirm a popup opens.</li>
        <li>Complete OAuth and verify the signed-in session returns to the iframe.</li>
        <li>Confirm there are no X-Frame-Options or content-security-policy errors.</li>
        <li>Email/password and email reset flows should work without a popup.</li>
      </ul>
    </UCard>
  </UContainer>
</template>
