<template>
  <div class="relative">
    <!-- Desktop: Headless UI Menu -->
    <Menu v-if="isDesktop" as="div">
      <MenuButton
        class="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-white hover:bg-white/10"
        :aria-label="`Switch space. Current: ${activeLabel}`"
      >
        <span class="max-w-[250px] truncate">
          {{ activeLabel }}
        </span>
        <mdicon name="chevron-down" :size="18" />
      </MenuButton>

      <transition
        enter-active-class="transition duration-fast ease-standard"
        enter-from-class="-translate-y-1 scale-95 opacity-0"
        leave-active-class="transition duration-fast ease-standard"
        leave-to-class="-translate-y-1 scale-95 opacity-0"
      >
        <MenuItems
          class="absolute left-0 top-full z-50 mt-1 min-w-[200px] origin-top-left rounded-lg bg-lowBackground shadow-lg"
        >
          <div class="py-1">
            <MenuItem v-slot="{ active }">
              <button
                class="flex w-full items-center gap-2 px-4 py-2 text-sm"
                :class="[
                  isLibraryActive ? 'text-highlight' : 'text-white/80',
                  active ? 'bg-white/10' : '',
                ]"
                @click="selectLibrary"
              >
                <mdicon v-if="isLibraryActive" name="check" :size="16" />
                <span :class="{ 'ml-6': !isLibraryActive }">
                  {{ USER_SCOPE.label }}
                </span>
                <mdicon
                  :name="USER_SCOPE.icon"
                  :size="14"
                  class="ml-auto opacity-60"
                  :title="USER_SCOPE.label"
                />
              </button>
            </MenuItem>
          </div>
          <div v-if="clubs.length > 0" class="border-t border-white/10 py-1">
            <MenuItem
              v-for="club in clubs"
              :key="club.clubId"
              v-slot="{ active }"
            >
              <button
                class="flex w-full items-center gap-2 px-4 py-2 text-sm"
                :class="[
                  club.slug === currentSlug
                    ? 'text-highlight'
                    : 'text-white/80',
                  active ? 'bg-white/10' : '',
                ]"
                @click="selectClub(club.slug)"
              >
                <mdicon
                  v-if="club.slug === currentSlug"
                  name="check"
                  :size="16"
                />
                <span :class="{ 'ml-6': club.slug !== currentSlug }">
                  {{ club.clubName }}
                </span>
                <mdicon
                  :name="clubTypeIcon(club.type)"
                  :size="14"
                  class="ml-auto opacity-60"
                  :title="clubTypeLabel(club.type)"
                />
              </button>
            </MenuItem>
          </div>
          <div class="border-t border-white/10">
            <MenuItem v-slot="{ active }">
              <button
                class="flex w-full items-center gap-2 px-4 py-2 text-sm text-white/80"
                :class="active ? 'bg-white/10' : ''"
                @click="createNewClub"
              >
                <mdicon name="plus" :size="16" />
                Create New Club
              </button>
            </MenuItem>
          </div>
        </MenuItems>
      </transition>
    </Menu>

    <!-- Mobile: custom button + bottom sheet -->
    <template v-else>
      <button
        class="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-white hover:bg-white/10"
        :aria-label="`Switch space. Current: ${activeLabel}`"
        @click="isMobileOpen = true"
      >
        <mdicon name="swap-horizontal" :size="20" />
      </button>

      <VBottomSheet v-if="isMobileOpen" @close="isMobileOpen = false">
        <ul class="py-1">
          <li>
            <button
              class="flex w-full items-center gap-2 px-4 py-3 text-sm hover:bg-white/10"
              :class="isLibraryActive ? 'text-highlight' : 'text-white/80'"
              @click="selectLibrary"
            >
              <mdicon v-if="isLibraryActive" name="check" :size="16" />
              <span :class="{ 'ml-6': !isLibraryActive }">
                {{ USER_SCOPE.label }}
              </span>
              <mdicon
                :name="USER_SCOPE.icon"
                :size="16"
                class="ml-auto opacity-60"
                :title="USER_SCOPE.label"
              />
            </button>
          </li>
        </ul>
        <ul v-if="clubs.length > 0" class="border-t border-white/10 py-1">
          <li v-for="club in clubs" :key="club.clubId">
            <button
              class="flex w-full items-center gap-2 px-4 py-3 text-sm hover:bg-white/10"
              :class="
                club.slug === currentSlug ? 'text-highlight' : 'text-white/80'
              "
              @click="selectClub(club.slug)"
            >
              <mdicon
                v-if="club.slug === currentSlug"
                name="check"
                :size="16"
              />
              <span :class="{ 'ml-6': club.slug !== currentSlug }">
                {{ club.clubName }}
              </span>
              <mdicon
                :name="clubTypeIcon(club.type)"
                :size="16"
                class="ml-auto opacity-60"
                :title="clubTypeLabel(club.type)"
              />
            </button>
          </li>
        </ul>
        <div class="border-t border-white/10">
          <button
            class="flex w-full items-center gap-2 px-4 py-3 text-sm text-white/80 hover:bg-white/10"
            @click="createNewClub"
          >
            <mdicon name="plus" :size="16" />
            Create New Club
          </button>
        </div>
      </VBottomSheet>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import VBottomSheet from "./VBottomSheet.vue";
import { hasValue } from "../../../lib/checks/checks.js";

import { clubTypeIcon, clubTypeLabel } from "@/common/clubType";
import { useIsDesktop } from "@/common/composables/useIsDesktop";
import { setLastClubSlug } from "@/common/composables/useLastClubSlug";
import { USER_SCOPE } from "@/common/scope";
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const isMobileOpen = ref(false);
const isDesktop = useIsDesktop();

const clubs = computed(() => authStore.userClubs ?? []);
const currentSlug = computed(() => {
  const slug = route.params.clubSlug;
  return Array.isArray(slug) ? slug[0] : slug;
});

// True whenever the user is anywhere in the /me library tree (Diary or Works).
const isLibraryActive = computed(() => {
  const path = route.path;
  return hasValue(path) && (path === "/me" || path.startsWith("/me/"));
});

// "My Library" when in the library; otherwise the current club; defaulting to
// "My Library" when neither applies (e.g. a public/share page).
const activeLabel = computed(() => {
  if (isLibraryActive.value) return USER_SCOPE.label;
  const slug = currentSlug.value;
  if (hasValue(slug)) {
    const club = clubs.value.find((c) => c.slug === slug);
    if (club) return club.clubName;
  }
  return USER_SCOPE.label;
});

// Close the mobile sheet only *after* the navigation resolves. Closing it first
// unmounts the sheet, and `useBackButtonClose` would then pop its synthetic
// history entry — cancelling the navigation we just started (mobile switch
// would silently do nothing). See useBackButtonClose for details.
const selectClub = (slug: string) => {
  setLastClubSlug(slug);
  router
    .push({ name: "ClubHome", params: { clubSlug: slug } })
    .then(() => {
      isMobileOpen.value = false;
    })
    .catch(console.error);
};

// Same post-navigation close ordering as selectClub (the history-entry race is
// identical for the pinned "My Library" entry).
const selectLibrary = () => {
  router
    .push({ name: "MyLibrary" })
    .then(() => {
      isMobileOpen.value = false;
    })
    .catch(console.error);
};

const createNewClub = () => {
  router
    .push({ name: "NewClub" })
    .then(() => {
      isMobileOpen.value = false;
    })
    .catch(console.error);
};

onMounted(() => {
  const slug = currentSlug.value;
  if (hasValue(slug)) {
    setLastClubSlug(slug);
  }
});
</script>
