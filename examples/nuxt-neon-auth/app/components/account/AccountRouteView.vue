<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import * as z from 'zod';

interface LinkedAccount {
  id: string;
  providerId: string;
  accountId: string;
}

interface AuthSession {
  id: string;
  token: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: Date | string;
  expiresAt: Date | string;
}

interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
}

interface UserInvitation {
  id: string;
  organizationId: string;
  organizationName: string;
  role: string;
  status: string;
}

const props = defineProps<{ path: string }>();

const toast = useToast();
const sessionState = useAuthSession();
const session = computed(() => sessionState.data.value);
const busy = ref(false);
const loading = ref(false);
const linkedAccounts = ref<LinkedAccount[]>([]);
const sessions = ref<AuthSession[]>([]);
const organizations = ref<OrganizationSummary[]>([]);
const invitations = ref<UserInvitation[]>([]);

const profileState = reactive({ name: '' });
const emailState = reactive({ email: '' });
const passwordState = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  revokeOtherSessions: true,
});
const organizationState = reactive({ name: '', slug: '' });

const profileSchema = z.object({ name: z.string().min(1, 'Name is required') });
const emailSchema = z.object({ email: z.email('Enter a valid email') });
const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string().min(8),
  revokeOtherSessions: z.boolean(),
}).refine(value => value.newPassword === value.confirmPassword, {
  message: 'Passwords must match',
  path: ['confirmPassword'],
});
const organizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  slug: z.string().optional(),
});

const normalizedPath = computed(() => (
  props.path === 'profile' ? 'settings' : props.path
));
const hasCredentialAccount = computed(() => (
  linkedAccounts.value.some(account => account.providerId === 'credential')
));
const activeOrganizationId = computed(() => (
  session.value?.session as { activeOrganizationId?: string } | undefined
)?.activeOrganizationId);

watch(
  () => session.value?.user,
  user => {
    profileState.name = user?.name || '';
    emailState.email = user?.email || '';
  },
  { immediate: true },
);

function notifySuccess(title: string, description?: string) {
  toast.add({
    title,
    description,
    color: 'success',
    icon: 'i-lucide-circle-check',
  });
}

function notifyError(error: unknown, fallback: string) {
  toast.add({
    title: fallback,
    description: authErrorMessage(error, fallback),
    color: 'error',
    icon: 'i-lucide-circle-alert',
  });
}

async function perform(action: () => Promise<void>, fallback: string) {
  busy.value = true;
  try {
    await action();
  } catch (error) {
    notifyError(error, fallback);
  } finally {
    busy.value = false;
  }
}

async function saveProfile(_event: FormSubmitEvent<{ name: string }>) {
  await perform(async () => {
    const result = await authClient.updateUser({ name: profileState.name });
    throwIfAuthError(result, 'Could not update your name');
    await sessionState.refetch();
    notifySuccess('Name updated');
  }, 'Could not update your name');
}

async function changeEmail(_event: FormSubmitEvent<{ email: string }>) {
  await perform(async () => {
    const result = await authClient.changeEmail({
      newEmail: emailState.email,
      callbackURL: '/account/settings',
    });
    throwIfAuthError(result, 'Could not change your email');
    notifySuccess('Verification sent', 'Confirm the new address from your email.');
  }, 'Could not change your email');
}

async function changePassword() {
  await perform(async () => {
    const result = await authClient.changePassword({
      currentPassword: passwordState.currentPassword,
      newPassword: passwordState.newPassword,
      revokeOtherSessions: passwordState.revokeOtherSessions,
    });
    throwIfAuthError(result, 'Could not change the password');
    passwordState.currentPassword = '';
    passwordState.newPassword = '';
    passwordState.confirmPassword = '';
    notifySuccess('Password changed');
    await loadSecurity();
  }, 'Could not change the password');
}

async function loadSecurity() {
  loading.value = true;
  try {
    const [accountResult, sessionResult] = await Promise.all([
      authClient.listAccounts(),
      authClient.listSessions(),
    ]);
    throwIfAuthError(accountResult, 'Could not load linked accounts');
    throwIfAuthError(sessionResult, 'Could not load sessions');
    linkedAccounts.value = (accountResult.data || []) as LinkedAccount[];
    sessions.value = (sessionResult.data || []) as AuthSession[];
  } catch (error) {
    notifyError(error, 'Could not load security details');
  } finally {
    loading.value = false;
  }
}

async function revokeSession(token: string) {
  await perform(async () => {
    const result = await authClient.revokeSession({ token });
    throwIfAuthError(result, 'Could not revoke the session');
    sessions.value = sessions.value.filter(item => item.token !== token);
    notifySuccess('Session revoked');
  }, 'Could not revoke the session');
}

async function linkGoogle() {
  await linkProvider('google');
}

async function linkGitHub() {
  await linkProvider('github');
}

async function linkProvider(provider: 'google' | 'github') {
  await perform(async () => {
    const result = await authClient.linkSocial({
      provider,
      callbackURL: '/account/security',
      errorCallbackURL: '/account/security?error=linking-failed',
    });
    throwIfAuthError(result, `Could not link ${provider}`);
  }, `Could not link ${provider}`);
}

async function unlinkAccount(account: LinkedAccount) {
  if (linkedAccounts.value.length <= 1) {
    notifyError(
      new Error('Keep at least one sign-in method linked to your account.'),
      'Could not unlink provider',
    );
    return;
  }

  await perform(async () => {
    const result = await authClient.unlinkAccount({
      providerId: account.providerId,
      accountId: account.accountId,
    });
    throwIfAuthError(result, 'Could not unlink the provider');
    notifySuccess('Provider unlinked');
    await loadSecurity();
  }, 'Could not unlink the provider');
}

async function loadOrganizations() {
  loading.value = true;
  try {
    const [organizationResult, invitationResult] = await Promise.all([
      authClient.organization.list(),
      authClient.organization.listUserInvitations(),
    ]);
    throwIfAuthError(organizationResult, 'Could not load organizations');
    throwIfAuthError(invitationResult, 'Could not load invitations');
    organizations.value = (organizationResult.data || []) as OrganizationSummary[];
    invitations.value = ((invitationResult.data || []) as UserInvitation[])
      .filter(invitation => invitation.status === 'pending');
  } catch (error) {
    notifyError(error, 'Could not load organizations');
  } finally {
    loading.value = false;
  }
}

async function createOrganization() {
  await perform(async () => {
    const slug = organizationState.slug.trim()
      || organizationState.name.trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/(^-|-$)/g, '');
    const result = await authClient.organization.create({
      name: organizationState.name.trim(),
      slug,
    });
    throwIfAuthError(result, 'Could not create the organization');
    organizationState.name = '';
    organizationState.slug = '';
    notifySuccess('Organization created');
    await loadOrganizations();
  }, 'Could not create the organization');
}

async function setActiveOrganization(organizationId: string) {
  await perform(async () => {
    const result = await authClient.organization.setActive({ organizationId });
    throwIfAuthError(result, 'Could not switch organizations');
    await sessionState.refetch();
    notifySuccess('Active organization changed');
  }, 'Could not switch organizations');
}

async function leaveOrganization(organizationId: string) {
  if (!window.confirm('Leave this organization?')) return;
  await perform(async () => {
    const result = await authClient.organization.leave({ organizationId });
    throwIfAuthError(result, 'Could not leave the organization');
    notifySuccess('You left the organization');
    await Promise.all([sessionState.refetch(), loadOrganizations()]);
  }, 'Could not leave the organization');
}

async function answerInvitation(invitation: UserInvitation, accept: boolean) {
  await perform(async () => {
    const result = accept
      ? await authClient.organization.acceptInvitation({ invitationId: invitation.id })
      : await authClient.organization.rejectInvitation({ invitationId: invitation.id });
    throwIfAuthError(result, 'Could not update the invitation');
    if (accept) {
      await authClient.organization.setActive({
        organizationId: invitation.organizationId,
      });
    }
    notifySuccess(accept ? `Joined ${invitation.organizationName}` : 'Invitation declined');
    await Promise.all([sessionState.refetch(), loadOrganizations()]);
  }, 'Could not update the invitation');
}

async function loadForPath() {
  if (normalizedPath.value === 'security') await loadSecurity();
  if (normalizedPath.value === 'organizations') await loadOrganizations();
}

onMounted(loadForPath);
watch(() => normalizedPath.value, loadForPath);
</script>

<template>
  <div>
    <div class="mb-8 flex flex-wrap gap-2">
      <UButton label="Settings" icon="i-lucide-settings" to="/account/settings" :variant="normalizedPath === 'settings' ? 'soft' : 'ghost'" color="neutral" />
      <UButton label="Security" icon="i-lucide-lock-keyhole" to="/account/security" :variant="normalizedPath === 'security' ? 'soft' : 'ghost'" color="neutral" />
      <UButton label="Organizations" icon="i-lucide-building-2" to="/account/organizations" :variant="normalizedPath === 'organizations' ? 'soft' : 'ghost'" color="neutral" />
    </div>

    <div v-if="normalizedPath === 'settings'" class="grid gap-6 lg:grid-cols-2">
      <UCard>
        <template #header>
          <div>
            <h2 class="font-semibold text-highlighted">Name</h2>
            <p class="text-sm text-muted">Update the name displayed across the app.</p>
          </div>
        </template>
        <UForm :schema="profileSchema" :state="profileState" class="space-y-4" @submit="saveProfile">
          <UFormField name="name" label="Name" required>
            <UInput v-model="profileState.name" autocomplete="name" class="w-full" />
          </UFormField>
          <UButton type="submit" label="Save" :loading="busy" />
        </UForm>
      </UCard>

      <UCard>
        <template #header>
          <div>
            <h2 class="font-semibold text-highlighted">Email</h2>
            <p class="text-sm text-muted">Changing email requires verification.</p>
          </div>
        </template>
        <UForm :schema="emailSchema" :state="emailState" class="space-y-4" @submit="changeEmail">
          <UFormField name="email" label="Email" required>
            <UInput v-model="emailState.email" type="email" autocomplete="email" class="w-full" />
          </UFormField>
          <UButton type="submit" label="Change email" :loading="busy" />
        </UForm>
      </UCard>
    </div>

    <div v-else-if="normalizedPath === 'security'" class="space-y-6">
      <UCard v-if="!loading && hasCredentialAccount">
        <template #header>
          <div>
            <h2 class="font-semibold text-highlighted">Change password</h2>
            <p class="text-sm text-muted">Use a unique password with at least eight characters.</p>
          </div>
        </template>
        <UForm :schema="passwordSchema" :state="passwordState" class="max-w-lg space-y-4" @submit="changePassword">
          <UFormField name="currentPassword" label="Current password" required>
            <UInput v-model="passwordState.currentPassword" type="password" autocomplete="current-password" class="w-full" />
          </UFormField>
          <UFormField name="newPassword" label="New password" required>
            <UInput v-model="passwordState.newPassword" type="password" autocomplete="new-password" class="w-full" />
          </UFormField>
          <UFormField name="confirmPassword" label="Confirm new password" required>
            <UInput v-model="passwordState.confirmPassword" type="password" autocomplete="new-password" class="w-full" />
          </UFormField>
          <UFormField name="revokeOtherSessions">
            <UCheckbox v-model="passwordState.revokeOtherSessions" label="Sign out other sessions" />
          </UFormField>
          <UButton type="submit" label="Change password" :loading="busy" />
        </UForm>
      </UCard>

      <UCard>
        <template #header>
          <div>
            <h2 class="font-semibold text-highlighted">Linked providers</h2>
            <p class="text-sm text-muted">Sign-in methods linked to your account.</p>
          </div>
        </template>
        <div v-if="loading" class="space-y-2">
          <USkeleton class="h-12 w-full" />
          <USkeleton class="h-12 w-full" />
        </div>
        <ul v-else-if="linkedAccounts.length" class="divide-y divide-default">
          <li v-for="account in linkedAccounts" :key="account.id" class="flex items-center justify-between py-3">
            <div>
              <p class="font-medium capitalize text-highlighted">{{ account.providerId }}</p>
              <p class="text-xs text-muted">{{ account.accountId }}</p>
            </div>
            <div class="flex items-center gap-2">
              <UBadge label="Linked" color="success" variant="soft" />
              <UButton
                label="Unlink"
                color="error"
                variant="ghost"
                size="sm"
                :disabled="linkedAccounts.length <= 1"
                @click="unlinkAccount(account)"
              />
            </div>
          </li>
        </ul>
        <UAlert v-else title="No linked providers" description="Only your credential account is currently available." variant="soft" />
        <template #footer>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="!linkedAccounts.some(account => account.providerId === 'google')"
              label="Link Google"
              icon="i-simple-icons-google"
              color="neutral"
              variant="outline"
              :loading="busy"
              @click="linkGoogle"
            />
            <UButton
              v-if="!linkedAccounts.some(account => account.providerId === 'github')"
              label="Link GitHub"
              icon="i-simple-icons-github"
              color="neutral"
              variant="outline"
              :loading="busy"
              @click="linkGitHub"
            />
          </div>
        </template>
      </UCard>

      <UCard>
        <template #header>
          <div>
            <h2 class="font-semibold text-highlighted">Sessions</h2>
            <p class="text-sm text-muted">Revoke sessions you no longer recognize.</p>
          </div>
        </template>
        <ul class="divide-y divide-default">
          <li v-for="item in sessions" :key="item.id" class="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="font-medium text-highlighted">{{ item.userAgent || 'Unknown browser' }}</p>
              <p class="text-xs text-muted">{{ item.ipAddress || 'Unknown IP' }} · expires {{ new Date(item.expiresAt).toLocaleDateString() }}</p>
            </div>
            <UButton label="Revoke" color="error" variant="soft" size="sm" :loading="busy" @click="revokeSession(item.token)" />
          </li>
        </ul>
      </UCard>
    </div>

    <div v-else-if="normalizedPath === 'organizations'" class="space-y-6">
      <UCard>
        <template #header>
          <div>
            <h2 class="font-semibold text-highlighted">Create organization</h2>
            <p class="text-sm text-muted">Create an organization, then invite members.</p>
          </div>
        </template>
        <UForm :schema="organizationSchema" :state="organizationState" class="grid gap-4 sm:grid-cols-2" @submit="createOrganization">
          <UFormField name="name" label="Name" required>
            <UInput v-model="organizationState.name" placeholder="Acme Inc." class="w-full" />
          </UFormField>
          <UFormField name="slug" label="Slug" hint="Optional">
            <UInput v-model="organizationState.slug" placeholder="acme-inc" class="w-full" />
          </UFormField>
          <div class="sm:col-span-2">
            <UButton type="submit" label="Create organization" icon="i-lucide-plus" :loading="busy" />
          </div>
        </UForm>
      </UCard>

      <UCard>
        <template #header>
          <div>
            <h2 class="font-semibold text-highlighted">Your organizations</h2>
            <p class="text-sm text-muted">Switch the active organization or leave one.</p>
          </div>
        </template>
        <div v-if="loading" class="space-y-2">
          <USkeleton class="h-16 w-full" />
          <USkeleton class="h-16 w-full" />
        </div>
        <ul v-else-if="organizations.length" class="divide-y divide-default">
          <li v-for="organization in organizations" :key="organization.id" class="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div class="flex items-center gap-2">
                <p class="font-medium text-highlighted">{{ organization.name }}</p>
                <UBadge v-if="organization.id === activeOrganizationId" label="Active" color="success" variant="soft" />
              </div>
              <p class="text-sm text-muted">{{ organization.slug }}</p>
            </div>
            <div class="flex gap-2">
              <UButton
                v-if="organization.id !== activeOrganizationId"
                label="Make active"
                color="neutral"
                variant="outline"
                size="sm"
                @click="setActiveOrganization(organization.id)"
              />
              <UButton label="Leave" color="error" variant="soft" size="sm" @click="leaveOrganization(organization.id)" />
            </div>
          </li>
        </ul>
        <UAlert v-else title="No organizations yet" description="Create your first organization above." variant="soft" />
      </UCard>

      <UCard v-if="invitations.length">
        <template #header>
          <h2 class="font-semibold text-highlighted">Pending invitations</h2>
        </template>
        <ul class="divide-y divide-default">
          <li v-for="invitation in invitations" :key="invitation.id" class="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="font-medium text-highlighted">{{ invitation.organizationName }}</p>
              <p class="text-sm text-muted">Invited as {{ invitation.role }}</p>
            </div>
            <div class="flex gap-2">
              <UButton label="Accept" size="sm" @click="answerInvitation(invitation, true)" />
              <UButton label="Decline" color="neutral" variant="outline" size="sm" @click="answerInvitation(invitation, false)" />
            </div>
          </li>
        </ul>
      </UCard>
    </div>

    <UAlert
      v-else
      title="Unknown account route"
      :description="`The account route “${path}” is not available.`"
      color="warning"
      variant="soft"
    />
  </div>
</template>
