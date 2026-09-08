<template>
  <!-- Nothing is edited in here: the menu is a signpost. Every field the user
       can change lives on the profile screen, which is a route with a header
       and a back arrow rather than a 300px column floating over the page. -->
  <div>
    <div class="flex items-center px-4" :class="dense ? 'gap-3 py-3.5' : 'gap-3.5 pb-4 pt-0.5'">
      <v-avatar
        class="flex-shrink-0"
        :src="user?.image"
        :name="user?.name ?? ''"
        :size="dense ? 44 : 60"
      />

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

    <div class="border-t border-white/10" />

    <button
      class="mt-1 flex w-full items-center text-left transition-colors duration-fast ease-standard hover:bg-white/10"
      :class="
        dense
          ? 'min-h-[40px] gap-2.5 px-4 py-2 text-sm'
          : 'min-h-[56px] gap-3 px-4 py-2.5 text-[15px] font-medium'
      "
      @click="toProfile"
    >
      <mdicon name="account-outline" :size="dense ? 18 : 22" class="flex-shrink-0 text-white/60" />
      <span class="flex-grow">Edit profile</span>
      <mdicon name="chevron-right" :size="dense ? 16 : 20" class="flex-shrink-0 text-white/35" />
    </button>

    <div class="mt-1 border-t border-white/10">
      <button
        class="flex w-full items-center text-left transition-colors duration-fast ease-standard hover:bg-white/10"
        :class="
          dense
            ? 'min-h-[40px] gap-2.5 px-4 py-2 text-sm'
            : 'min-h-[56px] gap-3 px-4 py-2.5 text-[15px] font-medium'
        "
        @click="logout"
      >
        <mdicon name="logout" :size="dense ? 18 : 22" class="flex-shrink-0 text-white/60" />
        <span class="flex-grow text-orange-300">Log out</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";

import { useUser } from "@/service/useUser";
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

const authStore = useAuthStore();
const router = useRouter();
const user = useUser();

// Close only once the navigation resolves: unmounting the sheet first lets
// `useBackButtonClose` pop its synthetic history entry and cancel the
// navigation.
const toProfile = () => {
  router
    .push({ name: "Profile" })
    .then(() => {
      emit("close");
    })
    .catch(console.error);
};

const logout = async () => {
  emit("close");
  await authStore.logout();
};
</script>
