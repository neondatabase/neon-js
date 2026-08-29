<script setup lang="ts">
import * as z from 'zod';

interface ActiveOrganization {
  id: string;
  name: string;
  slug: string;
}

interface OrganizationMember {
  id: string;
  userId: string;
  role: string;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

interface OrganizationInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: Date | string;
}

defineProps<{ path: string }>();

const toast = useToast();
const busy = ref(false);
const loading = ref(true);
const activeOrganization = ref<ActiveOrganization | null>(null);
const members = ref<OrganizationMember[]>([]);
const invitations = ref<OrganizationInvitation[]>([]);

const settingsState = reactive({ name: '', slug: '' });
const invitationState = reactive({
  email: '',
  role: 'member' as 'member' | 'admin',
});

const settingsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
});
const invitationSchema = z.object({
  email: z.email('Enter a valid email'),
  role: z.enum(['member', 'admin']),
});

function success(title: string, description?: string) {
  toast.add({
    title,
    description,
    color: 'success',
    icon: 'i-lucide-circle-check',
  });
}

function failure(error: unknown, title: string) {
  toast.add({
    title,
    description: authErrorMessage(error, title),
    color: 'error',
    icon: 'i-lucide-circle-alert',
  });
}

async function perform(action: () => Promise<void>, fallback: string) {
  busy.value = true;
  try {
    await action();
  } catch (error) {
    failure(error, fallback);
  } finally {
    busy.value = false;
  }
}

async function loadOrganization() {
  loading.value = true;
  try {
    const result = await authClient.organization.getFullOrganization();
    throwIfAuthError(result, 'Could not load the active organization');
    activeOrganization.value = (result.data || null) as ActiveOrganization | null;
    if (activeOrganization.value) {
      settingsState.name = activeOrganization.value.name;
      settingsState.slug = activeOrganization.value.slug;
      await Promise.all([loadMembers(), loadInvitations()]);
    } else {
      members.value = [];
      invitations.value = [];
    }
  } catch (error) {
    failure(error, 'Could not load the active organization');
  } finally {
    loading.value = false;
  }
}

async function loadMembers() {
  if (!activeOrganization.value) return;
  const result = await authClient.organization.listMembers({
    query: { organizationId: activeOrganization.value.id },
  });
  throwIfAuthError(result, 'Could not load members');
  members.value = (result.data?.members || []) as OrganizationMember[];
}

async function loadInvitations() {
  if (!activeOrganization.value) return;
  const result = await authClient.organization.listInvitations({
    query: { organizationId: activeOrganization.value.id },
  });
  throwIfAuthError(result, 'Could not load invitations');
  invitations.value = ((result.data || []) as OrganizationInvitation[])
    .filter(invitation => invitation.status === 'pending');
}

async function updateOrganization() {
  await perform(async () => {
    const result = await authClient.organization.update({
      data: {
        name: settingsState.name,
        slug: settingsState.slug,
      },
    });
    throwIfAuthError(result, 'Could not update the organization');
    success('Organization updated');
    await loadOrganization();
  }, 'Could not update the organization');
}

async function deleteOrganization() {
  if (!activeOrganization.value) return;
  if (!window.confirm('Delete this organization and all of its data?')) return;

  await perform(async () => {
    const result = await authClient.organization.delete({
      organizationId: activeOrganization.value!.id,
    });
    throwIfAuthError(result, 'Could not delete the organization');
    success('Organization deleted');
    await navigateTo('/account/organizations');
  }, 'Could not delete the organization');
}

async function inviteMember() {
  await perform(async () => {
    const result = await authClient.organization.inviteMember({
      email: invitationState.email,
      role: invitationState.role,
    });
    throwIfAuthError(result, 'Could not send the invitation');
    success('Invitation sent', `An invitation was sent to ${invitationState.email}.`);
    invitationState.email = '';
    invitationState.role = 'member';
    await loadInvitations();
  }, 'Could not send the invitation');
}

async function updateRole(memberId: string, role: string) {
  await perform(async () => {
    const result = await authClient.organization.updateMemberRole({
      memberId,
      role: role as 'owner' | 'admin' | 'member',
    });
    throwIfAuthError(result, 'Could not update the member role');
    success('Member role updated');
    await loadMembers();
  }, 'Could not update the member role');
}

async function removeMember(memberId: string) {
  if (!window.confirm('Remove this member from the organization?')) return;
  await perform(async () => {
    const result = await authClient.organization.removeMember({
      memberIdOrEmail: memberId,
    });
    throwIfAuthError(result, 'Could not remove the member');
    success('Member removed');
    await loadMembers();
  }, 'Could not remove the member');
}

async function cancelInvitation(invitationId: string) {
  await perform(async () => {
    const result = await authClient.organization.cancelInvitation({ invitationId });
    throwIfAuthError(result, 'Could not cancel the invitation');
    success('Invitation cancelled');
    invitations.value = invitations.value.filter(item => item.id !== invitationId);
  }, 'Could not cancel the invitation');
}

onMounted(loadOrganization);
</script>

<template>
  <div>
    <div class="mb-8 flex flex-wrap gap-2">
      <UButton label="Settings" icon="i-lucide-settings" to="/organization/settings" :variant="path === 'settings' ? 'soft' : 'ghost'" color="neutral" />
      <UButton label="Members" icon="i-lucide-users" to="/organization/members" :variant="path === 'members' ? 'soft' : 'ghost'" color="neutral" />
      <UButton label="Invitations" icon="i-lucide-mail-plus" to="/organization/invitations" :variant="path === 'invitations' ? 'soft' : 'ghost'" color="neutral" />
    </div>

    <div v-if="loading" class="space-y-3">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-48 w-full" />
    </div>

    <UAlert
      v-else-if="!activeOrganization"
      title="No active organization"
      description="Create or select an organization before opening organization settings."
      color="info"
      variant="soft"
      icon="i-lucide-building-2"
      :actions="[{ label: 'Manage organizations', to: '/account/organizations' }]"
    />

    <UCard v-else-if="path === 'settings'">
      <template #header>
        <div>
          <h2 class="font-semibold text-highlighted">Organization settings</h2>
          <p class="text-sm text-muted">Update the active organization’s name and slug.</p>
        </div>
      </template>
      <UForm :schema="settingsSchema" :state="settingsState" class="max-w-xl space-y-4" @submit="updateOrganization">
        <UFormField name="name" label="Organization name" required>
          <UInput v-model="settingsState.name" class="w-full" />
        </UFormField>
        <UFormField name="slug" label="Slug" required>
          <UInput v-model="settingsState.slug" class="w-full" />
        </UFormField>
        <UButton type="submit" label="Save changes" :loading="busy" />
      </UForm>
      <template #footer>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="font-medium text-error">Danger zone</p>
            <p class="text-sm text-muted">Deleting an organization cannot be undone.</p>
          </div>
          <UButton label="Delete organization" color="error" variant="soft" :loading="busy" @click="deleteOrganization" />
        </div>
      </template>
    </UCard>

    <div v-else-if="path === 'members'" class="space-y-6">
      <UCard>
        <template #header>
          <div>
            <h2 class="font-semibold text-highlighted">Invite member</h2>
            <p class="text-sm text-muted">Invite someone to the active organization.</p>
          </div>
        </template>
        <UForm :schema="invitationSchema" :state="invitationState" class="grid gap-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end" @submit="inviteMember">
          <UFormField name="email" label="Email" required>
            <UInput v-model="invitationState.email" type="email" placeholder="member@example.com" class="w-full" />
          </UFormField>
          <UFormField name="role" label="Role" required>
            <USelect v-model="invitationState.role" :items="['member', 'admin']" class="w-full" />
          </UFormField>
          <UButton type="submit" label="Send invitation" icon="i-lucide-send" :loading="busy" />
        </UForm>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold text-highlighted">Members</h2>
        </template>
        <ul v-if="members.length" class="divide-y divide-default">
          <li v-for="member in members" :key="member.id" class="grid gap-3 py-4 sm:grid-cols-[1fr_9rem_auto] sm:items-center">
            <div class="flex items-center gap-3">
              <UAvatar
                :src="member.user.image || undefined"
                :alt="member.user.name || member.user.email || 'Member'"
                :text="(member.user.name || member.user.email || '?').slice(0, 2)"
                size="sm"
              />
              <div>
                <p class="font-medium text-highlighted">{{ member.user.name || 'Unnamed member' }}</p>
                <p class="text-sm text-muted">{{ member.user.email }}</p>
              </div>
            </div>
            <USelect
              :model-value="member.role"
              :items="['owner', 'admin', 'member']"
              aria-label="Member role"
              @update:model-value="value => updateRole(member.id, String(value))"
            />
            <UButton
              label="Remove"
              icon="i-lucide-user-minus"
              color="error"
              variant="soft"
              size="sm"
              @click="removeMember(member.id)"
            />
          </li>
        </ul>
        <UAlert v-else title="No members found" variant="soft" />
      </UCard>
    </div>

    <UCard v-else-if="path === 'invitations'">
      <template #header>
        <div>
          <h2 class="font-semibold text-highlighted">Pending invitations</h2>
          <p class="text-sm text-muted">Invitations sent from the active organization.</p>
        </div>
      </template>
      <ul v-if="invitations.length" class="divide-y divide-default">
        <li v-for="invitation in invitations" :key="invitation.id" class="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="font-medium text-highlighted">{{ invitation.email }}</p>
            <p class="text-sm text-muted">
              {{ invitation.role }} · expires {{ new Date(invitation.expiresAt).toLocaleDateString() }}
            </p>
          </div>
          <UButton label="Cancel invitation" color="error" variant="soft" size="sm" @click="cancelInvitation(invitation.id)" />
        </li>
      </ul>
      <UAlert v-else title="No pending invitations" variant="soft" />
    </UCard>

    <UAlert
      v-else
      title="Unknown organization route"
      :description="`The organization route “${path}” is not available.`"
      color="warning"
      variant="soft"
    />
  </div>
</template>
