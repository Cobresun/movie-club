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
      aria-label="Members"
      @click="goTo('Club')"
    >
      <MemberAvatarStack :members="members" :size="34" :ring-class="avatarRingClass" />
      <span class="flex-grow" />
      <mdicon name="chevron-right" :size="20" class="text-white/35" />
    </button>

    <button
      class="flex min-h-[56px] items-center gap-3 border-t border-white/[0.08] px-4 py-3.5 text-left transition-colors duration-fast ease-standard hover:bg-white/10"
      :role="rowRole"
      @click="copyInviteLink()"
    >
      <mdicon :name="copyIcon" :size="22" class="flex-shrink-0 text-white/60" />
      <span class="flex min-w-0 flex-grow flex-col">
        <span class="text-[15px] font-medium">Invite people</span>
        <span class="text-xs text-white/50">Copy the club link</span>
      </span>
    </button>

    <button
      class="flex min-h-[56px] items-center gap-3 border-t border-white/[0.08] px-4 py-3.5 text-left transition-colors duration-fast ease-standard hover:bg-white/10"
      :role="rowRole"
      @click="goTo('ClubSettings')"
    >
      <mdicon name="cog" :size="22" class="flex-shrink-0 text-white/60" />
      <span class="flex-grow text-[15px] font-medium">Club settings</span>
      <mdicon name="chevron-right" :size="20" class="text-white/35" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";

import { hasValue } from "../../../lib/checks/checks.js";
import { Member } from "../../../lib/types/club";
import { useInviteLink } from "../composables/useInviteLink";
import MemberAvatarStack from "./MemberAvatarStack.vue";

const {
  clubSlug,
  members,
  showIdentity = false,
  avatarRingClass = "",
  rowRole = undefined,
} = defineProps<{
  clubSlug: string;
  clubName: string;
  meta: string;
  members: readonly Member[] | undefined;
  /** Mobile repeats the club identity; on desktop the chip sits right above. */
  showIdentity?: boolean;
  avatarRingClass?: string;
  /**
   * Inside a Headless UI `MenuItems`, a descendant without a role is rewritten
   * to `role="none"`, which would strip these buttons of their semantics. The
   * desktop popover passes "menuitem" so they keep one.
   */
  rowRole?: string;
}>();

const router = useRouter();

const emit = defineEmits<{ (e: "navigated"): void }>();

const { copyIcon, copyInviteLink } = useInviteLink(clubSlug);

// The overlay hosting these rows must close only *after* the navigation
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
