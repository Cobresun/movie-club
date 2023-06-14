<template>
  <div class="flex justify-between mb-2">
    <h3 class="text-xl font-bold text-left">{{ award.title }}</h3>
    <v-btn @click="submit">Submit</v-btn>
  </div>
  <transition-group
    tag="div"
    move-class="transition ease-linear duration-300"
    class="grid grid-cols-auto"
  >
    <MoviePosterCard
      v-for="(nomination, index) in nominations"
      :key="nomination.movieId"
      :movie-title="nomination.movieTitle"
      :movie-poster-url="nomination.movieData.poster_url"
    >
      <div class="flex gap-2 mb-4">
        <v-avatar
          v-for="voter in nomination.nominatedBy"
          :key="voter"
          :size="32"
          :name="voter"
          :src="getMemberImage(voter)"
        />
      </div>
      <div class="flex justify-between">
        <v-btn v-if="index > 0" @click="swapLeft(index)">
          <mdicon name="chevron-left" />
        </v-btn>
        <v-btn
          v-if="index < nominations.length - 1"
          :class="{ 'ml-auto': index === 0 }"
          @click="swapRight(index)"
        >
          <mdicon name="chevron-right" />
        </v-btn>
      </div>
    </MoviePosterCard>
  </transition-group>
</template>
<script setup lang="ts">
import { ref } from "vue";

import MoviePosterCard from "@/common/components/MoviePosterCard.vue";
import { Award } from "@/common/types/awards";
import { Member } from "@/common/types/club";

const { award, members, user } = defineProps<{
  award: Award;
  members: Member[];
  user: Member;
}>();

const emit = defineEmits<{ (e: "submit-ranking", ranking: number[]): void }>();

const nominations = ref(
  [...award.nominations].sort((nomA, nomB) => {
    const nomARank = nomA.ranking[user.name];
    const nomBRank = nomB.ranking[user.name];
    if (!nomARank || !nomBRank) return 0;
    if (nomARank < nomBRank) return -1;
    if (nomARank > nomBRank) return 1;
    return 0;
  })
);

const swapLeft = (index: number) => swapRight(index - 1);

const swapRight = (index: number) => {
  const arr = [...nominations.value];
  [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
  nominations.value = arr;
};

const getMemberImage = (name: string) => {
  const member = members.find((member) => member.name === name);
  if (member && member.image) return member.image;
  return undefined;
};

const submit = () => {
  emit(
    "submit-ranking",
    nominations.value.map((nomination) => nomination.movieId)
  );
};
</script>
