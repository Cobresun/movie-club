<template>
  <div>
    <div class="mb-4 flex items-center gap-1">
      <button
        class="-ml-2.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-colors duration-fast ease-standard hover:bg-white/10"
        aria-label="Back to account"
        @click="emit('back')"
      >
        <mdicon name="arrow-left" :size="24" class="text-white/60" />
      </button>
      <h2 class="flex-grow text-[17px] font-semibold text-text">Change password</h2>
    </div>

    <div v-if="errorMessage" class="mb-4 rounded bg-red-900/50 p-3 text-sm text-red-300">
      {{ errorMessage }}
    </div>

    <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
      <div class="flex flex-col gap-1.5">
        <label for="currentPassword" class="text-[13px] font-medium text-white/60">
          Current password
        </label>
        <input
          id="currentPassword"
          v-model="currentPassword"
          type="password"
          required
          :class="fieldClass"
          placeholder="Enter current password"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="newPassword" class="text-[13px] font-medium text-white/60">New password</label>
        <!-- A reveal toggle in place of a confirm field: it catches the same
             typos without a second box to fill in and mismatch. -->
        <div
          class="flex items-center gap-1 rounded-[10px] bg-lowBackground pr-1.5 ring-1 ring-inset ring-white/[0.12] focus-within:ring-2 focus-within:ring-primary"
        >
          <input
            id="newPassword"
            v-model="newPassword"
            :type="showNewPassword ? 'text' : 'password'"
            required
            minlength="8"
            class="min-h-[50px] flex-grow bg-transparent px-3.5 text-[15px] text-white placeholder-white/35 focus:outline-none"
            placeholder="At least 8 characters"
          />
          <button
            type="button"
            class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg transition-colors duration-fast ease-standard hover:bg-white/10"
            :aria-label="showNewPassword ? 'Hide password' : 'Show password'"
            :aria-pressed="showNewPassword"
            @click="showNewPassword = !showNewPassword"
          >
            <mdicon
              :name="showNewPassword ? 'eye-off-outline' : 'eye-outline'"
              :size="21"
              class="text-highlight"
            />
          </button>
        </div>
        <p class="text-xs text-white/40">At least 8 characters.</p>
      </div>

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

const emit = defineEmits<{
  (e: "back"): void;
}>();

const toast = useToast();

const currentPassword = ref("");
const newPassword = ref("");
const showNewPassword = ref(false);
const revokeOtherSessions = ref(true);
const isLoading = ref(false);
const errorMessage = ref("");

const fieldClass =
  "min-h-[50px] rounded-[10px] bg-lowBackground px-3.5 text-[15px] text-white placeholder-white/35 ring-1 ring-inset ring-white/[0.12] focus:outline-none focus:ring-2 focus:ring-primary";

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
    showNewPassword.value = false;
    emit("back");
  } catch {
    errorMessage.value = "An unexpected error occurred. Please try again.";
  } finally {
    isLoading.value = false;
  }
};
</script>
