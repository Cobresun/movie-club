<template>
  <div class="flex min-h-[60vh] items-center justify-center p-8">
    <div class="w-full max-w-md rounded-lg bg-lowBackground p-8 shadow-lg">
      <h1 class="mb-6 text-center text-2xl font-bold text-text">
        Forgot Password
      </h1>

      <!-- Success State -->
      <div v-if="isSubmitted" class="space-y-4 text-center">
        <div
          class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-900/50"
        >
          <mdicon name="email-check" size="32" class="text-green-400" />
        </div>
        <h2 class="text-xl font-semibold text-text">Check your email</h2>
        <p class="text-gray-300">
          If an account exists for {{ email }}, we've sent a password reset
          link.
        </p>
        <p class="text-sm text-gray-400">
          Didn't receive an email? Check your spam folder or try again.
        </p>
        <div class="mt-4 space-y-2">
          <v-btn variant="secondary" @click="resetForm">Try Again</v-btn>
          <router-link
            to="/"
            class="block text-sm text-primary hover:underline"
          >
            Back to Home
          </router-link>
        </div>
      </div>

      <!-- Form State -->
      <form v-else class="space-y-4" @submit.prevent="handleSubmit">
        <p class="mb-4 text-gray-300">
          Enter your email address and we'll send you a link to reset your
          password.
        </p>

        <!-- Error Message -->
        <div
          v-if="errorMessage"
          class="rounded bg-red-900/50 p-3 text-sm text-red-300"
        >
          {{ errorMessage }}
        </div>

        <!-- Email -->
        <div>
          <label
            for="email"
            class="mb-1 block text-sm font-medium text-gray-300"
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

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="isLoading"
          class="w-full rounded bg-primary px-4 py-2 font-medium text-text transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {{ isLoading ? "Sending..." : "Send Reset Link" }}
        </button>

        <router-link
          to="/"
          class="block text-center text-sm text-primary hover:underline"
        >
          Back to Home
        </router-link>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

import { authClient } from "@/lib/auth-client";

const email = ref("");
const isLoading = ref(false);
const isSubmitted = ref(false);
const errorMessage = ref("");

const handleSubmit = async () => {
  errorMessage.value = "";
  isLoading.value = true;

  try {
    const { error } = await authClient.requestPasswordReset({
      email: email.value,
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      errorMessage.value = error.message ?? "Failed to send reset email.";
      isLoading.value = false;
      return;
    }

    // Always show success even if email doesn't exist (security best practice)
    isSubmitted.value = true;
  } catch {
    errorMessage.value = "An unexpected error occurred. Please try again.";
  } finally {
    isLoading.value = false;
  }
};

const resetForm = () => {
  email.value = "";
  isSubmitted.value = false;
  errorMessage.value = "";
};
</script>
