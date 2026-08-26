<script setup lang="ts">
import AuthRouteView from '~/components/auth/AuthRouteView.vue';

const route = useRoute();
const path = computed(() => String(route.params.path || 'sign-in'));

useSeoMeta({ title: () => path.value.replaceAll('-', ' ') });
</script>

<template>
  <UContainer class="flex min-h-[calc(100dvh-var(--ui-header-height))] flex-col items-center justify-center py-10">
    <AuthRouteView :path="path" />
    <p
      v-if="!['callback', 'sign-out'].includes(path)"
      class="mt-5 max-w-sm text-center text-xs text-muted"
    >
      By continuing, you agree to the application’s Terms of Service and Privacy Policy.
    </p>
  </UContainer>
</template>
