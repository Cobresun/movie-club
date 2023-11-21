<template>
  <div class="flex justify-center">
    <div
      class="flex md:flex-row flex-col-reverse items-center justify-between p-8 w-full max-w-5xl"
    >
      <div class="text-left">
        <p class="text-lg font-semibold">Name:</p>
        <p class="mb-2">{{ data?.name }}</p>
        <p class="text-lg font-semibold">Email:</p>
        <p>{{ data?.email }}</p>
      </div>
      <v-avatar
        class="mb-4 md:mb-0"
        :src="data?.image"
        :name="data?.name"
        size="160"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
import { useUser } from "@/service/useUser";

const { data } = useUser();
</script>
