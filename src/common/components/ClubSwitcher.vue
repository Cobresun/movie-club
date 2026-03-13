<template>
  <div class="relative">
    <!-- Desktop: Headless UI Menu -->
    <Menu v-if="isDesktop" as="div">
      <MenuButton
        class="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-white hover:bg-white/10"
        :aria-label="`Switch club. Current: ${activeClubName}`"
      >
        <span class="max-w-[250px] truncate">
          {{ activeClubName }}
        </span>
        <mdicon name="chevron-down" :size="18" />
      </MenuButton>

      <MenuItems
        class="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg bg-lowBackground shadow-lg"
      >
        <div class="py-1">
          <MenuItem
            v-for="club in clubs"
            :key="club.clubId"
            v-slot="{ active }"
          >
            <button
              class="flex w-full items-center gap-2 px-4 py-2 text-sm"
              :class="[
                club.slug === currentSlug ? 'text-highlight' : 'text-white/80',
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
    </Menu>

    <!-- Mobile: custom button + bottom sheet -->
    <template v-else>
      <button
        class="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-white hover:bg-white/10"
        :aria-label="`Switch club. Current: ${activeClubName}`"
        @click="isMobileOpen = true"
      >
        <mdicon name="swap-horizontal" :size="20" />
      </button>

      <VBottomSheet v-if="isMobileOpen" @close="isMobileOpen = false">
        <ul class="py-1">
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

import { useIsDesktop } from "@/common/composables/useIsDesktop";
import { setLastClubSlug } from "@/common/composables/useLastClubSlug";
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

const activeClubName = computed(() => {
  const slug = currentSlug.value;
  if (hasValue(slug)) {
    const club = clubs.value.find((c) => c.slug === slug);
    if (club) return club.clubName;
  }
  return "Select Club";
});

const selectClub = (slug: string) => {
  isMobileOpen.value = false;
  setLastClubSlug(slug);
  router
    .push({ name: "ClubHome", params: { clubSlug: slug } })
    .catch(console.error);
};

const createNewClub = () => {
  isMobileOpen.value = false;
  router.push({ name: "NewClub" }).catch(console.error);
};

onMounted(() => {
  const slug = currentSlug.value;
  if (hasValue(slug)) {
    setLastClubSlug(slug);
  }
});
</script>
