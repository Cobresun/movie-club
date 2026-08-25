<template>
  <!-- Desktop: a strip under the header, tabs underlined on the container border -->
  <nav
    v-if="isDesktop"
    aria-label="Club sections"
    class="flex items-end gap-0.5 border-b border-white/10 px-4"
  >
    <router-link
      v-for="section in sections"
      :key="section.name"
      :to="{ name: section.name, params: { clubSlug } }"
      class="border-b-2 px-3.5 pb-2.5 pt-2 text-[15px] font-medium transition-colors duration-fast ease-standard"
      :class="
        section.name === activeSection
          ? '-mb-px border-highlight text-highlight'
          : 'border-transparent text-white/70 hover:text-white'
      "
      :aria-current="section.name === activeSection ? 'page' : undefined"
    >
      {{ section.label }}
    </router-link>
  </nav>

  <!-- Mobile: a fixed bottom bar that slides away while scrolling down. Content
       reserves room for it unconditionally (see ClubRouterView) so the page
       never reflows as the bar comes and goes. -->
  <nav
    v-else
    aria-label="Club sections"
    class="fixed inset-x-0 bottom-0 z-20 flex h-[62px] items-stretch border-t border-white/10 bg-background transition-transform duration-slow ease-emphasized"
    :class="{ 'translate-y-full': isHidden }"
    @focusin="reveal"
  >
    <router-link
      v-for="section in sections"
      :key="section.name"
      :to="{ name: section.name, params: { clubSlug } }"
      class="flex flex-grow flex-col items-center justify-center gap-[3px] transition-colors duration-fast ease-standard"
      :class="section.name === activeSection ? 'text-highlight' : 'text-white/55'"
      :aria-current="section.name === activeSection ? 'page' : undefined"
    >
      <mdicon :name="section.icon" :size="24" />
      <span class="text-[11px] font-medium">{{ section.shortLabel }}</span>
    </router-link>
  </nav>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import { useRoute } from "vue-router";

import { CLUB_SECTIONS, isSectionVisible, sectionNameForRoute } from "../clubSections";
import { useHideOnScroll } from "../composables/useHideOnScroll";
import { useIsDesktop } from "../composables/useIsDesktop";
import { useClub, useClubSettings } from "@/service/useClub";

const { clubSlug } = defineProps<{ clubSlug: string }>();

const route = useRoute();
const isDesktop = useIsDesktop();
const { isHidden, reveal } = useHideOnScroll();

const { data: club } = useClub(clubSlug);
const { data: settings } = useClubSettings(clubSlug);

const sections = computed(() =>
  CLUB_SECTIONS.filter((section) =>
    isSectionVisible(section, club.value?.type, settings.value?.features?.awards),
  ),
);

const activeSection = computed(() => sectionNameForRoute(route));

// A new section starts at the top of its own scroll position; make sure the bar
// is there when it does.
watch(activeSection, reveal);
</script>
