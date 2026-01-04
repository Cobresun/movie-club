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

import { useUser, useUpdateAvatar } from "@/service/useUser";

const { data, isFetching: isUserLoading } = useUser();
const fileInput: Ref<HTMLInputElement | null> = ref(null);
const showPasswordModal = ref(false);

const openFileSelector = () => {
  fileInput.value?.click();
};

const { mutate, isLoading: isAvatarLoading } = useUpdateAvatar();
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

const isLoading = computed(() => isUserLoading.value || isAvatarLoading.value);
</script>
