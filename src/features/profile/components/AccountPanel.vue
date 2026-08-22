<template>
  <!-- Every secondary view — name editor, photo actions, password — swaps in
       place rather than opening over the top, so nothing here ever unmounts the
       sheet the user is standing in. Height is animated because a snap resize
       inside a bottom sheet reads as the sheet jumping. -->
  <AnimatedHeight>
    <div v-if="view === 'password'" class="px-4 pb-1">
      <ChangePasswordForm @back="view = 'main'" />
    </div>

    <div v-else-if="view === 'photo'">
      <div class="flex items-center gap-1" :class="dense ? 'px-2 py-2' : 'px-2 pb-1'">
        <button
          class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-colors duration-fast ease-standard hover:bg-white/10"
          aria-label="Back to account"
          @click="view = 'main'"
        >
          <mdicon name="arrow-left" :size="dense ? 20 : 24" class="text-white/60" />
        </button>
        <h2 class="flex-grow font-semibold" :class="dense ? 'text-[15px]' : 'text-[17px]'">
          Profile photo
        </h2>
      </div>

      <button :class="rowClass" @click="openFileSelector">
        <mdicon name="image-outline" :size="iconSize" class="flex-shrink-0 text-white/60" />
        <span class="flex-grow">Choose a photo</span>
      </button>

      <button :class="rowClass" @click="removePhoto">
        <mdicon name="delete-outline" :size="iconSize" class="flex-shrink-0 text-red-400" />
        <span class="flex-grow text-red-400">Remove photo</span>
      </button>

      <p class="px-4 pb-1 pt-1.5 text-xs leading-relaxed text-white/40">
        Up to 6&nbsp;MB. Square images look best.
      </p>
    </div>

    <div v-else>
      <div class="flex items-center px-4" :class="dense ? 'gap-3 py-3.5' : 'gap-3.5 pb-4 pt-0.5'">
        <button
          class="relative flex-shrink-0 rounded-full"
          :aria-label="hasPhoto ? 'Profile photo options' : 'Add a profile photo'"
          @click="onPhotoClick"
        >
          <v-avatar :src="user?.image" :name="user?.name ?? ''" :size="avatarSize" />
          <span
            class="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-primary"
            :class="
              dense
                ? 'h-[21px] w-[21px] ring-[2.5px] ring-lowBackground'
                : 'h-[26px] w-[26px] ring-[3px] ring-background'
            "
          >
            <mdicon name="camera" :size="dense ? 12 : 15" />
          </span>
          <span
            v-if="isPhotoPending"
            class="absolute inset-0 flex items-center justify-center rounded-full bg-black/40"
          >
            <mdicon name="loading" :size="dense ? 20 : 26" class="animate-spin" />
          </span>
        </button>

        <div class="flex min-w-0 flex-col gap-0.5">
          <span
            class="truncate font-semibold leading-tight"
            :class="dense ? 'text-[15px]' : 'text-[17px]'"
          >
            {{ user?.name }}
          </span>
          <span
            class="truncate leading-tight text-white/50"
            :class="dense ? 'text-xs' : 'text-[13px]'"
          >
            {{ user?.email }}
          </span>
        </div>
      </div>

      <div v-if="dense" class="border-t border-white/10" />

      <div :class="sectionLabelClass">Account</div>

      <button v-if="!isEditingName" :class="rowClass" @click="startEditingName">
        <mdicon name="pencil" :size="iconSize" class="flex-shrink-0 text-white/60" />
        <span class="flex-grow">Edit name</span>
        <mdicon name="chevron-right" :size="chevronSize" class="flex-shrink-0 text-white/35" />
      </button>

      <div v-else class="flex flex-col gap-2.5 px-4 pb-3.5 pt-1">
        <label class="text-[13px] font-medium text-white/60" for="account-name">Your name</label>
        <input
          id="account-name"
          ref="nameInput"
          v-model="editedName"
          type="text"
          class="min-h-[50px] rounded-[10px] bg-lowBackground px-3.5 text-[15px] text-white placeholder-white/35 ring-1 ring-inset ring-white/[0.12] focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Enter your name"
          maxlength="100"
          @keyup.enter="saveName"
          @keyup.escape="cancelEditingName"
        />
        <p v-if="nameError" class="text-sm text-red-400">{{ nameError }}</p>
        <div class="flex items-center justify-between gap-3">
          <span class="text-xs text-white/40">Shown to everyone in your clubs</span>
          <div class="flex flex-shrink-0 gap-2">
            <button
              class="min-h-[44px] rounded-md px-3.5 text-[15px] font-semibold text-white/60 ring-1 ring-inset ring-white/[0.12] transition-colors duration-fast ease-standard hover:bg-white/10"
              @click="cancelEditingName"
            >
              Cancel
            </button>
            <v-btn class="min-h-[44px] px-2" :disabled="isNamePending" @click="saveName">
              Save
            </v-btn>
          </div>
        </div>
      </div>

      <button :class="rowClass" @click="view = 'password'">
        <mdicon name="lock-outline" :size="iconSize" class="flex-shrink-0 text-white/60" />
        <span class="flex-grow">Change password</span>
        <mdicon name="chevron-right" :size="chevronSize" class="flex-shrink-0 text-white/35" />
      </button>

      <div class="mt-2 border-t border-white/10">
        <button :class="rowClass" @click="logout">
          <mdicon name="logout" :size="iconSize" class="flex-shrink-0 text-white/60" />
          <span class="flex-grow text-orange-300">Log out</span>
        </button>
      </div>
    </div>
  </AnimatedHeight>

  <input ref="fileInput" type="file" accept="image/*" hidden @change="uploadAvatar" />
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from "vue";
import { useToast } from "vue-toastification";

import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import ChangePasswordForm from "../../auth/components/ChangePasswordForm.vue";
import AnimatedHeight from "@/common/components/AnimatedHeight.vue";
import { useDeleteAvatar, useUpdateAvatar, useUpdateName, useUser } from "@/service/useUser";
import { useAuthStore } from "@/stores/auth";

/**
 * The contents of the account menu, shared by both of its containers: a bottom
 * sheet on mobile and a popover anchored under the nav avatar on desktop.
 * `dense` is the desktop dressing — smaller avatar, icons and rows — since a
 * pointer doesn't need 56px targets.
 */
const { dense = false } = defineProps<{ dense?: boolean }>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const MAX_AVATAR_BYTES = 6 * 1024 * 1024;

const authStore = useAuthStore();
const toast = useToast();
const user = useUser();

const view = ref<"main" | "photo" | "password">("main");
const hasPhoto = computed(() => hasValue(user.value?.image));

const rowClass = computed(() =>
  dense
    ? "flex min-h-[40px] w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors duration-fast ease-standard hover:bg-white/10"
    : "flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] font-medium transition-colors duration-fast ease-standard hover:bg-white/10",
);
const sectionLabelClass = computed(
  () =>
    `text-[11px] font-semibold uppercase tracking-widest text-white/45 ${
      dense ? "px-4 pb-1.5 pt-3" : "px-4 pb-2 pt-1"
    }`,
);
const iconSize = computed(() => (dense ? 18 : 22));
const chevronSize = computed(() => (dense ? 16 : 20));
const avatarSize = computed(() => (dense ? 44 : 60));

// ── Profile photo ──────────────────────────────────────────────────────────
const fileInput = useTemplateRef<HTMLInputElement>("fileInput");
const { mutate: updateAvatar, isPending: isAvatarPending } = useUpdateAvatar();
const { mutate: deleteAvatar, isPending: isDeletePending } = useDeleteAvatar();
const isPhotoPending = computed(() => isAvatarPending.value || isDeletePending.value);

// With no photo yet there is only one thing the options list could offer, so
// the avatar goes straight to the picker.
const onPhotoClick = () => {
  if (hasPhoto.value) {
    view.value = "photo";
  } else {
    openFileSelector();
  }
};

const openFileSelector = () => {
  fileInput.value?.click();
};

const uploadAvatar = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!isDefined(input.files) || input.files.length === 0) return;

  const file = input.files[0];
  if (file.size > MAX_AVATAR_BYTES) {
    toast.error("The file size should not exceed 6MB");
    return;
  }

  const formData = new FormData();
  formData.append("avatar", file);
  updateAvatar(formData);
  view.value = "main";
};

const removePhoto = () => {
  deleteAvatar();
  view.value = "main";
};

// ── Name ───────────────────────────────────────────────────────────────────
const nameInput = useTemplateRef<HTMLInputElement>("nameInput");
const isEditingName = ref(false);
const editedName = ref("");
const nameError = ref("");
const { mutate: updateName, isPending: isNamePending } = useUpdateName();

const startEditingName = () => {
  editedName.value = user.value?.name ?? "";
  nameError.value = "";
  isEditingName.value = true;
  nextTick(() => nameInput.value?.focus()).catch(console.error);
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
      cancelEditingName();
    },
    onError: (error: unknown) => {
      nameError.value = error instanceof Error ? error.message : "Failed to update name";
    },
  });
};

// ── Session ────────────────────────────────────────────────────────────────
const logout = async () => {
  emit("close");
  await authStore.logout();
};
</script>
