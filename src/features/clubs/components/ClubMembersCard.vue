<template>
  <section class="flex flex-col">
    <SectionHeader title="Members">
      <span v-if="hasElements(members)" class="text-xs text-white/45">
        {{ members.length }} {{ members.length === 1 ? "person" : "people" }}
      </span>
    </SectionHeader>

    <loading-spinner v-if="isLoading" />

    <div v-else class="flex flex-col overflow-hidden rounded-xl bg-lowBackground">
      <div
        v-for="member in members"
        :key="member.id"
        class="flex min-h-[56px] items-center gap-3 border-t border-white/[0.08] px-4 py-3.5 first:border-t-0"
      >
        <v-avatar :src="member.image" :name="member.name" :size="34" class="flex-shrink-0" />
        <span class="flex min-w-0 flex-grow flex-col gap-0.5">
          <span class="truncate text-[15px] font-medium leading-tight">{{ member.name }}</span>
          <span class="truncate text-xs leading-tight text-white/45">{{ member.email }}</span>
        </span>
        <span
          v-if="member.role === 'admin'"
          class="flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-highlightBackground ring-1 ring-inset ring-highlightBackground/60"
        >
          ADMIN
        </span>
        <button
          v-else-if="member.email !== currentUserEmail"
          class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-white/35 transition-colors duration-fast ease-standard hover:bg-white/10 hover:text-red-400"
          :aria-label="`Remove ${member.name}`"
          @click="memberToRemove = member"
        >
          <mdicon name="close" :size="20" />
        </button>
      </div>

      <button
        class="flex min-h-[56px] items-center gap-3 border-t border-white/[0.08] px-4 py-3.5 text-left transition-colors duration-fast ease-standard hover:bg-white/10"
        @click="copyInviteLink()"
      >
        <mdicon name="link-variant" :size="22" class="flex-shrink-0 text-white/60" />
        <span class="flex min-w-0 flex-grow flex-col">
          <span class="text-[15px] font-medium">Invite people</span>
          <span class="text-xs text-white/50">Copy the club link</span>
        </span>
        <mdicon :name="copyIcon" :size="20" class="flex-shrink-0 text-white/50" />
      </button>
    </div>

    <!-- Off-screen, but a real node: browsers without the async clipboard API
         fall back to selecting this input and running execCommand("copy"). -->
    <input
      ref="inviteLinkInput"
      :value="inviteLink"
      readonly
      aria-hidden="true"
      tabindex="-1"
      class="pointer-events-none absolute h-0 w-0 opacity-0"
    />

    <v-modal v-if="isDefined(memberToRemove)" size="sm" @close="memberToRemove = undefined">
      <h3 class="mb-4 text-xl font-semibold">Remove {{ memberToRemove.name }}?</h3>
      <p class="mb-6 text-white/70">
        They lose access to this club. Their reviews and scores stay.
      </p>
      <div class="flex gap-3">
        <v-btn class="flex-1 bg-gray-600 hover:bg-gray-700" @click="memberToRemove = undefined">
          Cancel
        </v-btn>
        <v-btn
          variant="danger"
          class="flex-1 bg-red-500 hover:bg-red-600"
          :loading="isRemoving"
          @click="confirmRemove()"
        >
          Remove
        </v-btn>
      </div>
    </v-modal>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useToast } from "vue-toastification";

import { hasElements, isDefined } from "../../../../lib/checks/checks.js";
import { Member } from "../../../../lib/types/club";
import SectionHeader from "@/common/components/SectionHeader.vue";
import { useInviteLink } from "@/common/composables/useInviteLink";
import { useMembers, useRemoveMember } from "@/service/useClub";
import { useAuthStore } from "@/stores/auth";

const { clubSlug } = defineProps<{ clubSlug: string }>();

const auth = useAuthStore();
const toast = useToast();

const { data: members, isLoading } = useMembers(clubSlug);
const { mutate: removeMember, isPending: isRemoving } = useRemoveMember(clubSlug);
const { inviteLink, inviteLinkInput, copyIcon, copyInviteLink } = useInviteLink(clubSlug);

const currentUserEmail = computed(() => auth.user?.email);
const memberToRemove = ref<Member | undefined>(undefined);

const confirmRemove = () => {
  if (!isDefined(memberToRemove.value)) return;

  removeMember(memberToRemove.value.id, {
    onSuccess: () => {
      toast.success("Member removed successfully");
      memberToRemove.value = undefined;
    },
    onError: () => toast.error("Failed to remove member"),
  });
};
</script>
