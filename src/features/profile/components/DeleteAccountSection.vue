<template>
  <section class="mt-6 border-t border-white/10 pt-5">
    <h2 class="pb-3 text-[11px] font-semibold tracking-widest text-white/45 uppercase">
      Delete account
    </h2>

    <p class="pb-4 text-sm text-white/60">
      Your scores, comments and photo are deleted and you leave every club. Clubs and the works you
      added stay with their other members. This can't be undone.
    </p>

    <button
      v-if="!isConfirming"
      class="duration-fast ease-standard min-h-[52px] w-full rounded-md border border-red-500 font-bold text-red-400 transition-colors hover:bg-red-500/10"
      @click="isConfirming = true"
    >
      Delete account
    </button>

    <form v-else class="flex flex-col gap-4" @submit.prevent="confirmDelete">
      <div v-if="errorMessage" role="alert" class="rounded bg-red-900/50 p-3 text-sm text-red-300">
        {{ errorMessage }}
      </div>

      <v-text-field
        v-if="hasPassword"
        v-model="password"
        label="Password"
        type="password"
        required
        placeholder="Enter your password to confirm"
      />

      <div class="flex gap-3">
        <button
          type="button"
          class="min-h-[52px] flex-1 rounded-md bg-gray-600 font-bold text-white hover:brightness-110 disabled:opacity-50"
          :disabled="isPending"
          @click="cancel"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="min-h-[52px] flex-1 rounded-md bg-red-500 font-bold text-white hover:brightness-110 disabled:opacity-50"
          :disabled="isPending || isCheckingPassword"
        >
          {{ isPending ? "Deleting…" : "Delete my account" }}
        </button>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";

import { isTrue } from "../../../../lib/checks/checks.js";
import { useDeleteAccount, useHasPassword } from "@/service/useUser";

const isConfirming = ref(false);
const password = ref("");
const errorMessage = ref("");

const { data: hasPassword, isLoading: isCheckingPassword } = useHasPassword({
  enabled: isConfirming,
});
const { mutate: deleteAccount, isPending } = useDeleteAccount();

const cancel = () => {
  isConfirming.value = false;
  password.value = "";
  errorMessage.value = "";
};

const confirmDelete = () => {
  errorMessage.value = "";
  deleteAccount(isTrue(hasPassword.value) ? password.value : undefined, {
    onError: (error: unknown) => {
      errorMessage.value =
        error instanceof Error ? error.message : "Couldn't delete your account. Please try again.";
    },
  });
};
</script>
