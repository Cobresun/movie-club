<template>
  <v-modal size="sm" @close="handleClose">
    <h2 class="mb-6 text-2xl font-bold text-text">
      {{ isSignUp ? "Sign Up" : "Sign In" }}
    </h2>

    <!-- Tab Switcher -->
    <div class="mb-6 flex border-b border-gray-600">
      <button
        :class="[
          'flex-1 pb-3 font-medium transition-colors',
          !isSignUp
            ? 'border-b-2 border-primary text-primary'
            : 'text-gray-400 hover:text-gray-300',
        ]"
        @click="isSignUp = false"
      >
        Sign In
      </button>
      <button
        :class="[
          'flex-1 pb-3 font-medium transition-colors',
          isSignUp
            ? 'border-b-2 border-primary text-primary'
            : 'text-gray-400 hover:text-gray-300',
        ]"
        @click="isSignUp = true"
      >
        Sign Up
      </button>
    </div>

    <!-- Google Login Button -->
    <button
      type="button"
      :disabled="loading"
      class="mb-4 flex w-full items-center justify-center gap-3 rounded border border-gray-600 bg-gray-700 px-4 py-2 font-medium text-text transition-all hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
      @click="handleGoogleLogin"
    >
      <img :src="googleLogo" alt="Google" class="h-5 w-5" />
      {{ isSignUp ? "Sign up with Google" : "Log in with Google" }}
    </button>

    <!-- Divider -->
    <div class="relative mb-4">
      <div class="absolute inset-0 flex items-center">
        <div class="w-full border-t border-gray-600"></div>
      </div>
      <div class="relative flex justify-center text-sm">
        <span class="bg-background px-2 text-gray-400">or</span>
      </div>
    </div>

    <!-- Error Message -->
    <div
      v-if="errorMessage"
      class="mb-4 rounded bg-red-900/50 p-3 text-sm text-red-300"
    >
      {{ errorMessage }}
      <button
        v-if="showResendVerification"
        type="button"
        class="mt-2 block text-primary hover:underline"
        @click="handleResendVerification"
      >
        Resend verification email
      </button>
    </div>

    <!-- Form -->
    <form class="space-y-4" @submit.prevent="handleSubmit">
      <!-- Name (Sign Up only) -->
      <div v-if="isSignUp">
        <label for="name" class="mb-1 block text-sm font-medium text-gray-300"
          >Name</label
        >
        <input
          id="name"
          v-model="name"
          type="text"
          required
          class="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Your name"
        />
      </div>

      <!-- Email -->
      <div>
        <label for="email" class="mb-1 block text-sm font-medium text-gray-300"
          >Email</label
        >
        <input
          id="email"
          v-model="email"
          type="email"
          required
          class="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="your@email.com"
        />
      </div>

      <!-- Password -->
      <div>
        <label
          for="password"
          class="mb-1 block text-sm font-medium text-gray-300"
          >Password</label
        >
        <input
          id="password"
          v-model="password"
          type="password"
          required
          minlength="8"
          class="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Min 8 characters"
        />
        <!-- Forgot Password Link (Sign In only) -->
        <div v-if="!isSignUp" class="mt-1 text-right">
          <router-link
            to="/forgot-password"
            class="text-sm text-primary hover:underline"
            @click="handleClose"
          >
            Forgot password?
          </router-link>
        </div>
      </div>

      <!-- Submit Button -->
      <button
        type="submit"
        :disabled="loading"
        class="w-full rounded bg-primary px-4 py-2 font-medium text-text transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {{ loading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In" }}
      </button>
    </form>
  </v-modal>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useToast } from "vue-toastification";

import googleLogo from "@/assets/images/google-logo.svg";
import { authClient } from "@/lib/auth-client";

const emit = defineEmits<{
  (e: "close"): void;
}>();

const toast = useToast();

const isSignUp = ref(false);
const email = ref("");
const password = ref("");
const name = ref("");
const loading = ref(false);
const errorMessage = ref("");
const showResendVerification = ref(false);

const handleClose = () => {
  // Reset form
  email.value = "";
  password.value = "";
  name.value = "";
  errorMessage.value = "";
  loading.value = false;
  isSignUp.value = false;
  showResendVerification.value = false;
  emit("close");
};

const handleSubmit = async () => {
  errorMessage.value = "";
  showResendVerification.value = false;
  loading.value = true;

  try {
    if (isSignUp.value) {
      // Sign Up
      await authClient.signUp.email(
        {
          email: email.value,
          password: password.value,
          name: name.value,
        },
        {
          onSuccess: () => {
            toast.success(
              "Account created! Please check your email to verify your account.",
            );
            handleClose();
          },
          onError: (ctx) => {
            errorMessage.value = ctx.error.message || "Failed to sign up";
          },
        },
      );
    } else {
      // Sign In
      await authClient.signIn.email(
        {
          email: email.value,
          password: password.value,
        },
        {
          onSuccess: () => {
            toast.success("Signed in successfully!");
            handleClose();
          },
          onError: (ctx) => {
            // Handle email verification required error
            if (ctx.error.status === 403) {
              errorMessage.value =
                "Please verify your email address before signing in. Check your inbox for a verification link.";
              showResendVerification.value = true;
            } else {
              errorMessage.value = ctx.error.message || "Failed to sign in";
            }
          },
        },
      );
    }
  } finally {
    loading.value = false;
  }
};

const handleResendVerification = async () => {
  try {
    await authClient.sendVerificationEmail({
      email: email.value,
      callbackURL: "/",
    });
    toast.success("Verification email sent! Please check your inbox.");
  } catch {
    toast.error("Failed to send verification email. Please try again.");
  }
};

const handleGoogleLogin = async () => {
  errorMessage.value = "";
  loading.value = true;

  // Set up a focus listener to detect when user returns from OAuth popup
  const handleFocus = () => {
    // Small delay to allow auth state to update
    setTimeout(() => {
      // If still not authenticated after returning to window, reset loading state
      if (loading.value) {
        loading.value = false;
      }
    }, 500);
    window.removeEventListener("focus", handleFocus);
  };

  // Add focus listener before opening OAuth popup
  window.addEventListener("focus", handleFocus);

  try {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
    });
  } catch {
    errorMessage.value = "Failed to sign in with Google. Please try again.";
    loading.value = false;
    window.removeEventListener("focus", handleFocus);
  }
};
</script>
