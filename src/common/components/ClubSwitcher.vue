<template>
  <div class="relative min-w-0 flex-grow md:flex-grow-0">
    <!-- Desktop: Headless UI Menu -->
    <Menu v-if="isDesktop" v-slot="{ close }" as="div">
      <MenuButton
        class="flex min-h-[44px] items-center gap-2 rounded-lg bg-lowBackground py-1.5 pl-1.5 pr-2 ring-1 ring-inset ring-white/[0.08] transition-colors duration-fast ease-standard hover:bg-white/10"
        :aria-label="`Club menu. Current: ${activeClubName}`"
      >
        <ClubChipBody :club-name="activeClubName" :meta="activeClubMeta" />
        <MemberAvatarStack
          :members="members"
          :size="22"
          ring-class="shadow-[0_0_0_2px_#393E46]"
          class="mr-0.5"
        />
        <mdicon name="chevron-down" :size="18" class="flex-shrink-0 text-white/70" />
      </MenuButton>

      <transition
        enter-active-class="transition duration-fast ease-standard"
        enter-from-class="-translate-y-1 scale-95 opacity-0"
        leave-active-class="transition duration-fast ease-standard"
        leave-to-class="-translate-y-1 scale-95 opacity-0"
      >
        <MenuItems
          class="absolute left-0 top-full z-50 mt-1 min-w-[300px] origin-top-left overflow-hidden rounded-xl bg-lowBackground shadow-lg"
        >
          <ClubPanelRows
            :club-slug="currentSlug"
            :club-name="activeClubName"
            :meta="activeClubMeta"
            :members="members"
            avatar-ring-class="shadow-[0_0_0_2px_#393E46]"
            row-role="menuitem"
            @navigated="close()"
          />

          <template v-if="hasMultipleClubs">
            <div
              class="border-t border-white/[0.08] px-4 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-widest text-white/45"
            >
              Your clubs
            </div>
            <div class="pb-1.5">
              <MenuItem v-for="club in clubs" :key="club.clubId" v-slot="{ active }">
                <button
                  class="flex w-full items-center gap-2.5 px-4 py-2 text-left"
                  :class="active ? 'bg-white/10' : ''"
                  @click="selectClub(club)"
                >
                  <v-avatar :name="club.clubName" :size="30" />
                  <span class="flex min-w-0 flex-grow flex-col">
                    <span
                      class="truncate text-sm font-medium leading-tight"
                      :class="club.slug === currentSlug ? 'text-highlight' : 'text-white/85'"
                    >
                      {{ club.clubName }}
                    </span>
                    <span class="truncate text-[11px] leading-tight text-white/50">
                      {{ clubTypeLabel(club.type) }}
                    </span>
                  </span>
                  <mdicon
                    v-if="club.slug === currentSlug"
                    name="check"
                    :size="16"
                    class="flex-shrink-0 text-highlight"
                  />
                </button>
              </MenuItem>
            </div>
          </template>

          <div class="border-t border-white/10">
            <MenuItem v-slot="{ active }">
              <button
                class="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-white/80"
                :class="active ? 'bg-white/10' : ''"
                @click="createNewClub"
              >
                <mdicon name="plus" :size="16" />
                Create new club
              </button>
            </MenuItem>
          </div>
        </MenuItems>
      </transition>
    </Menu>

    <!-- Mobile: custom button + bottom sheet -->
    <template v-else>
      <button
        class="flex min-h-[44px] w-full items-center gap-2 rounded-lg bg-lowBackground py-1.5 pl-1.5 pr-2 ring-1 ring-inset ring-white/[0.08] transition-colors duration-fast ease-standard hover:bg-white/10"
        :aria-label="`Club menu. Current: ${activeClubName}`"
        @click="isMobileOpen = true"
      >
        <ClubChipBody :club-name="activeClubName" :meta="activeClubMeta" />
        <MemberAvatarStack
          :members="members"
          :size="22"
          ring-class="shadow-[0_0_0_2px_#393E46]"
          class="mr-0.5"
        />
        <mdicon name="chevron-down" :size="18" class="flex-shrink-0 text-white/70" />
      </button>

      <VBottomSheet v-if="isMobileOpen" content-class="pb-6" @close="isMobileOpen = false">
        <ClubPanelRows
          :club-slug="currentSlug"
          :club-name="activeClubName"
          :meta="activeClubMeta"
          :members="members"
          show-identity
          avatar-ring-class="shadow-[0_0_0_2px_#222831]"
          @navigated="isMobileOpen = false"
        />

        <template v-if="hasMultipleClubs">
          <div
            class="border-t border-white/[0.08] px-4 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-widest text-white/45"
          >
            Your clubs
          </div>
          <ul>
            <li v-for="club in clubs" :key="club.clubId">
              <button
                class="flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/10"
                @click="selectClub(club)"
              >
                <v-avatar :name="club.clubName" :size="34" />
                <span class="flex min-w-0 flex-grow flex-col">
                  <span
                    class="truncate text-[15px] font-medium leading-tight"
                    :class="club.slug === currentSlug ? 'text-highlight' : 'text-white/85'"
                  >
                    {{ club.clubName }}
                  </span>
                  <span class="truncate text-xs leading-tight text-white/50">
                    {{ clubTypeLabel(club.type) }}
                  </span>
                </span>
                <mdicon
                  v-if="club.slug === currentSlug"
                  name="check"
                  :size="20"
                  class="flex-shrink-0 text-highlight"
                />
              </button>
            </li>
          </ul>
        </template>

        <div class="mt-2 border-t border-white/10">
          <button
            class="flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-[15px] text-white/80 hover:bg-white/10"
            @click="createNewClub"
          >
            <mdicon name="plus" :size="20" />
            Create new club
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

import { hasValue } from "../../../lib/checks/checks.js";
import { ClubPreview } from "../../../lib/types/club";
import { ClubType } from "../../../lib/types/generated/db";
import { DEFAULT_CLUB_SECTION, sectionNameForRoute } from "../clubSections";
import ClubChipBody from "./ClubChipBody.vue";
import ClubPanelRows from "./ClubPanelRows.vue";
import MemberAvatarStack from "./MemberAvatarStack.vue";
import VBottomSheet from "./VBottomSheet.vue";
import { clubTypeLabel } from "@/common/clubType";
import { useIsDesktop } from "@/common/composables/useIsDesktop";
import { setLastClubSlug } from "@/common/composables/useLastClubSlug";
import { useMembers } from "@/service/useClub";
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const isMobileOpen = ref(false);
const isDesktop = useIsDesktop();

const clubs = computed(() => authStore.userClubs ?? []);
const hasMultipleClubs = computed(() => clubs.value.length > 1);

const currentSlug = computed(() => {
  const slug = route.params.clubSlug;
  return Array.isArray(slug) ? slug[0] : (slug ?? "");
});

const activeClub = computed(() => clubs.value.find((c) => c.slug === currentSlug.value));
const activeClubName = computed(() => activeClub.value?.clubName ?? "Select Club");

const { data: members } = useMembers(currentSlug);

const activeClubMeta = computed(() => {
  const type = activeClub.value?.type;
  if (type === undefined) return "";
  const count = members.value?.length;
  return count === undefined
    ? clubTypeLabel(type)
    : `${clubTypeLabel(type)} · ${count} ${count === 1 ? "member" : "members"}`;
});

/**
 * Switching clubs keeps you in the section you were reading. Awards has no
 * equivalent in a book club, so those fall back to the default section rather
 * than bouncing off `movieClubOnly`.
 */
const targetSection = (club: ClubPreview) => {
  const section = sectionNameForRoute(route);
  if (!hasValue(section)) return DEFAULT_CLUB_SECTION;
  if (section === "Awards" && club.type !== ClubType.movie) return DEFAULT_CLUB_SECTION;
  return section;
};

// Close the mobile sheet only *after* the navigation resolves. Closing it first
// unmounts the sheet, and `useBackButtonClose` would then pop its synthetic
// history entry — cancelling the navigation we just started (mobile club
// switch would silently do nothing). See useBackButtonClose for details.
const selectClub = (club: ClubPreview) => {
  setLastClubSlug(club.slug);
  router
    .push({ name: targetSection(club), params: { clubSlug: club.slug } })
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
  if (hasValue(currentSlug.value)) {
    setLastClubSlug(currentSlug.value);
  }
});
</script>
