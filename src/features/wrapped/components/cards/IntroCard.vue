<template>
  <div class="flex flex-1 flex-col justify-center">
    <mdicon :name="clubIcon" :size="44" class="text-white/80" />
    <p class="mt-4 text-7xl font-bold leading-none tracking-tight">{{ year }}</p>
    <p class="mt-2 text-3xl font-semibold">{{ inProgress ? "so far" : "wrapped" }}</p>
    <dl class="mt-10 grid grid-cols-2 gap-3">
      <div class="flex flex-col-reverse justify-end rounded-xl bg-white/10 p-3">
        <dt class="text-sm text-white/75">{{ countLabel }}</dt>
        <dd class="text-4xl font-bold tabular-nums">{{ workCount }}</dd>
      </div>
      <div class="flex flex-col-reverse justify-end rounded-xl bg-white/10 p-3">
        <dt class="text-sm text-white/75">
          {{ memberCount === 1 ? "member" : "members" }} scoring
        </dt>
        <dd class="text-4xl font-bold tabular-nums">{{ memberCount }}</dd>
      </div>
    </dl>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  year: number;
  inProgress: boolean;
  clubIcon: string;
  workCount: number;
  countLabel: string;
  memberCount: number;
}>();
</script>
