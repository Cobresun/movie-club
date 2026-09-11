<template>
  <div class="mx-auto flex max-w-3xl flex-col gap-6 px-4 pb-8 pt-6">
    <header class="flex items-center gap-3.5">
      <v-avatar :name="club?.clubName ?? ''" :size="56" class="flex-shrink-0" />
      <div class="flex min-w-0 flex-col gap-0.5">
        <h1 class="truncate text-2xl font-semibold leading-tight">{{ club?.clubName }}</h1>
        <span v-if="hasValue(meta)" class="truncate text-[13px] text-white/55">{{ meta }}</span>
      </div>
    </header>

    <ClubMembersCard :club-slug="clubSlug" />

    <ClubSettingsCard :club-slug="clubSlug" />

    <section class="flex flex-col overflow-hidden rounded-xl bg-lowBackground">
      <button
        class="flex min-h-[56px] items-center gap-3 px-4 py-3.5 text-left transition-colors duration-fast ease-standard hover:bg-white/10"
        @click="showLeaveConfirm = true"
      >
        <mdicon name="logout" :size="22" class="flex-shrink-0 text-white/60" />
        <span class="flex-grow text-[15px] font-medium text-orange-300">Leave club</span>
        <mdicon name="chevron-right" :size="20" class="text-white/35" />
      </button>
    </section>

    <v-modal v-if="showLeaveConfirm" size="sm" @close="showLeaveConfirm = false">
      <h3 class="mb-4 text-xl font-semibold">Leave club?</h3>
      <p class="mb-6 text-white/70">
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
import { computed, ref } from "vue";

import { hasValue } from "../../../../lib/checks/checks.js";
import ClubMembersCard from "../components/ClubMembersCard.vue";
import ClubSettingsCard from "../components/ClubSettingsCard.vue";
import { clubMetaLine } from "@/common/clubType";
import { useClub, useClubSlug, useLeaveClub, useMembers } from "@/service/useClub";

const clubSlug = useClubSlug();

const { data: club } = useClub(clubSlug);
const { data: members } = useMembers(clubSlug);
const { mutate: leaveClub, isPending: isLeaving } = useLeaveClub(clubSlug);

const showLeaveConfirm = ref(false);

const meta = computed(() => clubMetaLine(club.value?.type, members.value?.length));
</script>
