<template>
  <div class="flex justify-between items-center p-4">
    <router-link to="/">
      <h3 class="font-bold text-2xl text-highlight">MovieClub</h3>
    </router-link>
    <div 
      v-if="authReady"
      class="flex items-center">
      <v-avatar
        v-if="isLoggedIn"
        class="mr-3"
        :name="fullName"
        :src="avatarURL"
      ></v-avatar>
      <v-btn
        v-if="!isLoggedIn"
        @click="login"
      >Login</v-btn>
      <v-btn
        v-else
        @click="logout"
      >Logout</v-btn>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useStore } from 'vuex';

const store = useStore();

const isLoggedIn = computed(() => store.state.auth.user !== null);
const fullName = computed(() => store.state.auth.user.user_metadata.full_name);
const avatarURL = computed(() => store.state.auth.user.user_metadata.avatar_url);
const authReady = computed(() => store.state.auth.ready);

function login() {
 store.dispatch('login');
}

function logout() {
  store.dispatch('logout');
}
</script>