<template>
  <div>
    <!-- TODO: the page header component checks for a club, lets not do that here! -->
    <page-header
      :has-back="false"
      page-name="Create a Club"
      :hide-club="true"
    />
    <div v-if="isLoggedIn">
      <div class="px-4 text-center">
        <input
          id="club-name"
          v-model="clubName"
          placeholder="Club name"
          type="text"
          class="w-11/12 max-w-md rounded-md border-2 border-gray-300 p-2 text-base text-black outline-none focus:border-primary"
          :class="{ 'border-red-500': showErrors && !isClubNameValid }"
        />
        <div class="mb-4">
          <span
            v-if="showErrors && !isClubNameValid"
            class="text-sm text-red-500"
          >
            Club name is required
          </span>
        </div>
      </div>

      <div class="mt-6 flex justify-evenly">
        <v-btn :disabled="isCreating" @click="submit()"> Create club </v-btn>
      </div>
    </div>
    <div v-else>Must be logged in to create a new club!</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";

import { useCreateClub } from "@/service/useClub";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const clubName = ref("");
const showErrors = ref(false);

const authStore = useAuthStore();
const isLoggedIn = computed(() => authStore.isLoggedIn);

const isClubNameValid = computed(() => clubName.value.trim().length > 0);
const { mutate: createClub, isPending: isCreating } = useCreateClub();

const submit = () => {
  showErrors.value = true;

  if (!isClubNameValid.value || isCreating.value) {
    return;
  }

  if (authStore.user && authStore.user?.email !== null) {
    const validMembers = [authStore.user.email];

    createClub(
      {
        clubName: clubName.value.trim(),
        members: validMembers,
      },
      {
        onSuccess: () => {
          router.push({ name: "Clubs" }).catch(console.error);
        },
      },
    );
  }
};
</script>
