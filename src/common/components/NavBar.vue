<template>
  <div class="flex items-center justify-between p-4">
    <router-link to="/">
      <h3 class="text-2xl font-bold text-highlight">MovieClub</h3>
    </router-link>
    <div v-if="authReady" class="flex items-center">
      <v-avatar
        v-if="isLoggedIn"
        class="mr-3 cursor-pointer"
        :name="fullName"
        :src="avatarURL"
        @click="toProfile"
      />
      <v-btn v-if="!isLoggedIn" @click="login"> Login </v-btn>
      <v-btn v-else @click="logout"> Logout </v-btn>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";

import { useUser } from "@/service/useUser";
import { useAuthStore } from "@/stores/auth";

const store = useAuthStore();
const { data: user } = useUser();

const isLoggedIn = computed(() => store.isLoggedIn);
const fullName = computed(() => store.user?.name ?? "");
const avatarURL = computed(() => user.value?.image);
const authReady = computed(() => store.ready);

function login() {
  store.login();
}

async function logout() {
  await store.logout();
}

const router = useRouter();
function toProfile() {
  router.push({ name: "Profile" }).catch(console.error);
}
</script>
