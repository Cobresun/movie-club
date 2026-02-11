<template>
  <div class="flex flex-col items-center gap-8 p-8">
    <!-- Profile Info Section -->
    <div
      class="flex w-full max-w-5xl flex-col-reverse items-center justify-between md:flex-row"
    >
      <div class="text-left">
        <p class="text-lg font-semibold">Name:</p>
        <div v-if="!isEditingName" class="mb-2 flex items-center gap-2">
          <p>{{ data?.name }}</p>
          <button
            class="text-gray-400 transition-colors hover:text-primary"
            title="Edit name"
            @click="startEditingName"
          >
            <mdicon name="pencil" size="20" />
          </button>
        </div>
        <div v-else class="mb-2 flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <input
              v-model="editedName"
              type="text"
              class="rounded border border-gray-600 bg-gray-700 px-3 py-1 text-white placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Enter your name"
              maxlength="100"
              @keyup.enter="saveName"
              @keyup.escape="cancelEditingName"
            />
            <button
              class="text-green-500 transition-colors hover:text-green-400"
              title="Save"
              :disabled="isNamePending"
              @click="saveName"
            >
              <mdicon name="check" size="24" />
            </button>
            <button
              class="text-red-500 transition-colors hover:text-red-400"
              title="Cancel"
              :disabled="isNamePending"
              @click="cancelEditingName"
            >
              <mdicon name="close" size="24" />
            </button>
          </div>
          <p v-if="nameError" class="text-sm text-red-400">{{ nameError }}</p>
        </div>
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

import { isDefined, hasValue } from "../../../../lib/checks/checks.js";
import ChangePasswordForm from "../../auth/components/ChangePasswordForm.vue";

import {
  useUser,
  useUpdateAvatar,
  useDeleteAvatar,
  useUpdateName,
} from "@/service/useUser";

const data = useUser();
const fileInput: Ref<HTMLInputElement | null> = ref(null);
const showPasswordModal = ref(false);

// Name editing state
const isEditingName = ref(false);
const editedName = ref("");
const nameError = ref("");

const openFileSelector = () => {
  fileInput.value?.click();
};

const { mutate, isPending: isAvatarPending } = useUpdateAvatar();
const { mutate: deleteAvatar, isPending: isDeletePending } = useDeleteAvatar();
const { mutate: updateName, isPending: isNamePending } = useUpdateName();
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

const startEditingName = () => {
  editedName.value = data.value?.name ?? "";
  nameError.value = "";
  isEditingName.value = true;
};

const cancelEditingName = () => {
  isEditingName.value = false;
  editedName.value = "";
  nameError.value = "";
};

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
      isEditingName.value = false;
      editedName.value = "";
    },
    onError: (error: unknown) => {
      nameError.value =
        error instanceof Error ? error.message : "Failed to update name";
    },
  });
};

const isLoading = computed(
  () => isAvatarPending.value || isDeletePending.value,
);
</script>
