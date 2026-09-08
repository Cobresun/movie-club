<template>
  <div>
    <page-header has-back back-route="Clubs" page-name="Edit profile" hide-club />

    <div class="mx-auto w-full max-w-md px-4 pb-8">
      <section class="flex flex-col items-center gap-4 pt-2">
        <div class="relative">
          <v-avatar :src="user?.image" :name="user?.name ?? ''" :size="96" />
          <span
            v-if="isPhotoPending"
            class="absolute inset-0 flex items-center justify-center rounded-full bg-black/40"
            role="status"
            aria-label="Updating photo"
          >
            <mdicon name="loading" :size="32" class="animate-spin" />
          </span>
        </div>

        <div class="flex gap-3">
          <button
            class="flex min-h-[44px] items-center justify-center rounded-md px-4 text-[15px] font-semibold ring-1 ring-inset ring-white/[0.12] transition-colors duration-fast ease-standard hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="isPhotoPending"
            @click="openFileSelector"
          >
            Change photo
          </button>
          <button
            v-if="hasPhoto"
            class="flex min-h-[44px] items-center justify-center rounded-md px-4 text-[15px] font-semibold text-red-400 ring-1 ring-inset ring-white/[0.12] transition-colors duration-fast ease-standard hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="isPhotoPending"
            @click="removePhoto"
          >
            Remove photo
          </button>
        </div>

        <p class="text-xs text-white/40">Up to 6&nbsp;MB. Square images look best.</p>
      </section>

      <section class="mt-6 border-t border-white/10 pt-5">
        <h2 class="pb-3 text-[11px] font-semibold uppercase tracking-widest text-white/45">Name</h2>

        <form class="flex flex-col gap-4" @submit.prevent="saveName">
          <div class="flex flex-col gap-1.5">
            <label for="profile-name" class="text-[13px] font-medium text-white/60"
              >Your name</label
            >
            <input
              id="profile-name"
              v-model="editedName"
              type="text"
              class="min-h-[50px] rounded-[10px] bg-lowBackground px-3.5 text-[15px] text-white placeholder-white/35 ring-1 ring-inset ring-white/[0.12] focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter your name"
              maxlength="100"
            />
            <p v-if="nameError" class="text-sm text-red-400">{{ nameError }}</p>
            <p v-else class="text-xs text-white/40">Shown to everyone in your clubs</p>
          </div>

          <v-btn type="submit" class="min-h-[52px] w-full" :disabled="isNamePending">
            Save name
          </v-btn>
        </form>
      </section>

      <section class="mt-6 border-t border-white/10 pt-5">
        <h2 class="pb-3 text-[11px] font-semibold uppercase tracking-widest text-white/45">
          Password
        </h2>
        <ChangePasswordForm />
      </section>
    </div>

    <input ref="fileInput" type="file" accept="image/*" hidden @change="uploadAvatar" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from "vue";
import { useToast } from "vue-toastification";

import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import ChangePasswordForm from "../../auth/components/ChangePasswordForm.vue";
import { useDeleteAvatar, useUpdateAvatar, useUpdateName, useUser } from "@/service/useUser";

/**
 * Everything about the signed-in member that they can change, on one screen.
 * The account menu in the nav bar only points here: a security form, and a
 * field the mobile keyboard covers, both want a page rather than a sheet.
 */
const MAX_AVATAR_BYTES = 6 * 1024 * 1024;

const toast = useToast();
const user = useUser();

// ── Profile photo ──────────────────────────────────────────────────────────
const fileInput = useTemplateRef<HTMLInputElement>("fileInput");
const hasPhoto = computed(() => hasValue(user.value?.image));
const { mutate: updateAvatar, isPending: isAvatarPending } = useUpdateAvatar();
const { mutate: deleteAvatar, isPending: isDeletePending } = useDeleteAvatar();
const isPhotoPending = computed(() => isAvatarPending.value || isDeletePending.value);

const openFileSelector = () => {
  fileInput.value?.click();
};

const uploadAvatar = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!isDefined(input.files) || input.files.length === 0) return;

  const file = input.files[0];
  // Clearing the input is what lets the same file be picked twice — after a
  // rejected upload, or after removing the photo it was uploaded as.
  input.value = "";

  if (file.size > MAX_AVATAR_BYTES) {
    toast.error("The file size should not exceed 6MB");
    return;
  }

  const formData = new FormData();
  formData.append("avatar", file);
  updateAvatar(formData);
};

const removePhoto = () => {
  deleteAvatar();
};

// ── Name ───────────────────────────────────────────────────────────────────
const editedName = ref(user.value?.name ?? "");
const nameError = ref("");
const { mutate: updateName, isPending: isNamePending } = useUpdateName();

// The session resolves after this screen mounts on a cold load, and every
// mutation refreshes it, so the field follows the name the server last gave us.
watch(
  () => user.value?.name,
  (name) => {
    editedName.value = name ?? "";
  },
);

const saveName = () => {
  nameError.value = "";

  const trimmedName = editedName.value.trim();
  if (!hasValue(trimmedName)) {
    nameError.value = "Name cannot be empty";
    return;
  }
  if (trimmedName.length > 100) {
    nameError.value = "Name is too long (max 100 characters)";
    return;
  }

  updateName(trimmedName, {
    onSuccess: () => {
      toast.success("Name updated successfully");
    },
    onError: (error: unknown) => {
      nameError.value = error instanceof Error ? error.message : "Failed to update name";
    },
  });
};
</script>
