<template>
  <div class="flex min-h-[60vh] items-center justify-center p-8">
    <div class="w-full max-w-md rounded-lg bg-lowBackground p-8 shadow-lg">
      <!-- Success State -->
      <div v-if="isSuccess" class="space-y-4 text-center">
        <div
          class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-900/50"
        >
          <mdicon name="check" size="32" class="text-green-400" />
        </div>
        <h1 class="text-2xl font-bold text-text">Password Reset!</h1>
        <p class="text-gray-300">
          Your password has been reset successfully. You can now sign in with
          your new password.
        </p>
        <v-btn class="mt-4" @click="goToSignIn">Sign In</v-btn>
      </div>

      <!-- Invalid Token State -->
      <div v-else-if="isInvalidToken" class="space-y-4 text-center">
        <div
          class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-900/50"
        >
          <mdicon name="alert-circle" size="32" class="text-red-400" />
        </div>
        <h1 class="text-2xl font-bold text-text">Invalid or Expired Link</h1>
        <p class="text-gray-300">
          This password reset link is invalid or has expired. Please request a
          new one.
        </p>
        <router-link to="/forgot-password">
          <v-btn class="mt-4">Request New Link</v-btn>
        </router-link>
      </div>

      <!-- Form State -->
      <form v-else class="space-y-4" @submit.prevent="handleSubmit">
        <h1 class="mb-6 text-center text-2xl font-bold text-text">
          Reset Password
        </h1>

        <p class="mb-4 text-gray-300">Enter your new password below.</p>

        <!-- Error Message -->
        <div
          v-if="errorMessage"
          class="rounded bg-red-900/50 p-3 text-sm text-red-300"
        >
          {{ errorMessage }}
        </div>

        <!-- New Password -->
        <div>
          <label
            for="password"
            class="mb-1 block text-sm font-medium text-gray-300"
            >New Password</label
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
        </div>

        <!-- Confirm Password -->
        <div>
          <label
            for="confirmPassword"
            class="mb-1 block text-sm font-medium text-gray-300"
            >Confirm Password</label
          >
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            required
            minlength="8"
            class="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Confirm your password"
          />
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="isLoading"
          class="w-full rounded bg-primary px-4 py-2 font-medium text-text transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {{ isLoading ? "Resetting..." : "Reset Password" }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";

import { isDefined } from "../../../../lib/checks/checks.js";

import { authClient } from "@/lib/auth-client";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const password = ref("");
const confirmPassword = ref("");
const isLoading = ref(false);
const isSuccess = ref(false);
const isInvalidToken = ref(false);
const errorMessage = ref("");

const token = ref<string | null>(null);

onMounted(() => {
  const tokenParam = route.query.token as string;
  const errorParam = route.query.error as string;

  if (errorParam === "INVALID_TOKEN" || !tokenParam) {
    isInvalidToken.value = true;
    return;
  }

  token.value = tokenParam;
});

const handleSubmit = async () => {
  errorMessage.value = "";

  // Validate passwords match
  if (password.value !== confirmPassword.value) {
    errorMessage.value = "Passwords do not match.";
    return;
  }

  // Validate password length
  if (password.value.length < 8) {
    errorMessage.value = "Password must be at least 8 characters.";
    return;
  }

  if (!isDefined(token.value)) {
    isInvalidToken.value = true;
    return;
  }

  isLoading.value = true;

  try {
    const { error } = await authClient.resetPassword({
      newPassword: password.value,
      token: token.value,
    });

    if (error) {
      if (
        isDefined(error.message) &&
        (error.message?.includes("expired") ||
          error.message?.includes("invalid"))
      ) {
        isInvalidToken.value = true;
      } else {
        errorMessage.value =
          error.message ?? "Failed to reset password. Please try again.";
      }
      isLoading.value = false;
      return;
    }

    isSuccess.value = true;
  } catch {
    errorMessage.value = "An unexpected error occurred. Please try again.";
  } finally {
    isLoading.value = false;
  }
};

const goToSignIn = () => {
  auth.login();
  router.push({ name: "Clubs" }).catch(console.error);
};
</script>
