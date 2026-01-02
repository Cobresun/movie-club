<template>
  <div class="rounded-lg p-6">
    <h2 class="mb-4 text-xl font-semibold text-text">Change Password</h2>

    <!-- Success Message -->
    <div
      v-if="successMessage"
      class="mb-4 rounded bg-green-900/50 p-3 text-sm text-green-300"
    >
      {{ successMessage }}
    </div>

    <!-- Error Message -->
    <div
      v-if="errorMessage"
      class="mb-4 rounded bg-red-900/50 p-3 text-sm text-red-300"
    >
      {{ errorMessage }}
    </div>

    <form class="space-y-4" @submit.prevent="handleSubmit">
      <!-- Current Password -->
      <div>
        <label
          for="currentPassword"
          class="mb-1 block text-sm font-medium text-gray-300"
          >Current Password</label
        >
        <input
          id="currentPassword"
          v-model="currentPassword"
          type="password"
          required
          class="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Enter current password"
        />
      </div>

      <!-- New Password -->
      <div>
        <label
          for="newPassword"
          class="mb-1 block text-sm font-medium text-gray-300"
          >New Password</label
        >
        <input
          id="newPassword"
          v-model="newPassword"
          type="password"
          required
          minlength="8"
          class="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Min 8 characters"
        />
      </div>

      <!-- Confirm New Password -->
      <div>
        <label
          for="confirmNewPassword"
          class="mb-1 block text-sm font-medium text-gray-300"
          >Confirm New Password</label
        >
        <input
          id="confirmNewPassword"
          v-model="confirmNewPassword"
          type="password"
          required
          minlength="8"
          class="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Confirm new password"
        />
      </div>

      <!-- Revoke Other Sessions -->
      <div class="flex items-center gap-2">
        <input
          id="revokeOtherSessions"
          v-model="revokeOtherSessions"
          type="checkbox"
          class="h-4 w-4 rounded border-gray-600 bg-gray-700 text-primary focus:ring-primary"
        />
        <label for="revokeOtherSessions" class="text-sm text-gray-300">
          Sign out of all other devices
        </label>
      </div>

      <!-- Submit Button -->
      <button
        type="submit"
        :disabled="isLoading"
        class="rounded bg-primary px-4 py-2 font-medium text-text transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {{ isLoading ? "Changing..." : "Change Password" }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

import { isDefined } from "../../../../lib/checks/checks.js";

import { authClient } from "@/lib/auth-client";

const currentPassword = ref("");
const newPassword = ref("");
const confirmNewPassword = ref("");
const revokeOtherSessions = ref(true);
const isLoading = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

const handleSubmit = async () => {
  errorMessage.value = "";
  successMessage.value = "";

  // Validate passwords match
  if (newPassword.value !== confirmNewPassword.value) {
    errorMessage.value = "New passwords do not match.";
    return;
  }

  // Validate password length
  if (newPassword.value.length < 8) {
    errorMessage.value = "New password must be at least 8 characters.";
    return;
  }

  // Validate not same as current
  if (newPassword.value === currentPassword.value) {
    errorMessage.value =
      "New password must be different from current password.";
    return;
  }

  isLoading.value = true;

  try {
    const { error } = await authClient.changePassword({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
      revokeOtherSessions: revokeOtherSessions.value,
    });

    if (error) {
      if (
        isDefined(error.message) &&
        (error.message?.toLowerCase().includes("incorrect") ||
          error.message?.toLowerCase().includes("invalid"))
      ) {
        errorMessage.value = "Current password is incorrect.";
      } else {
        errorMessage.value =
          error.message ?? "Failed to change password. Please try again.";
      }
      isLoading.value = false;
      return;
    }

    successMessage.value = "Password changed successfully!";
    currentPassword.value = "";
    newPassword.value = "";
    confirmNewPassword.value = "";
  } catch {
    errorMessage.value = "An unexpected error occurred. Please try again.";
  } finally {
    isLoading.value = false;
  }
};
</script>
