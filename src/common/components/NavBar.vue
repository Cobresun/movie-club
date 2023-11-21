<template>
  <div class="flex justify-between items-center p-4">
    <router-link to="/">
      <h3 class="font-bold text-2xl text-highlight">MovieClub</h3>
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

import { useAuthStore } from "@/stores/auth";

const store = useAuthStore();

const isLoggedIn = computed(() => store.user !== null);
const fullName = computed(() => store.user?.user_metadata?.full_name);
const avatarURL = computed(() => store.user?.user_metadata?.avatar_url);
const authReady = computed(() => store.ready);

function login() {
  store.login();
}

function logout() {
  store.logout();
}

const router = useRouter();
function toProfile() {
  router.push({ name: "Profile" });
}
</script>
