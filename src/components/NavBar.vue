<template>
  <div class="flex justify-between items-center p-4">
    <router-link to="/">
      <h3 class="font-bold text-2xl text-highlight">MovieClub</h3>
    </router-link>
    <div 
      v-if="authReady"
      class="flex items-center">
      <avatar
        v-if="isLoggedIn"
        class="mr-3"
        :fullname="fullName"
        :image="avatarURL"
      ></avatar>
      <btn
        v-if="!isLoggedIn"
        @click="login"
      >Login</btn>
      <btn
        v-else
        @click="logout"
      >Logout</btn>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';

@Component({})
export default class NavBar extends Vue {
  get isLoggedIn(): boolean {
    return this.$store.state.auth.user !== null
  }

  get fullName(): string {
    return this.$store.state.auth.user.user_metadata.full_name;
  }

  get avatarURL(): string | undefined {
    return this.$store.state.auth.user.user_metadata.avatar_url;
  }

  get authReady(): boolean {
    return this.$store.state.auth.ready;
  }

  login(): void {
    this.$store.dispatch('login');
  }

  logout(): void {
    this.$store.dispatch('logout');
  }
}
</script>