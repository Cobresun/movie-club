<template>
  <div v-if="isLoggedIn" class="mx-auto flex max-w-lg flex-col gap-5 px-4 pb-10 pt-2">
    <div class="flex flex-col gap-2">
      <h1 class="text-3xl font-bold leading-tight">{{ heading }}</h1>
      <p v-if="isFirstClub" class="text-[15px] font-light leading-relaxed text-white/65">
        A club is a handful of friends who watch the same films — or read the same books — and score
        them together. Most people are in exactly one.
      </p>
      <p v-else class="text-[15px] font-light leading-relaxed text-white/65">
        Start a second club, or join one you were invited to.
      </p>
    </div>

    <div class="flex flex-col gap-3 rounded-xl bg-lowBackground p-4">
      <h2 class="text-lg font-semibold">Start a club</h2>
      <input
        id="club-name"
        v-model="clubName"
        placeholder="Club name"
        type="text"
        class="min-h-[44px] w-full rounded-md border-2 border-slate-600 bg-background px-3 text-base outline-none focus:border-primary"
        :class="{ 'border-red-500': showErrors && !isClubNameValid }"
      />
      <span v-if="showErrors && !isClubNameValid" class="text-sm text-red-500">
        Club name is required
      </span>

      <p class="text-[13px] text-white/55">What will this club review?</p>
      <div class="flex gap-3">
        <button
          v-for="option in clubTypeOptions"
          :key="option.value"
          type="button"
          class="flex min-h-[44px] flex-grow flex-col items-center gap-1.5 rounded-lg p-3 text-[15px] font-medium ring-2 ring-inset transition-colors duration-fast ease-standard"
          :class="
            clubType === option.value
              ? 'bg-primary/[0.14] text-highlight ring-primary'
              : 'text-white/70 ring-slate-600 hover:ring-slate-500'
          "
          :aria-pressed="clubType === option.value"
          @click="clubType = option.value"
        >
          <mdicon :name="clubTypeIcon(option.value)" :size="26" />
          <span>{{ option.label }}</span>
        </button>
      </div>

      <v-btn class="min-h-[44px] w-full" :disabled="isCreating" @click="submit()">
        Create club
      </v-btn>
      <p class="text-xs font-light leading-relaxed text-white/45">
        You'll get an invite link to send your friends.
      </p>
    </div>

    <div class="flex items-center gap-3">
      <div class="h-px flex-grow bg-white/10" />
      <span class="text-[13px] text-white/45">or</span>
      <div class="h-px flex-grow bg-white/10" />
    </div>

    <div class="flex flex-col gap-3 rounded-xl bg-lowBackground p-4">
      <h2 class="text-lg font-semibold">Join one you were invited to</h2>
      <p class="text-sm font-light leading-relaxed text-white/60">
        Someone already in the club sends you a link. Open it on this device, or paste it here.
      </p>
      <div class="flex gap-2.5">
        <input
          v-model="inviteInput"
          placeholder="Paste invite link"
          type="text"
          aria-label="Invite link"
          class="min-h-[44px] min-w-0 flex-grow rounded-md border-2 border-slate-600 bg-background px-3 text-[15px] outline-none focus:border-primary"
          @keyup.enter="joinClub()"
        />
        <v-btn class="min-h-[44px] bg-gray-600 hover:bg-gray-700" @click="joinClub()">Join</v-btn>
      </div>
      <span v-if="inviteError" class="text-sm text-red-500">{{ inviteError }}</span>
    </div>
  </div>
  <div v-else class="p-4 text-center">Must be logged in to create a new club!</div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";

import { hasValue } from "@/../lib/checks/checks";
import { ClubType } from "@/../lib/types/generated/db";
import { clubTypeIcon } from "@/common/clubType";
import { setLastClubSlug } from "@/common/composables/useLastClubSlug";
import { useCreateClub } from "@/service/useClub";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const clubName = ref("");
const clubType = ref<ClubType>(ClubType.movie);
const showErrors = ref(false);

const clubTypeOptions: { value: ClubType; label: string }[] = [
  { value: ClubType.movie, label: "Movies" },
  { value: ClubType.book, label: "Books" },
];

const authStore = useAuthStore();
const isLoggedIn = computed(() => authStore.isLoggedIn);

/**
 * This view is both the empty state the router sends club-less users to and the
 * "new club" screen someone already in a club reaches from the switcher, so the
 * onboarding framing only applies to the former.
 */
const isFirstClub = computed(() => (authStore.userClubs?.length ?? 0) === 0);
const heading = computed(() => (isFirstClub.value ? "You're not in a club yet" : "New club"));

const isClubNameValid = computed(() => clubName.value.trim().length > 0);
const { mutateAsync: createClub, isPending: isCreating } = useCreateClub();

const submit = async () => {
  showErrors.value = true;

  if (!isClubNameValid.value || isCreating.value) {
    return;
  }

  if (authStore.user && authStore.user?.email !== null) {
    const validMembers = [authStore.user.email];

    try {
      const response = await createClub({
        clubName: clubName.value.trim(),
        members: validMembers,
        type: clubType.value,
      });
      const { slug } = response.data;
      setLastClubSlug(slug);
      router.push({ name: "ClubHome", params: { clubSlug: slug } }).catch(console.error);
    } catch (error) {
      console.error("Failed to create club:", error);
    }
  }
};

const inviteInput = ref("");
const inviteError = ref("");

/**
 * Invite links are handed around as full URLs, but members paste whatever they
 * have — the whole link, or just the token out of it.
 */
const parseInviteToken = (value: string): string | null => {
  const trimmed = value.trim();
  const fromUrl = /\/join-club\/([^/?#\s]+)/.exec(trimmed);
  if (fromUrl) return fromUrl[1];
  return /^[\w-]+$/.test(trimmed) ? trimmed : null;
};

const joinClub = () => {
  const token = parseInviteToken(inviteInput.value);
  if (!hasValue(token)) {
    inviteError.value = "That doesn't look like an invite link.";
    return;
  }
  inviteError.value = "";
  router.push({ name: "JoinClub", params: { inviteToken: token } }).catch(console.error);
};
</script>
