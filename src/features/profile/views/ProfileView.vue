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
      <button class="relative group cursor-pointer">
        <v-avatar
          class="mb-4 md:mb-0"
          :src="data?.image"
          :name="data?.name"
          size="160"
        />
        <div
          class="absolute top-0 left-0 rounded-full bg-black bg-opacity-30 w-full h-full hidden group-hover:flex items-center justify-center"
        >
          <mdicon name="pencil" size="32" />
        </div>
      </button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useUser } from "@/service/useUser";

const { data } = useUser();
</script>
