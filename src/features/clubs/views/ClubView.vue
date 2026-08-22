<template>
  <div class="mx-auto flex max-w-3xl flex-col gap-6 px-4 pb-8 pt-6">
    <section class="flex flex-col gap-2.5">
      <h2 class="text-lg font-semibold">Members</h2>
      <loading-spinner v-if="isLoadingMembers" />
      <div v-else class="flex flex-wrap gap-2">
        <div
          v-for="member in members"
          :key="member.id"
          class="inline-flex items-center gap-2 rounded-full border-2 px-3 py-1.5"
          :class="member.role === 'admin' ? 'border-highlightBackground' : 'border-slate-600'"
        >
          <v-avatar :src="member.image" :name="member.name" :size="24" />
          <span class="text-sm">{{ member.name }}</span>
        </div>
      </div>
    </section>

    <section class="flex flex-col gap-2.5">
      <h2 class="text-lg font-semibold">Invite</h2>
      <p class="text-sm font-light text-white/60">
        Send this link to add someone to {{ club?.clubName ?? "this club" }}.
      </p>
      <div class="flex gap-2.5">
        <input
          ref="inviteLinkInput"
          :value="inviteLink"
          readonly
          aria-label="Invite link"
          class="min-h-[44px] min-w-0 flex-grow rounded-md border-2 border-slate-600 bg-background px-3 text-sm text-white/70"
        />
        <v-btn class="h-[44px] min-w-[44px]" aria-label="Copy invite link" @click="copyInviteLink">
          <mdicon :name="copyIcon" />
        </v-btn>
      </div>
    </section>

    <section class="flex flex-col overflow-hidden rounded-xl bg-lowBackground">
      <router-link
        :to="{ name: 'ClubSettings', params: { clubSlug } }"
        class="flex min-h-[52px] items-center gap-3 px-4 py-3.5 transition-colors duration-fast ease-standard hover:bg-white/10"
      >
        <mdicon name="cog" :size="22" class="flex-shrink-0 text-white/60" />
        <span class="flex-grow text-[15px] font-medium">Club settings</span>
        <mdicon name="chevron-right" :size="20" class="text-white/35" />
      </router-link>
      <button
        class="flex min-h-[52px] items-center gap-3 border-t border-white/[0.08] px-4 py-3.5 text-left transition-colors duration-fast ease-standard hover:bg-white/10"
        @click="showLeaveConfirm = true"
      >
        <mdicon name="logout" :size="22" class="flex-shrink-0 text-white/60" />
        <span class="flex-grow text-[15px] font-medium text-orange-300">Leave club</span>
        <mdicon name="chevron-right" :size="20" class="text-white/35" />
      </button>
    </section>

    <router-link
      :to="{ name: 'NewClub' }"
      class="flex min-h-[52px] items-center gap-3 rounded-xl px-4 py-3.5 ring-1 ring-inset ring-white/[0.12] transition-colors duration-fast ease-standard hover:bg-white/10"
    >
      <mdicon name="plus" :size="22" class="flex-shrink-0 text-white/60" />
      <span class="flex-grow text-[15px] font-medium">Create or join another club</span>
      <mdicon name="chevron-right" :size="20" class="text-white/35" />
    </router-link>

    <v-modal v-if="showLeaveConfirm" size="sm" @close="showLeaveConfirm = false">
      <h3 class="mb-4 text-xl font-semibold">Leave club?</h3>
      <p class="mb-6 text-gray-300">
        Are you sure you want to leave this club? This action cannot be undone.
      </p>
      <div class="flex gap-3">
        <v-btn class="flex-1 bg-gray-600 hover:bg-gray-700" @click="showLeaveConfirm = false">
          Cancel
        </v-btn>
        <v-btn
          variant="danger"
          class="flex-1 bg-red-500 hover:bg-red-600"
          :loading="isLeaving"
          @click="leaveClub()"
        >
          Leave
        </v-btn>
      </div>
    </v-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

import { useMembers, useClub, useClubSlug, useInviteToken, useLeaveClub } from "@/service/useClub";

const clubSlug = useClubSlug();
const { data: members, isLoading: isLoadingMembers } = useMembers(clubSlug);
const { data: club } = useClub(clubSlug);
const { data: inviteToken } = useInviteToken(clubSlug);
const { mutate: leaveClub, isLoading: isLeaving } = useLeaveClub(clubSlug);

const showLeaveConfirm = ref(false);
const inviteLinkInput = ref<HTMLInputElement | null>(null);
const hasCopied = ref(false);

const inviteLink = computed(() => `${window.location.origin}/join-club/${inviteToken.value}`);

const copyIcon = computed(() => (hasCopied.value ? "check" : "content-copy"));

const copyInviteLink = async () => {
  try {
    await navigator.clipboard.writeText(inviteLink.value);
    hasCopied.value = true;
    setTimeout(() => {
      hasCopied.value = false;
    }, 2000);
  } catch {
    // Fallback for browsers that don't support the Clipboard API
    if (inviteLinkInput.value) {
      inviteLinkInput.value.select();
      document.execCommand("copy");
    }
  }
};
</script>
