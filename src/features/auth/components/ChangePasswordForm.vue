<template>
  <div>
    <div v-if="errorMessage" class="mb-4 rounded bg-red-900/50 p-3 text-sm text-red-300">
      {{ errorMessage }}
    </div>

    <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
      <v-text-field
        v-model="currentPassword"
        label="Current password"
        type="password"
        required
        placeholder="Enter current password"
      />

      <v-text-field
        v-model="newPassword"
        label="New password"
        type="password"
        required
        revealable
        :minlength="8"
        placeholder="At least 8 characters"
        hint="At least 8 characters."
      />

      <label
        class="-mx-2 flex min-h-[56px] cursor-pointer items-center gap-3 rounded-lg border-t border-white/10 px-2 transition-colors duration-fast ease-standard hover:bg-white/5"
      >
        <span class="flex flex-grow flex-col gap-0.5">
          <span class="text-[15px] font-medium text-text">Sign out of all other devices</span>
          <span class="text-xs text-white/40">Ends every session except this one</span>
        </span>
        <input
          v-model="revokeOtherSessions"
          type="checkbox"
          class="peer sr-only"
          aria-label="Sign out of all other devices"
        />
        <span
          class="relative h-[22px] w-11 flex-shrink-0 rounded-full py-0.5 pl-1 transition-colors duration-base ease-standard peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-highlight"
          :class="revokeOtherSessions ? 'bg-primary' : 'bg-gray-600'"
        >
          <span
            class="block h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform duration-base ease-standard"
            :class="{ 'translate-x-full': revokeOtherSessions }"
          />
        </span>
      </label>

      <button
        type="submit"
        :disabled="isLoading"
        class="flex min-h-[52px] w-full items-center justify-center rounded-md bg-primary text-base font-bold tracking-wide text-text transition duration-fast ease-standard hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-600"
      >
        {{ isLoading ? "Updating…" : "Update password" }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useToast } from "vue-toastification";

import { isDefined } from "../../../../lib/checks/checks.js";
import { authClient } from "@/lib/auth-client";

const toast = useToast();

const currentPassword = ref("");
const newPassword = ref("");
const revokeOtherSessions = ref(true);
const isLoading = ref(false);
const errorMessage = ref("");

const handleSubmit = async () => {
  errorMessage.value = "";

  if (newPassword.value.length < 8) {
    errorMessage.value = "New password must be at least 8 characters.";
    return;
  }

  if (newPassword.value === currentPassword.value) {
    errorMessage.value = "New password must be different from current password.";
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
        errorMessage.value = error.message ?? "Failed to change password. Please try again.";
      }
      isLoading.value = false;
      return;
    }

    toast.success("Password changed successfully");
    currentPassword.value = "";
    newPassword.value = "";
  } catch {
    errorMessage.value = "An unexpected error occurred. Please try again.";
  } finally {
    isLoading.value = false;
  }
};
</script>
