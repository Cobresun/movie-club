<template>
  <header
    class="bg-gradient-to-b from-secondary/40 to-transparent px-6 pb-10 pt-6"
  >
    <div class="mx-auto max-w-6xl">
      <a
        href="/"
        class="mx-auto flex w-fit items-center gap-1.5 text-highlight transition hover:brightness-110"
      >
        <span aria-hidden="true">🍿</span>
        <span class="font-semibold tracking-wide">MovieClub</span>
      </a>

      <div class="mt-8 flex flex-col items-center text-center">
        <p
          v-if="hasValue(eyebrow)"
          class="text-xs font-semibold uppercase tracking-widest text-primary"
        >
          {{ eyebrow }}
        </p>
        <h1 class="mt-1 text-4xl font-bold text-white">
          {{ clubName }}
        </h1>
        <p v-if="hasValue(subtitle)" class="mt-1 text-gray-400">
          {{ subtitle }}
        </p>

        <div
          v-if="members.length > 0"
          class="mt-4 flex items-center -space-x-2"
        >
          <v-avatar
            v-for="member in visibleMembers"
            :key="member.id"
            :src="member.image"
            :name="member.name"
            :size="32"
            class="rounded-full ring-2 ring-background"
          />
          <div
            v-if="extraMemberCount > 0"
            class="flex h-8 w-8 items-center justify-center rounded-full bg-lowBackground text-xs font-semibold text-slate-300 ring-2 ring-background"
          >
            +{{ extraMemberCount }}
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { hasValue } from "../../../lib/checks/checks";

interface HeaderMember {
  id: string;
  name: string;
  image?: string;
}

interface Props {
  clubName: string;
  members?: HeaderMember[];
  eyebrow?: string;
  subtitle?: string;
}
const { clubName, members = [], eyebrow, subtitle } = defineProps<Props>();

const MAX_VISIBLE_MEMBERS = 6;
const visibleMembers = computed(() => members.slice(0, MAX_VISIBLE_MEMBERS));
const extraMemberCount = computed(() =>
  Math.max(members.length - MAX_VISIBLE_MEMBERS, 0),
);
</script>
