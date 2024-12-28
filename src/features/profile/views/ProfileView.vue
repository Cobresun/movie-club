<template>
  <div class="flex justify-center">
    <div
      class="flex w-full max-w-5xl flex-col-reverse items-center justify-between p-8 md:flex-row"
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
  </div>
</template>
<script setup lang="ts">
import { computed, ref, Ref } from "vue";
import { useToast } from "vue-toastification";

import { useUser, useUpdateAvatar } from "@/service/useUser";

const { data, isFetching: isUserLoading } = useUser();
const fileInput: Ref<HTMLInputElement | null> = ref(null);

const openFileSelector = () => {
  fileInput.value?.click();
};

const { mutate, isLoading: isAvatarLoading } = useUpdateAvatar();
const toast = useToast();
const uploadAvatar = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;

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
