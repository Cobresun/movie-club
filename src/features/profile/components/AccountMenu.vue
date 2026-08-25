<template>
  <div ref="root" class="relative">
    <button
      class="block rounded-full transition-shadow duration-fast ease-standard"
      :class="{ 'ring-2 ring-highlight ring-offset-2 ring-offset-background': isOpen }"
      aria-label="Account"
      aria-haspopup="dialog"
      :aria-expanded="isOpen"
      @click="toggle"
    >
      <v-avatar :name="fullName" :src="avatarURL" :size="44" />
    </button>

    <!-- Desktop: a popover anchored under the avatar, mirroring how
         ClubSwitcher splits desktop menu from mobile sheet. -->
    <transition
      enter-active-class="transition duration-fast ease-standard"
      enter-from-class="-translate-y-1 scale-95 opacity-0"
      leave-active-class="transition duration-fast ease-standard"
      leave-to-class="-translate-y-1 scale-95 opacity-0"
    >
      <div
        v-if="isDesktop && isOpen"
        role="dialog"
        aria-label="Account"
        class="absolute right-0 top-full z-50 mt-1 w-[300px] origin-top-right overflow-hidden rounded-xl bg-lowBackground pb-1 shadow-lg"
      >
        <AccountPanel dense @close="close" />
      </div>
    </transition>

    <!-- Mobile: a bottom sheet, so the account view is something you dismiss
         rather than a screen you have to find your way out of. -->
    <v-bottom-sheet v-if="!isDesktop && isOpen" content-class="pb-6" @close="close">
      <AccountPanel @close="close" />
    </v-bottom-sheet>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";

import { closeAccountMenu, openAccountMenu, useAccountMenu } from "../composables/useAccountMenu";
import AccountPanel from "./AccountPanel.vue";
import VBottomSheet from "@/common/components/VBottomSheet.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop";
import { useUser } from "@/service/useUser";
import { useAuthStore } from "@/stores/auth";

const store = useAuthStore();
const user = useUser();
const isDesktop = useIsDesktop();
const isOpen = useAccountMenu();

const fullName = computed(() => store.user?.name ?? "");
const avatarURL = computed(() => user.value?.image);

const root = ref<HTMLElement | null>(null);

const close = () => closeAccountMenu();

const toggle = () => {
  if (isOpen.value) {
    close();
  } else {
    openAccountMenu();
  }
};

// The bottom sheet brings its own dismissal (grabber, backdrop, back button);
// the desktop popover has to grow its own.
const onPointerDown = (event: PointerEvent) => {
  if (!root.value?.contains(event.target as Node)) close();
};

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === "Escape") close();
};

const stopListening = () => {
  document.removeEventListener("pointerdown", onPointerDown);
  document.removeEventListener("keydown", onKeyDown);
};

watch(
  [isOpen, isDesktop],
  ([open, desktop]) => {
    stopListening();
    if (!open || !desktop) return;
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
  },
  { immediate: true },
);

// A logged-out user has no menu to show — and `/profile` may have opened it
// before the session was known.
watch(
  () => store.isLoggedIn,
  (loggedIn) => {
    if (!loggedIn) close();
  },
);

onUnmounted(() => {
  stopListening();
  close();
});
</script>
