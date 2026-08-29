<script setup lang="ts">
import NotesBoard from '~/components/notes/NotesBoard.vue';

useSeoMeta({ title: 'Notes' });
</script>

<template>
  <UContainer class="max-w-3xl py-10">
    <UPageHeader
      title="Notes"
      description="View and add your latest 15 notes."
    >
      <template #headline>
        <div class="flex items-center gap-2 text-primary">
          <UIcon name="i-lucide-sticky-note" class="size-5" />
          <span>Your notes</span>
        </div>
      </template>
    </UPageHeader>
    <NotesBoard class="mt-8" />
  </UContainer>
</template>
