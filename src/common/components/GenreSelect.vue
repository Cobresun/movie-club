<template>
  <div>
    <label class="mb-2 block text-sm font-medium text-text">Genre</label>
    <div v-if="isLoading" class="text-sm text-gray-400">Loading genres...</div>
    <div v-else class="flex flex-wrap gap-2">
      <button
        v-for="genre in genres?.genres"
        :key="genre.id"
        type="button"
        class="rounded-full px-3 py-1 text-sm transition-colors"
        :class="
          isSelected(genre.id)
            ? 'bg-primary text-text'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        "
        @click="toggleGenre(genre.id)"
      >
        {{ genre.name }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGenres } from "@/service/useTMDB";

const selectedGenres = defineModel<number[]>({ required: true });

const { data: genres, isLoading } = useGenres();

const isSelected = (genreId: number) => selectedGenres.value.includes(genreId);

const toggleGenre = (genreId: number) => {
  if (isSelected(genreId)) {
    selectedGenres.value = selectedGenres.value.filter((id) => id !== genreId);
  } else {
    selectedGenres.value = [...selectedGenres.value, genreId];
  }
};
</script>
