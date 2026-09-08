<template>
  <div>
    <page-header has-back back-route="Clubs" page-name="Change password" hide-club />

    <div class="mx-auto w-full max-w-md px-4 pb-8">
      <ChangePasswordForm @done="toClubs" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";

import ChangePasswordForm from "../../auth/components/ChangePasswordForm.vue";

const router = useRouter();

// There is nothing left on this screen once the password has changed, so a
// success lands where the header's back arrow would have.
const toClubs = () => {
  router.push({ name: "Clubs" }).catch(console.error);
};
</script>
