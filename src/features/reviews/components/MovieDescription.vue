<template>
  <div v-if="overview" class="mb-4">
    <!-- Visible text with conditional truncation -->
    <p
      ref="descriptionRef"
      class="text-sm text-gray-300"
      :class="{
        'line-clamp-2': !isDescriptionExpanded,
      }"
    >
      {{ overview }}
    </p>

    <!-- Read more button -->
    <button
      v-if="shouldShowReadMore"
      class="mt-1 text-sm text-primary hover:underline"
      @click="isDescriptionExpanded = !isDescriptionExpanded"
    >
      {{ isDescriptionExpanded ? "Show less" : "Read more" }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";

defineProps<{
  overview: string;
}>();

// Description expansion state
const isDescriptionExpanded = ref(false);
const shouldShowReadMore = ref(false);
const descriptionRef = ref<HTMLParagraphElement | null>(null);

// Check if description text exceeds 2 lines by comparing scroll vs client height
const checkDescriptionHeight = async () => {
  await nextTick();

  if (!descriptionRef.value) {
    shouldShowReadMore.value = false;
    return;
  }

  // Compare scrollHeight to clientHeight to detect overflow
  shouldShowReadMore.value =
    descriptionRef.value.scrollHeight > descriptionRef.value.clientHeight;
};

onMounted(() => {
  checkDescriptionHeight().catch(console.error);
});
</script>
