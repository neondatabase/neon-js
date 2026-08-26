<script setup lang="ts">
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui';
import * as z from 'zod';

const props = defineProps<{ path: string }>();

const route = useRoute();
const toast = useToast();
const sessionState = useAuthSession();
const busy = ref(false);
const message = ref('');
const errorMessage = ref('');
const otpSent = ref(false);

const otpState = reactive({ email: '', otp: '' });
const resetState = reactive({ password: '', confirmPassword: '' });
const verificationState = reactive({ email: '' });

const redirectTarget = computed(() => {
  const value = route.query.redirect;
  return typeof value === 'string' && value.startsWith('/') ? value : '/dashboard';
});

const credentialFields = computed<AuthFormField[]>(() => {
  if (props.path === 'sign-up') {
    return [
      {
        name: 'name',
        type: 'text',
        label: 'Name',
        placeholder: 'Your name',
        required: true,
      },
      {
        name: 'email',
        type: 'email',
        label: 'Email',
        placeholder: 'you@example.com',
        required: true,
      },
      {
        name: 'password',
        type: 'password',
        label: 'Password',
        placeholder: 'At least 8 characters',
        required: true,
      },
    ];
  }

  if (props.path === 'forgot-password') {
    return [{
      name: 'email',
      type: 'email',
      label: 'Email',
      placeholder: 'you@example.com',
      required: true,
    }];
  }

  return [
    {
      name: 'email',
      type: 'email',
      label: 'Email',
      placeholder: 'you@example.com',
      required: true,
    },
    {
      name: 'password',
      type: 'password',
      label: 'Password',
      placeholder: 'Your password',
      required: true,
    },
  ];
});

const credentialSchema = computed(() => {
  if (props.path === 'sign-up') {
    return z.object({
      name: z.string().min(1, 'Name is required'),
      email: z.email('Enter a valid email'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
    });
  }

  if (props.path === 'forgot-password') {
    return z.object({ email: z.email('Enter a valid email') });
  }

  return z.object({
    email: z.email('Enter a valid email'),
    password: z.string().min(1, 'Password is required'),
  });
});

const title = computed(() => ({
  'sign-in': 'Sign in',
  'sign-up': 'Create your account',
  'forgot-password': 'Reset your password',
}[props.path] || 'Neon Auth'));

const description = computed(() => ({
  'sign-in': 'Sign in with your email, Google or GitHub.',
  'sign-up': 'Sign up with email and password or a social provider.',
  'forgot-password': 'We will email you a password reset link.',
}[props.path] || 'Continue with Neon Auth.'));

const submitLabel = computed(() => ({
  'sign-in': 'Sign In',
  'sign-up': 'Sign Up',
  'forgot-password': 'Send reset link',
}[props.path] || 'Continue'));

const providers = computed(() => (
  ['sign-in', 'sign-up'].includes(props.path)
    ? [
        {
        label: 'Continue with Google',
        icon: 'i-simple-icons-google',
        color: 'neutral' as const,
        variant: 'outline' as const,
        onClick: signInWithGoogle,
        },
        {
          label: 'Continue with GitHub',
          icon: 'i-simple-icons-github',
          color: 'neutral' as const,
          variant: 'outline' as const,
          onClick: signInWithGitHub,
        },
      ]
    : []
));

function clearFeedback() {
  message.value = '';
  errorMessage.value = '';
}

async function run(action: () => Promise<void>) {
  clearFeedback();
  busy.value = true;
  try {
    await action();
  } catch (error) {
    errorMessage.value = authErrorMessage(error, 'Authentication failed. Please try again.');
    toast.add({
      title: 'Authentication error',
      description: errorMessage.value,
      color: 'error',
      icon: 'i-lucide-circle-alert',
    });
  } finally {
    busy.value = false;
  }
}

async function onCredentialSubmit(event: FormSubmitEvent<Record<string, string>>) {
  await run(async () => {
    if (props.path === 'sign-up') {
      const result = await authClient.signUp.email({
        name: event.data.name!,
        email: event.data.email!,
        password: event.data.password!,
        callbackURL: redirectTarget.value,
      });
      throwIfAuthError(result, 'Could not create the account');
      await sessionState.refetch();
      await navigateTo(redirectTarget.value);
      return;
    }

    if (props.path === 'forgot-password') {
      const result = await authClient.requestPasswordReset({
        email: event.data.email!,
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      throwIfAuthError(result, 'Could not send the reset email');
      message.value = 'Check your email for a password reset link.';
      return;
    }

    const result = await authClient.signIn.email({
      email: event.data.email!,
      password: event.data.password!,
      callbackURL: redirectTarget.value,
    });
    throwIfAuthError(result, 'Could not sign in');
    await sessionState.refetch();
    await navigateTo(redirectTarget.value);
  });
}

async function signInWithGoogle() {
  await signInWithSocial('google');
}

async function signInWithGitHub() {
  await signInWithSocial('github');
}

async function signInWithSocial(provider: 'google' | 'github') {
  await run(async () => {
    const result = await authClient.signIn.social({
      provider,
      callbackURL: redirectTarget.value,
    });
    throwIfAuthError(result, `Could not start ${provider} sign-in`);
  });
}

const otpSchema = z.object({
  email: z.email('Enter a valid email'),
  otp: z.string().optional(),
});

async function submitOtp() {
  await run(async () => {
    if (!otpSent.value) {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: otpState.email,
        type: 'sign-in',
      });
      throwIfAuthError(result, 'Could not send the code');
      otpSent.value = true;
      message.value = 'Enter the code sent to your email.';
      return;
    }

    const result = await authClient.signIn.emailOtp({
      email: otpState.email,
      otp: otpState.otp,
    });
    throwIfAuthError(result, 'The code could not be verified');
    await sessionState.refetch();
    await navigateTo(redirectTarget.value);
  });
}

const resetSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8),
}).refine(value => value.password === value.confirmPassword, {
  message: 'Passwords must match',
  path: ['confirmPassword'],
});

async function resetPassword() {
  const token = typeof route.query.token === 'string' ? route.query.token : '';
  await run(async () => {
    if (!token) throw new Error('The reset token is missing or invalid.');
    const result = await authClient.resetPassword({
      newPassword: resetState.password,
      token,
    });
    throwIfAuthError(result, 'Could not reset the password');
    toast.add({
      title: 'Password updated',
      description: 'You can now sign in with your new password.',
      color: 'success',
      icon: 'i-lucide-circle-check',
    });
    await navigateTo('/auth/sign-in');
  });
}

const verificationSchema = z.object({
  email: z.email('Enter a valid email'),
});

async function sendVerification() {
  await run(async () => {
    const result = await authClient.sendVerificationEmail({
      email: verificationState.email,
      callbackURL: redirectTarget.value,
    });
    throwIfAuthError(result, 'Could not send verification email');
    message.value = 'Verification email sent. Follow the link to verify your address.';
  });
}

async function finishEmailVerification() {
  const token = typeof route.query.token === 'string' ? route.query.token : '';
  if (!token) return;

  await run(async () => {
    const result = await authClient.verifyEmail({
      query: {
        token,
        callbackURL: redirectTarget.value,
      },
    });
    throwIfAuthError(result, 'Could not verify the email');
    await sessionState.refetch();
    await navigateTo(redirectTarget.value);
  });
}

async function finishSpecialRoute() {
  if (props.path === 'callback') {
    await sessionState.refetch();
    await navigateTo(sessionState.data.value?.user ? redirectTarget.value : '/auth/sign-in');
  }

  if (props.path === 'sign-out') {
    await authClient.signOut();
    await sessionState.refetch();
    await navigateTo('/');
  }

  if (props.path === 'accept-invitation') {
    const invitationId = [route.query.invitationId, route.query.id]
      .find(value => typeof value === 'string');

    await sessionState.refetch();
    if (!sessionState.data.value?.user) {
      await navigateTo({
        path: '/auth/sign-in',
        query: { redirect: route.fullPath },
      });
      return;
    }

    await run(async () => {
      if (typeof invitationId !== 'string') {
        throw new Error('The invitation ID is missing.');
      }
      const result = await authClient.organization.acceptInvitation({ invitationId });
      throwIfAuthError(result, 'Could not accept the invitation');
      await navigateTo('/account/organizations');
    });
  }
}

onMounted(async () => {
  if (props.path === 'email-verification' && route.query.token) {
    await finishEmailVerification();
    return;
  }
  await finishSpecialRoute();
});
</script>

<template>
  <UPageCard
    v-if="['sign-in', 'sign-up', 'forgot-password'].includes(path)"
    class="w-full max-w-md"
  >
    <UAuthForm
      :schema="credentialSchema"
      :fields="credentialFields"
      :providers="providers"
      :title="title"
      :description="description"
      icon="i-lucide-shield-check"
      :submit="{ label: submitLabel, loading: busy, block: true }"
      @submit="onCredentialSubmit"
    >
      <template v-if="path === 'sign-in'" #password-hint>
        <ULink to="/auth/forgot-password" class="font-medium text-primary">
          Forgot password?
        </ULink>
      </template>
      <template v-if="errorMessage" #validation>
        <UAlert
          :description="errorMessage"
          color="error"
          variant="soft"
          icon="i-lucide-circle-alert"
        />
      </template>
      <template #footer>
        <p v-if="message" class="text-sm text-success" role="status">{{ message }}</p>
        <template v-else-if="path === 'sign-in'">
          Need an account?
          <ULink to="/auth/sign-up" class="font-medium text-primary">Sign Up</ULink>
          or
          <ULink to="/auth/email-otp" class="font-medium text-primary">use email OTP</ULink>.
        </template>
        <template v-else-if="path === 'sign-up'">
          Already registered?
          <ULink to="/auth/sign-in" class="font-medium text-primary">Sign In</ULink>.
        </template>
        <template v-else>
          <ULink to="/auth/sign-in" class="font-medium text-primary">Back to Sign In</ULink>
        </template>
      </template>
    </UAuthForm>
  </UPageCard>

  <UPageCard
    v-else-if="path === 'email-otp'"
    class="w-full max-w-md"
    title="Sign in with email OTP"
    description="Request a one-time code, then enter it below."
    icon="i-lucide-mail-check"
  >
    <UForm :schema="otpSchema" :state="otpState" class="space-y-4" @submit="submitOtp">
      <UFormField name="email" label="Email" required>
        <UInput
          v-model="otpState.email"
          type="email"
          placeholder="you@example.com"
          :disabled="otpSent"
          class="w-full"
        />
      </UFormField>
      <UFormField v-if="otpSent" name="otp" label="Verification code" required>
        <UInput
          v-model="otpState.otp"
          inputmode="numeric"
          autocomplete="one-time-code"
          placeholder="Enter your code"
          class="w-full"
        />
      </UFormField>
      <UAlert v-if="errorMessage" :description="errorMessage" color="error" variant="soft" />
      <p v-if="message" class="text-sm text-success" role="status">{{ message }}</p>
      <UButton
        type="submit"
        :label="otpSent ? 'Verify code' : 'Send code'"
        :loading="busy"
        block
      />
    </UForm>
  </UPageCard>

  <UPageCard
    v-else-if="path === 'reset-password'"
    class="w-full max-w-md"
    title="Choose a new password"
    description="Use at least eight characters."
    icon="i-lucide-key-round"
  >
    <UForm :schema="resetSchema" :state="resetState" class="space-y-4" @submit="resetPassword">
      <UFormField name="password" label="New password" required>
        <UInput v-model="resetState.password" type="password" autocomplete="new-password" class="w-full" />
      </UFormField>
      <UFormField name="confirmPassword" label="Confirm password" required>
        <UInput v-model="resetState.confirmPassword" type="password" autocomplete="new-password" class="w-full" />
      </UFormField>
      <UAlert v-if="errorMessage" :description="errorMessage" color="error" variant="soft" />
      <UButton type="submit" label="Reset password" :loading="busy" block />
    </UForm>
  </UPageCard>

  <UPageCard
    v-else-if="path === 'email-verification'"
    class="w-full max-w-md"
    title="Verify your email"
    description="Request another verification link."
    icon="i-lucide-badge-check"
  >
    <UProgress v-if="route.query.token && busy" animation="carousel" />
    <UForm
      v-else
      :schema="verificationSchema"
      :state="verificationState"
      class="space-y-4"
      @submit="sendVerification"
    >
      <UFormField name="email" label="Email" required>
        <UInput v-model="verificationState.email" type="email" placeholder="you@example.com" class="w-full" />
      </UFormField>
      <UAlert v-if="errorMessage" :description="errorMessage" color="error" variant="soft" />
      <p v-if="message" class="text-sm text-success" role="status">{{ message }}</p>
      <UButton type="submit" label="Send verification email" :loading="busy" block />
    </UForm>
  </UPageCard>

  <UPageCard
    v-else-if="['callback', 'sign-out', 'accept-invitation'].includes(path)"
    class="w-full max-w-md text-center"
  >
    <div class="flex flex-col items-center gap-4 py-8" role="status">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
      <p class="text-sm text-muted">Completing your request…</p>
      <UAlert v-if="errorMessage" :description="errorMessage" color="error" variant="soft" />
    </div>
  </UPageCard>

  <UPageCard v-else class="w-full max-w-lg">
    <UAlert
      title="Unknown authentication route"
      :description="`The auth route “${path}” is not available.`"
      color="warning"
      variant="soft"
      icon="i-lucide-circle-help"
    />
    <template #footer>
      <UButton label="Go to Sign In" to="/auth/sign-in" />
    </template>
  </UPageCard>
</template>
