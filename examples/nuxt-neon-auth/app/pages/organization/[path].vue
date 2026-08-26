<script setup lang="ts">
import OrganizationRouteView from '~/components/organization/OrganizationRouteView.vue';

const route = useRoute();
const path = computed(() => String(route.params.path || 'settings'));

useSeoMeta({ title: () => `Organization · ${path.value.replaceAll('-', ' ')}` });
</script>

<template>
  <UContainer class="py-10">
    <UPageHeader
      title="Organization"
      description="Manage the active organization, members and invitations."
    />
    <OrganizationRouteView :path="path" class="mt-8" />
  </UContainer>
</template>
