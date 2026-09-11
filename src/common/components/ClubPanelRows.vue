<template>
  <div class="flex flex-col">
    <div v-if="showIdentity" class="flex items-center gap-3 px-4 pb-3 pt-1">
      <v-avatar :name="clubName" :size="48" class="flex-shrink-0" />
      <span class="flex min-w-0 flex-col gap-0.5">
        <span class="truncate text-xl font-semibold leading-tight">{{ clubName }}</span>
        <span v-if="hasValue(meta)" class="truncate text-[13px] text-white/55">{{ meta }}</span>
      </span>
    </div>

    <button
      class="flex min-h-[56px] items-center gap-3 border-t border-white/[0.08] px-4 py-3.5 text-left transition-colors duration-fast ease-standard hover:bg-white/10"
      :role="rowRole"
      @click="goTo('Club')"
    >
      <mdicon name="account-group-outline" :size="22" class="flex-shrink-0 text-white/60" />
      <span class="flex-grow text-[15px] font-medium">Members &amp; settings</span>
      <mdicon name="chevron-right" :size="20" class="text-white/35" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";

import { hasValue } from "../../../lib/checks/checks.js";

const { clubSlug, showIdentity = false } = defineProps<{
  clubSlug: string;
  clubName: string;
  meta: string;
  /** Mobile repeats the club identity; on desktop the chip sits right above. */
  showIdentity?: boolean;
  /**
   * Inside a Headless UI `MenuItems`, a descendant without a role is rewritten
   * to `role="none"`, which would strip this button of its semantics. The
   * desktop popover passes "menuitem" so it keeps one.
   */
  rowRole?: string;
}>();

const router = useRouter();

const emit = defineEmits<{ (e: "navigated"): void }>();

// The overlay hosting this row must close only *after* the navigation
// resolves, or `useBackButtonClose` pops its synthetic history entry and
// cancels the navigation. See useBackButtonClose.
const goTo = (name: string) => {
  router
    .push({ name, params: { clubSlug } })
    .then(() => {
      emit("navigated");
    })
    .catch(console.error);
};
</script>
