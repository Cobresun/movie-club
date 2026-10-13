<template>
  <div
    role="img"
    aria-label="An example club's reviews: each friend's score for 12 Angry Men and The Empire Strikes Back, next to the club average"
    class="flex justify-center gap-4"
  >
    <WorkPosterCard
      v-for="work in sampleWorks"
      :key="work.title"
      :title="work.title"
      :poster-url="work.posterUrl"
    >
      <div class="grid grid-cols-2 gap-2">
        <div
          v-for="score in work.scores"
          :key="score.name"
          class="flex items-center rounded-3xl bg-slate-600"
        >
          <VAvatar :name="score.name" :size="28" />
          <div class="flex-grow text-sm">{{ score.value }}</div>
        </div>
        <div class="flex items-center rounded-3xl bg-slate-600">
          <img :src="AverageImg" class="h-7 w-7 max-w-none" />
          <div class="flex-grow text-lg font-bold text-primary">{{ average(work.scores) }}</div>
        </div>
      </div>
    </WorkPosterCard>
  </div>
</template>

<script setup lang="ts">
import AverageImg from "@/assets/images/average.svg";
import VAvatar from "@/common/components/VAvatar.vue";
import WorkPosterCard from "@/common/components/WorkPosterCard.vue";

interface SampleScore {
  name: string;
  value: number;
}

interface SampleWork {
  title: string;
  posterUrl: string;
  scores: SampleScore[];
}

const sampleWorks: SampleWork[] = [
  {
    title: "12 Angry Men",
    posterUrl: "https://image.tmdb.org/t/p/w154/ow3wq89wM8qd5X7hWKxiRfsFf9C.jpg",
    scores: [
      { name: "Ana Cruz", value: 9.5 },
      { name: "Sam Lee", value: 8 },
      { name: "Priya Shah", value: 9 },
    ],
  },
  {
    title: "The Empire Strikes Back",
    posterUrl: "https://image.tmdb.org/t/p/w154/nNAeTmF4CtdSgMDplXTDPOpYzsX.jpg",
    scores: [
      { name: "Ana Cruz", value: 7 },
      { name: "Sam Lee", value: 9.5 },
      { name: "Priya Shah", value: 6.5 },
    ],
  },
];

const average = (scores: SampleScore[]) =>
  Math.round((scores.reduce((sum, score) => sum + score.value, 0) / scores.length) * 100) / 100;
</script>
