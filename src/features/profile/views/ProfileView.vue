<template>
  <div class="flex flex-col items-center gap-8 p-8">
    <!-- Profile Info Section -->
    <div
      class="flex w-full max-w-5xl flex-col-reverse items-center justify-between md:flex-row"
    >
      <div class="text-left">
        <p class="text-lg font-semibold">Name:</p>
        <p class="mb-2">{{ data?.name }}</p>
        <p class="text-lg font-semibold">Email:</p>
        <p>{{ data?.email }}</p>
      </div>
      <div class="relative">
        <input ref="fileInput" type="file" hidden @change="uploadAvatar" />
        <button class="group relative cursor-pointer" @click="openFileSelector">
          <v-avatar
            class="mb-4 md:mb-0"
            :src="data?.image"
            :name="data?.name"
            size="160"
          />
          <div
            class="absolute left-0 top-0 h-full w-full items-center justify-center rounded-full bg-black bg-opacity-30"
            :class="{ flex: isLoading, 'hidden group-hover:flex': !isLoading }"
          >
            <loading-spinner v-if="isLoading" />
            <mdicon v-else name="pencil" size="32" />
          </div>
        </button>
        <button
          v-if="data?.image && !isLoading"
          class="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-colors hover:bg-red-600"
          title="Delete photo"
          @click="handleDeleteAvatar"
        >
          <mdicon name="close" size="24" />
        </button>
      </div>
    </div>

    <!-- Change Password Section -->
    <div class="w-full max-w-md">
      <v-btn @click="showPasswordModal = true">Change Password</v-btn>
    </div>

    <!-- Change Password Modal -->
    <v-modal v-if="showPasswordModal" @close="showPasswordModal = false">
      <ChangePasswordForm />
    </v-modal>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, Ref } from "vue";
import { useToast } from "vue-toastification";

import { isDefined } from "../../../../lib/checks/checks.js";
import ChangePasswordForm from "../../auth/components/ChangePasswordForm.vue";

import { useUser, useUpdateAvatar, useDeleteAvatar } from "@/service/useUser";

const { data, isFetching: isUserLoading } = useUser();
const fileInput: Ref<HTMLInputElement | null> = ref(null);
const showPasswordModal = ref(false);

const openFileSelector = () => {
  fileInput.value?.click();
};

const { mutate, isLoading: isAvatarLoading } = useUpdateAvatar();
const { mutate: deleteAvatar, isLoading: isDeleteLoading } = useDeleteAvatar();
const toast = useToast();
const uploadAvatar = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!isDefined(input.files) || input.files.length === 0) return;

  const file = input.files[0];
  const maxFileSize = 6 * 1024 * 1024;

  if (file.size > maxFileSize) {
    toast.error("The file size should not exceed 6MB");
    return;
  }

  const formData = new FormData();
  formData.append("avatar", input.files[0]);

  mutate(formData);
};

const handleDeleteAvatar = () => {
  deleteAvatar();
};

const isLoading = computed(
  () => isUserLoading.value || isAvatarLoading.value || isDeleteLoading.value,
);
</script>
