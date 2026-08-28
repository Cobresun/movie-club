<template>
  <div class="px-4 pb-10 pt-2">
    <div class="mx-auto flex max-w-lg flex-col gap-5">
      <h1 class="text-3xl font-bold leading-tight">{{ clubName }} needs people</h1>

      <div class="flex flex-col gap-3 rounded-xl bg-lowBackground p-4">
        <h2 class="text-lg font-semibold">Invite link</h2>
        <div class="flex gap-2.5">
          <input
            ref="inviteLinkInput"
            :value="inviteLink"
            readonly
            aria-label="Invite link"
            class="min-h-[44px] min-w-0 flex-grow rounded-md border-2 border-slate-600 bg-background px-3 text-sm text-white/70"
          />
          <v-btn
            class="h-[44px] min-w-[44px]"
            aria-label="Copy invite link"
            @click="copyInviteLink"
          >
            <mdicon :name="copyIcon" />
          </v-btn>
        </div>
        <v-btn
          v-if="canUseNativeShare()"
          class="min-h-[44px] w-full bg-gray-600 hover:bg-gray-700"
          @click="shareInviteLink()"
        >
          <mdicon name="share-variant" :size="20" class="mr-2" />
          Share link
        </v-btn>
        <p class="text-[13px] text-white/55">
          Anyone with the link can join. It stays in Club settings, so you can send it again later.
        </p>
      </div>

      <div class="flex flex-col gap-3">
        <v-btn class="min-h-[44px] w-full" @click="goToClub()">Go to the club</v-btn>
        <p class="text-center text-[13px] font-light text-white/45">
          Your first review is waiting on the other side.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";

import { isDefined } from "@/../lib/checks/checks";
import { clubTypeInvite } from "@/common/clubType";
import { useInviteLink } from "@/common/composables/useInviteLink";
import { useShare } from "@/common/composables/useShare";
import { useClub, useClubSlug } from "@/service/useClub";

const router = useRouter();
const clubSlug = useClubSlug();
const { data: club } = useClub(clubSlug);
const { inviteLink, inviteLinkInput, copyIcon, copyInviteLink } = useInviteLink(clubSlug);
const { share, canUseNativeShare } = useShare();

const clubName = computed(() => club.value?.clubName ?? "Your club");

const shareInviteLink = () => {
  share({
    url: inviteLink.value,
    title: `Join ${clubName.value}`,
    text: isDefined(club.value) ? clubTypeInvite(club.value.type).shareText : undefined,
  }).catch(console.error);
};

const goToClub = () => {
  router.push({ name: "ClubHome", params: { clubSlug } }).catch(console.error);
};
</script>
