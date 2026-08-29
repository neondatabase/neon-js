<script setup lang="ts">
import AccountRouteView from '~/components/account/AccountRouteView.vue';

const route = useRoute();
const path = computed(() => String(route.params.path || 'settings'));

useSeoMeta({ title: () => `Account · ${path.value.replaceAll('-', ' ')}` });
</script>

<template>
  <UContainer class="py-10">
    <UPageHeader
      title="Account"
      description="Manage your profile, security, sessions and organizations."
    />
    <AccountRouteView :path="path" class="mt-8" />
  </UContainer>
</template>
