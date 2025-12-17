<template>
  <div>
    <page-header :has-back="false" page-name="" />

    <!-- Members section -->
    <div class="mx-auto max-w-3xl p-4">
      <loading-spinner v-if="isLoadingMembers" />
      <div v-else class="flex flex-wrap justify-center gap-2">
        <!-- Member pills -->
        <div
          v-for="member in members"
          :key="member.id"
          class="inline-flex items-center gap-2 rounded-full border-2 px-3 py-1.5 transition-colors hover:bg-gray-700"
          :class="[
            member.role === 'admin'
              ? 'border-highlightBackground'
              : 'border-slate-600',
          ]"
        >
          <img
            v-if="member.image"
            :src="member.image"
            :alt="member.name"
            class="h-6 w-6 rounded-full object-cover"
          />
          <div
            v-else
            class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-500"
          >
            <mdicon name="account" class="h-4 w-4 text-gray-300" />
          </div>
          <span class="text-sm">{{ member.name }}</span>
        </div>
        <!-- Invite pill -->
        <div
          class="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-slate-600 bg-gray-500 px-3 py-1.5 align-middle transition-colors"
          @click="showInviteModal = true"
        >
          <mdicon name="plus" class="" />
        </div>
      </div>
    </div>

    <!-- Invite Modal -->
    <div
      v-if="showInviteModal"
      class="fixed left-0 top-0 z-50 flex h-full w-full items-center justify-center bg-black bg-opacity-50"
      @click="showInviteModal = false"
    >
      <div
        class="mx-4 w-full rounded-lg bg-background p-8 md:w-1/2"
        @click.stop=""
      >
        <h3 class="mb-4 text-xl font-semibold">Invite Members</h3>
        <div class="space-y-3">
          <p class="pb-4 text-sm text-gray-500">
            Share this link to invite people to your club
          </p>
          <div class="flex items-center gap-3">
            <input
              ref="inviteLinkInput"
              :value="inviteLink"
              readonly
              class="w-full rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600"
            />
            <v-btn class="h-[44px] min-w-[44px]" @click="copyInviteLink">
              <mdicon :name="copyIcon" />
            </v-btn>
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation cards grid -->
    <div class="mx-auto grid max-w-5xl grid-cols-2 gap-3 px-4 pb-6 md:grid-cols-4">
      <router-link :to="{ name: 'Reviews' }">
        <menu-card :image="reviewSvg"> Reviews </menu-card>
      </router-link>
      <router-link :to="{ name: 'WatchList' }">
        <menu-card :image="watchlistSvg"> Watch List </menu-card>
      </router-link>
      <router-link :to="{ name: 'Statistics' }">
        <menu-card :image="statisticsSvg"> Statistics </menu-card>
      </router-link>
      <router-link :to="{ name: 'Awards' }">
        <menu-card :image="awardsSvg"> Awards </menu-card>
      </router-link>
    </div>

    <div class="flex justify-center">
      <router-link
        :to="{ name: 'ClubSettings' }"
        class="mb-4 inline-flex items-center rounded-md bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
      >
        <mdicon name="cog" class="mr-2" />
        Club Settings
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

import awardsSvg from "@/assets/images/menu-images/awards.svg";
import reviewSvg from "@/assets/images/menu-images/review.svg";
import statisticsSvg from "@/assets/images/menu-images/statistics.svg";
import watchlistSvg from "@/assets/images/menu-images/watchlist.svg";
import { useMembers, useClubId, useInviteToken } from "@/service/useClub";

const clubId = useClubId();
const { data: members, isLoading: isLoadingMembers } = useMembers(clubId);
const { data: inviteToken } = useInviteToken(clubId);

const showInviteModal = ref(false);
const inviteLinkInput = ref<HTMLInputElement | null>(null);
const hasCopied = ref(false);

const inviteLink = computed(() => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/join-club/${inviteToken.value}`;
});

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
