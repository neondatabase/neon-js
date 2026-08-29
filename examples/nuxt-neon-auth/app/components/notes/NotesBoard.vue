<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import * as z from 'zod';

interface Note {
  id: string;
  title: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

const toast = useToast();
const route = useRoute();
const apiState = reactive({ title: '' });
const adding = ref(false);
const deletingId = ref('');

const noteSchema = z.object({
  title: z.string().trim().min(1, 'Enter a note'),
});

const {
  data: notes,
  status,
  error,
  refresh,
} = await useFetch<Note[]>('/api/notes', {
  key: 'user-notes',
  default: () => [],
});

async function addNote(event: FormSubmitEvent<{ title: string }>) {
  adding.value = true;
  try {
    await $fetch('/api/notes', {
      method: 'POST',
      body: { title: event.data.title.trim() },
    });
    apiState.title = '';
    await refresh();
    toast.add({
      title: 'Note added',
      color: 'success',
      icon: 'i-lucide-circle-check',
    });
  } catch (error) {
    toast.add({
      title: 'Could not add note',
      description: authErrorMessage(error, 'Please try again.'),
      color: 'error',
      icon: 'i-lucide-circle-alert',
    });
  } finally {
    adding.value = false;
  }
}

async function deleteNote(id: string) {
  deletingId.value = id;
  try {
    await $fetch(`/api/notes/${id}`, { method: 'DELETE' });
    await refresh();
  } catch (error) {
    toast.add({
      title: 'Could not delete note',
      description: authErrorMessage(error, 'Please try again.'),
      color: 'error',
      icon: 'i-lucide-circle-alert',
    });
  } finally {
    deletingId.value = '';
  }
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
</script>

<template>
  <div>
    <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
      Add via API route
    </p>
    <UForm :schema="noteSchema" :state="apiState" class="mb-8" @submit="addNote">
      <UFormField name="title" label="Quick note" required>
        <div class="flex gap-2">
          <UInput
            v-model="apiState.title"
            name="title"
            placeholder="Add a quick note..."
            :disabled="adding"
            class="flex-1"
            size="lg"
          />
          <UButton
            type="submit"
            icon="i-lucide-plus"
            aria-label="Add note"
            :loading="adding"
            :disabled="!apiState.title.trim()"
            size="lg"
          />
        </div>
      </UFormField>
    </UForm>

    <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
      Add via native Nitro POST
    </p>
    <form action="/notes" method="post" class="mb-8">
      <div class="flex gap-2">
        <UInput
          name="title"
          aria-label="Server action note"
          placeholder="Add a note via server action..."
          required
          class="flex-1"
          size="lg"
        />
        <UButton
          type="submit"
          icon="i-lucide-plus"
          aria-label="Add note via server action"
          size="lg"
        />
      </div>
    </form>

    <UAlert
      v-if="route.query.error === 'missing-title'"
      title="A note title is required"
      color="warning"
      variant="soft"
      class="mb-6"
    />
    <UAlert
      v-if="error"
      title="Could not load notes"
      :description="error.message"
      color="error"
      variant="soft"
      class="mb-6"
    />

    <div v-if="status === 'pending'" class="space-y-3">
      <USkeleton class="h-20 w-full" />
      <USkeleton class="h-20 w-full" />
    </div>

    <UCard v-else-if="!notes.length" class="text-center">
      <div class="flex flex-col items-center gap-3 py-8">
        <UIcon name="i-lucide-sticky-note" class="size-10 text-dimmed" />
        <div>
          <h2 class="font-medium text-highlighted">No notes yet</h2>
          <p class="text-sm text-muted">Add your first note using a form above.</p>
        </div>
      </div>
    </UCard>

    <div v-else class="space-y-3">
      <UCard
        v-for="note in notes"
        :key="note.id"
        class="group flex items-start justify-between gap-4"
      >
        <div class="min-w-0 flex-1">
          <p class="text-default">{{ note.title }}</p>
          <p class="mt-1 text-xs text-muted">{{ formatDate(note.createdAt) }}</p>
        </div>
        <UButton
          icon="i-lucide-trash-2"
          aria-label="Delete note"
          color="error"
          variant="ghost"
          :loading="deletingId === note.id"
          @click="deleteNote(note.id)"
        />
      </UCard>
    </div>
  </div>
</template>
