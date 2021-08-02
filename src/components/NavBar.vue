<template>
  <div class="bar">
    <router-link to="/"><h3 class="title">MovieClub</h3></router-link>
    <div 
      v-if="authReady"
      class="auth-buttons">
      <avatar
        v-if="isLoggedIn"
        class="avatar"
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

<style scoped>
.title {
  font-family: 'Poppins', sans-serif;
  font-weight: 700;
  font-size: 25px;
  color: var(--highlight-color);
  text-align: left;
  margin-left:20px;
}

.bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.auth-buttons {
  display: flex;
  align-items: center;
}

.avatar {
  margin-right: 12px;
}
</style>
